package mixpad

// Faithful ports of the HTML comment / CDATA / DOCTYPE / XML-PI / raw-text
// scanners, including their heuristic error-recovery rules.

func scanHTMLComment(s string, start, end int, out *tokBuf) int {
	if start+4 > end {
		return 0
	}
	if s[start] != '<' || s[start+1] != '!' || s[start+2] != '-' || s[start+3] != '-' {
		return 0
	}
	openIdx := out.len()
	out.push(4 | kHTMLCommentOpen)
	offset := start + 4
	contentStart := offset
	for offset < end {
		if s[offset] == '-' && offset+2 < end && s[offset+1] == '-' && s[offset+2] == '>' {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kHTMLCommentContent)
			}
			out.push(3 | kHTMLCommentClose)
			return offset - start + 3
		}
		offset++
	}
	out.setAt(openIdx, out.at(openIdx)|ErrorUnbalancedFlag)
	recoveryEnd := end
	i := contentStart
	for i < end {
		ch := s[i]
		if ch == 10 || ch == 13 {
			newlineStart := i
			if ch == 13 && i+1 < end && s[i+1] == 10 {
				i++
			}
			next := i + 1
			for next < end {
				nc := s[next]
				if nc == 10 || nc == 13 {
					recoveryEnd = newlineStart
					i = end
					break
				}
				if nc != 32 && nc != 9 {
					break
				}
				next++
			}
			if i == end {
				break
			}
		} else if ch == '<' {
			lineStart := -1
			for j := i - 1; j >= contentStart-1; j-- {
				if j < contentStart {
					lineStart = contentStart
					break
				}
				pc := s[j]
				if pc == 10 || pc == 13 {
					lineStart = j + 1
					break
				}
			}
			if lineStart != -1 {
				wsOnly := true
				for j := lineStart; j < i; j++ {
					if s[j] != 32 && s[j] != 9 {
						wsOnly = false
						break
					}
				}
				if wsOnly {
					recoveryEnd = i
					break
				}
			}
		}
		i++
	}
	if recoveryEnd > contentStart {
		out.push(Token(recoveryEnd-contentStart) | kHTMLCommentContent | ErrorUnbalancedFlag)
	}
	return recoveryEnd - start
}

func scanHTMLCData(s string, start, end int, out *tokBuf) int {
	if start+9 > end {
		return 0
	}
	if !(s[start] == '<' && s[start+1] == '!' && s[start+2] == '[' && s[start+3] == 'C' &&
		s[start+4] == 'D' && s[start+5] == 'A' && s[start+6] == 'T' && s[start+7] == 'A' && s[start+8] == '[') {
		return 0
	}
	openIdx := out.len()
	out.push(9 | kHTMLCDataOpen)
	offset := start + 9
	contentStart := offset
	closeOffset := -1
	for i := offset; i < end; i++ {
		if s[i] == ']' && i+2 < end && s[i+1] == ']' && s[i+2] == '>' {
			closeOffset = i
			break
		}
	}
	if closeOffset != -1 {
		if closeOffset > contentStart {
			out.push(Token(closeOffset-contentStart) | kHTMLCDataContent)
		}
		out.push(3 | kHTMLCDataClose)
		return closeOffset - start + 3
	}
	out.setAt(openIdx, out.at(openIdx)|ErrorUnbalancedFlag)
	recoveryEnd := -1
	for i := offset; i < end; i++ {
		ch := s[i]
		if ch == 10 || ch == 13 {
			next := i + 1
			if ch == 13 && next < end && s[next] == 10 {
				next++
			}
			if next < end {
				nc := s[next]
				if nc == 10 || nc == 13 {
					recoveryEnd = i
					break
				}
			}
		}
	}
	if recoveryEnd == -1 {
		for i := offset; i < end; i++ {
			if s[i] == '<' {
				recoveryEnd = i
				for recoveryEnd > offset {
					pc := s[recoveryEnd-1]
					if pc == 10 || pc == 13 {
						recoveryEnd--
					} else {
						break
					}
				}
				break
			}
		}
	}
	if recoveryEnd == -1 {
		for i := offset; i < end; i++ {
			if s[i] == '>' {
				recoveryEnd = i
				if recoveryEnd > contentStart {
					out.push(Token(recoveryEnd-contentStart) | kHTMLCDataContent | ErrorUnbalancedFlag)
				}
				out.push(1 | kHTMLCDataClose | ErrorUnbalancedFlag)
				return recoveryEnd - start + 1
			}
		}
	}
	if recoveryEnd != -1 {
		if recoveryEnd > contentStart {
			out.push(Token(recoveryEnd-contentStart) | kHTMLCDataContent | ErrorUnbalancedFlag)
		}
		return recoveryEnd - start
	}
	if end > contentStart {
		out.push(Token(end-contentStart) | kHTMLCDataContent | ErrorUnbalancedFlag)
	}
	return end - start
}

func scanHTMLDocType(s string, start, end int, out *tokBuf) int {
	if start+2 > end {
		return 0
	}
	if s[start] != '<' || s[start+1] != '!' {
		return 0
	}
	offset := start + 2
	const expected = "DOCTYPE"
	if offset+7 > end {
		return 0
	}
	for i := 0; i < 7; i++ {
		ch := s[offset]
		exp := expected[i]
		if ch != exp && ch != exp+32 {
			return 0
		}
		offset++
	}
	openIdx := out.len()
	out.push(9 | kHTMLDocTypeOpen)
	contentStart := offset
	bracketDepth := 0
	for offset < end {
		ch := s[offset]
		if ch == '[' {
			bracketDepth++
			offset++
		} else if ch == ']' {
			bracketDepth--
			offset++
		} else if ch == '>' && bracketDepth == 0 {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kHTMLDocTypeContent)
			}
			out.push(1 | kHTMLDocTypeClose)
			return offset - start + 1
		} else if ch == 10 || ch == 13 || ch == '<' {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kHTMLDocTypeContent | ErrorUnbalancedFlag)
			}
			out.setAt(openIdx, out.at(openIdx)|ErrorUnbalancedFlag)
			return offset - start
		} else {
			offset++
		}
	}
	if offset > contentStart {
		out.push(Token(offset-contentStart) | kHTMLDocTypeContent | ErrorUnbalancedFlag)
	}
	out.setAt(openIdx, out.at(openIdx)|ErrorUnbalancedFlag)
	return offset - start
}

func scanXMLPI(s string, start, end int, out *tokBuf) int {
	if start+2 > end {
		return 0
	}
	if s[start] != '<' || s[start+1] != '?' {
		return 0
	}
	offset := start + 2
	if offset >= end {
		return 0
	}
	openIdx := out.len()
	out.push(2 | kXMLPIOpen)
	targetStart := offset
	firstCh := s[offset]
	if (firstCh >= 'A' && firstCh <= 'Z') || (firstCh >= 'a' && firstCh <= 'z') || firstCh == '_' {
		offset++
		for offset < end {
			ch := s[offset]
			if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
				ch == '-' || ch == '_' || ch == '.' {
				offset++
			} else {
				break
			}
		}
	}
	if offset > targetStart {
		out.push(Token(offset-targetStart) | kXMLPITarget)
	}
	contentStart := offset
	flagRest := func() {
		out.setAt(openIdx, out.at(openIdx)|ErrorUnbalancedFlag)
		for i := openIdx + 1; i < out.len(); i++ {
			out.setAt(i, out.at(i)|ErrorUnbalancedFlag)
		}
	}
	for offset < end {
		ch := s[offset]
		if ch == '?' && offset+1 < end && s[offset+1] == '>' {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kXMLPIContent)
			}
			out.push(2 | kXMLPIClose)
			return offset - start + 2
		}
		if ch == 10 || ch == 13 || ch == '<' {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kXMLPIContent)
			}
			flagRest()
			return offset - start
		}
		if ch == '>' {
			if offset > contentStart {
				out.push(Token(offset-contentStart) | kXMLPIContent)
			}
			flagRest()
			out.push(1 | kXMLPIClose | ErrorUnbalancedFlag)
			return offset - start + 1
		}
		offset++
	}
	if offset > contentStart {
		out.push(Token(offset-contentStart) | kXMLPIContent)
	}
	flagRest()
	return offset - start
}

func scanHTMLRawText(s string, start, end, tagNameStart, tagNameLength int, out *tokBuf) int {
	offset := start
	segmentStart := start
	prevWasNewline := false
	for offset < end {
		ch := s[offset]
		if ch == 10 || ch == 13 {
			if prevWasNewline {
				if offset > segmentStart {
					out.push(Token(offset-segmentStart) | kHTMLRawText)
				}
				return offset - start
			}
			prevWasNewline = true
			offset++
			continue
		}
		if ch == '<' {
			if offset+1 >= end || s[offset+1] != '/' {
				if offset > segmentStart {
					out.push(Token(offset-segmentStart) | kHTMLRawText)
				}
				return offset - start
			}
			tmp := offset + 2
			match := true
			for i := 0; i < tagNameLength; i++ {
				if tmp >= end {
					match = false
					break
				}
				a := s[tmp]
				b := s[tagNameStart+i]
				if a >= 'A' && a <= 'Z' {
					a += 32
				}
				if b >= 'A' && b <= 'Z' {
					b += 32
				}
				if a != b {
					match = false
					break
				}
				tmp++
			}
			if match && tmp < end {
				nc := s[tmp]
				if nc == '>' || nc == 9 || nc == 32 || nc == 10 || nc == 13 {
					if offset > segmentStart {
						out.push(Token(offset-segmentStart) | kHTMLRawText)
					}
					return offset - start
				}
			}
		}
		if ch == '&' {
			if et := scanEntity(s, offset, end); et != 0 {
				if offset > segmentStart {
					out.push(Token(offset-segmentStart) | kHTMLRawText)
				}
				out.push(et)
				offset += tokLen(et)
				segmentStart = offset
				prevWasNewline = false
				continue
			}
		}
		if ch != 32 && ch != 9 {
			prevWasNewline = false
		}
		offset++
	}
	if offset > segmentStart {
		out.push(Token(offset-segmentStart) | kHTMLRawText)
	}
	return offset - start
}

func scanTextarea(s string, start, end, tagNameStart, tagNameLength int, out *tokBuf) int {
	offset := start
	segmentStart := start
	for offset < end {
		ch := s[offset]
		if ch == '<' {
			if offset+1 < end && s[offset+1] == '/' {
				tmp := offset + 2
				match := true
				for i := 0; i < tagNameLength; i++ {
					if tmp >= end {
						match = false
						break
					}
					a := s[tmp]
					b := s[tagNameStart+i]
					if a >= 'A' && a <= 'Z' {
						a += 32
					}
					if b >= 'A' && b <= 'Z' {
						b += 32
					}
					if a != b {
						match = false
						break
					}
					tmp++
				}
				if match && tmp < end {
					nc := s[tmp]
					if nc == '>' || nc == 9 || nc == 32 || nc == 10 || nc == 13 {
						if offset > segmentStart {
							out.push(Token(offset-segmentStart) | kHTMLRawText)
						}
						return offset - start
					}
				}
			}
		}
		if ch == '&' {
			if et := scanEntity(s, offset, end); et != 0 {
				if offset > segmentStart {
					out.push(Token(offset-segmentStart) | kHTMLRawText)
				}
				out.push(et)
				offset += tokLen(et)
				segmentStart = offset
				continue
			}
		}
		offset++
	}
	if offset > segmentStart {
		out.push(Token(offset-segmentStart) | kHTMLRawText)
	}
	return offset - start
}
