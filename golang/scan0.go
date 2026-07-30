package mixpad

// scan0 is Phase 1: a single forward pass that emits provisional tokens into
// `out` until a decisive resolution point. Zero heap allocation beyond the
// growing token buffer. Returns the number of tokens in `out`.
func scan0(s string, startOffset, endOffset int, out *tokBuf) int {
	tokenCount := 0
	offset := startOffset

	lineStartOffset := startOffset
	lineTokenStartIndex := 0
	lineCouldBeSetextText := true

	// Front matter is only valid at the very start of the document.
	if startOffset == 0 {
		if consumed := scanFrontmatter(s, startOffset, endOffset, out); consumed > 0 {
			offset += consumed
			tokenCount = out.len()
			lineStartOffset = offset
			lineTokenStartIndex = out.len()
			lineCouldBeSetextText = false
		}
	}

	nextTokenIsReparseStart := startOffset == 0 && offset == startOffset
	errorRecoveryMode := false

	markReparse := func(tokenStartIndex int, should bool) {
		if should && out.len() > tokenStartIndex {
			out.setAt(tokenStartIndex, out.at(tokenStartIndex)|IsSafeReparsePoint)
		}
	}

	applyDepth := func(from int, depth int) {
		depthBits := Token(depth&0x7) << headDepthShf
		for i := from; i < out.len(); i++ {
			out.setAt(i, (out.at(i)&^headDepthMsk)|depthBits)
		}
	}

	for offset < endOffset {
		tokenStartIndex := out.len()
		shouldMark := nextTokenIsReparseStart && !errorRecoveryMode
		nextTokenIsReparseStart = false

		ch := s[offset]
		offset++

		switch ch {
		case '\n':
			if lineCouldBeSetextText && lineTokenStartIndex < out.len() {
				res := checkSetextUnderline(s, offset, endOffset)
				if res.valid {
					applyDepth(lineTokenStartIndex, res.depth)
					out.push(kNewLine | 1)
					tokenCount++
					out.push(Token(res.underlineTokenLen) | kSetextHeadingUnderline | (Token(res.depth&0x7) << headDepthShf))
					tokenCount++
					offset += res.consumedLength
					lineStartOffset = offset
					lineTokenStartIndex = out.len()
					lineCouldBeSetextText = true
					break
				}
			}
			out.push(kNewLine | 1)
			tokenCount++
			lineStartOffset = offset
			lineTokenStartIndex = out.len()
			lineCouldBeSetextText = true

		case '\r':
			isLF := offset < endOffset && s[offset] == '\n'
			nl := 1
			if isLF {
				nl = 2
				offset++
			}
			if lineCouldBeSetextText && lineTokenStartIndex < out.len() {
				res := checkSetextUnderline(s, offset, endOffset)
				if res.valid {
					applyDepth(lineTokenStartIndex, res.depth)
					out.push(kNewLine | Token(nl))
					tokenCount++
					out.push(Token(res.underlineTokenLen) | kSetextHeadingUnderline | (Token(res.depth&0x7) << headDepthShf))
					tokenCount++
					offset += res.consumedLength
					lineStartOffset = offset
					lineTokenStartIndex = out.len()
					lineCouldBeSetextText = true
					break
				}
			}
			out.push(kNewLine | Token(nl))
			tokenCount++
			lineStartOffset = offset
			lineTokenStartIndex = out.len()
			lineCouldBeSetextText = true

		case '&':
			entity := scanEntity(s, offset-1, endOffset)
			if entity != 0 {
				length := tokLen(entity)
				if shouldMark {
					entity |= IsSafeReparsePoint
				}
				out.push(entity)
				tokenCount++
				offset += length - 1
			} else {
				consumed := scanInlineText(s, offset-1, endOffset, out)
				if consumed > 0 {
					markReparse(tokenStartIndex, shouldMark)
					tokenCount = out.len()
					offset += consumed - 1
				}
			}

		case '\\':
			esc := scanEscaped(s, offset-1, endOffset)
			if esc != 0 {
				out.push(esc)
				tokenCount++
				offset += tokLen(esc) - 1
				break
			}
			consumed := scanInlineText(s, offset-1, endOffset, out)
			if consumed > 0 {
				tokenCount = out.len()
				offset += consumed - 1
			}

		case '`':
			consumed := scanFencedBlock(s, offset-1, endOffset, out)
			if consumed > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				return out.len()
			}
			cb := scanBacktickInline(s, offset-1, endOffset, out)
			if cb == 0 {
				c := scanInlineText(s, offset-1, endOffset, out)
				if c > 0 {
					markReparse(tokenStartIndex, shouldMark)
					tokenCount = out.len()
					offset += c - 1
				}
				continue
			}
			markReparse(tokenStartIndex, shouldMark)
			return out.len()

		case '~':
			cf := scanFencedBlock(s, offset-1, endOffset, out)
			if cf > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				return out.len()
			}
			ce := scanEmphasis(s, offset-1, endOffset, out)
			if ce > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += ce - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '$':
			cfm := scanFormulaBlock(s, offset-1, endOffset, out)
			if cfm > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				return out.len()
			}
			c2 := scanInlineText(s, offset-1, endOffset, out)
			if c2 > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c2 - 1
			}

		case '*':
			if tc := scanThematicBreak(s, offset-1, endOffset, out); tc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += tc - 1
				continue
			}
			if lc := scanBulletListMarker(s, offset-1, endOffset, out); lc > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += lc - 1
				continue
			}
			if ce := scanEmphasis(s, offset-1, endOffset, out); ce > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += ce - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '_':
			if tc := scanThematicBreak(s, offset-1, endOffset, out); tc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += tc - 1
				continue
			}
			if ce := scanEmphasis(s, offset-1, endOffset, out); ce > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += ce - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '<':
			if ac := scanAngleAutolink(s, offset-1, endOffset, out); ac > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += ac - 1
				continue
			}
			htmlConsumed := 0
			if offset < endOffset && s[offset] == '!' {
				if offset+2 < endOffset && s[offset+1] == '-' && s[offset+2] == '-' {
					htmlConsumed = scanHTMLComment(s, offset-1, endOffset, out)
				} else if offset+1 < endOffset && s[offset+1] == '[' {
					htmlConsumed = scanHTMLCData(s, offset-1, endOffset, out)
				} else {
					htmlConsumed = scanHTMLDocType(s, offset-1, endOffset, out)
				}
				if htmlConsumed > 0 {
					lineCouldBeSetextText = false
				}
			} else if offset < endOffset && s[offset] == '?' {
				htmlConsumed = scanXMLPI(s, offset-1, endOffset, out)
				if htmlConsumed > 0 {
					lineCouldBeSetextText = false
				}
			} else {
				before := out.len()
				htmlConsumed = scanHTMLTag(s, offset-1, endOffset, out)
				if htmlConsumed > 0 && out.len() > before {
					// detect raw-text opening tag
					tagNameTok := Token(0)
					tagNameIdx := -1
					tagOpenTok := Token(0)
					for i := before; i < out.len(); i++ {
						if tokKind(out.at(i)) == kHTMLTagOpen {
							tagOpenTok = out.at(i)
						}
						if tokKind(out.at(i)) == kHTMLTagName {
							tagNameTok = out.at(i)
							tagNameIdx = i
						}
					}
					if tagOpenTok != 0 && tokLen(tagOpenTok) == 1 && tagNameTok != 0 &&
						tokKind(out.last()) == kHTMLTagClose {
						actualOffset := offset - 1
						for i := before; i < tagNameIdx; i++ {
							actualOffset += tokLen(out.at(i))
						}
						tagNameLength := tokLen(tagNameTok)
						if isRawTextElement(s, actualOffset, tagNameLength) {
							rawStart := offset - 1 + htmlConsumed
							var rc int
							if matchesTagName(s, actualOffset, tagNameLength, "textarea") {
								rc = scanTextarea(s, rawStart, endOffset, actualOffset, tagNameLength, out)
							} else {
								rc = scanHTMLRawText(s, rawStart, endOffset, actualOffset, tagNameLength, out)
							}
							htmlConsumed += rc
						}
					}
				}
			}
			if htmlConsumed > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += htmlConsumed - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '\t', ' ':
			if out.len() > 0 && tokKind(out.last()) == kWhitespace {
				out.setAt(out.len()-1, out.last()+1)
			} else {
				out.push(kWhitespace | 1)
				tokenCount++
			}
			if lineTokenStartIndex == out.len()-1 {
				wsLength := tokLen(out.last())
				indent := countIndentation(s, lineStartOffset, lineStartOffset+wsLength)
				if indent >= 4 {
					lineCouldBeSetextText = false
				}
			}

		case '#':
			hc := scanATXHeading(s, offset-1, endOffset, out)
			if hc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				return out.len()
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '>':
			if bq := scanBlockquote(s, offset-1, endOffset, out); bq > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += bq - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '-':
			if tc := scanThematicBreak(s, offset-1, endOffset, out); tc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += tc - 1
				continue
			}
			if lc := scanBulletListMarker(s, offset-1, endOffset, out); lc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += lc - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '+':
			if lc := scanBulletListMarker(s, offset-1, endOffset, out); lc > 0 {
				lineCouldBeSetextText = false
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += lc - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			if lc := scanOrderedListMarker(s, offset-1, endOffset, out); lc > 0 {
				lineCouldBeSetextText = false
				tokenCount = out.len()
				offset += lc - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				tokenCount = out.len()
				offset += c - 1
			}

		case '!':
			if ic := scanImageMarker(s, offset-1, endOffset, out); ic > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case '(':
			if scanLinkDestOpen(s, offset-1, endOffset, out) > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
			}

		case ')':
			if scanLinkDestClose(s, offset-1, endOffset, out) > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
			}

		case '[':
			if tc := scanTaskListMarker(s, offset-1, endOffset, out); tc > 0 {
				lineCouldBeSetextText = false
				tokenCount = out.len()
				offset += tc - 1
				continue
			}
			scanLinkOpen(s, offset-1, endOffset, out)
			markReparse(tokenStartIndex, shouldMark)
			tokenCount = out.len()

		case ']':
			if scanLinkClose(s, offset-1, endOffset, out) > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
			}

		case '|':
			if pc := scanTablePipe(s, offset-1, endOffset, out); pc > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += pc - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case 'h':
			if urlTok := scanRawURLAutolink(s, offset-1, endOffset); urlTok != 0 {
				out.push(urlTok)
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += tokLen(urlTok) - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		case 'w', 'W':
			prev := byte(0)
			if offset-2 >= lineStartOffset {
				prev = s[offset-2]
			}
			if wwwTok := scanWWWAutolink(s, offset-1, endOffset, prev); wwwTok != 0 {
				out.push(wwwTok)
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += tokLen(wwwTok) - 1
				continue
			}
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				markReparse(tokenStartIndex, shouldMark)
				tokenCount = out.len()
				offset += c - 1
			}

		default:
			c := scanInlineText(s, offset-1, endOffset, out)
			if c > 0 {
				tokenCount = out.len()
				offset += c - 1
			}
		}

		markReparse(tokenStartIndex, shouldMark)

		if out.len() > tokenStartIndex {
			lastToken := out.last()
			lastKind := tokKind(lastToken)
			if tokFlags(lastToken)&ErrorUnbalancedFlag != 0 {
				errorRecoveryMode = true
			}
			if lastKind == kNewLine && out.len() >= 2 {
				prevKind := tokKind(out.at(out.len() - 2))
				if prevKind == kNewLine || prevKind == kWhitespace {
					if !errorRecoveryMode {
						nextTokenIsReparseStart = true
					}
				}
			}
		}
	}

	return tokenCount
}
