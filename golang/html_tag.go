package mixpad

// First-class HTML tag scanning: open/close/self-closing tags with attributes,
// namespaces, quoted/unquoted values, entities and percent-encoding, plus the
// heuristic error-recovery MixPad uses to keep malformed HTML from derailing the
// document. Faithful port of scan-html-tag.js.

func matchesTagName(s string, start, length int, expected string) bool {
	if length != len(expected) {
		return false
	}
	for i := 0; i < length; i++ {
		ch := s[start+i]
		exp := expected[i]
		if ch != exp && ch != exp-32 {
			return false
		}
	}
	return true
}

func isVoidElement(s string, start, length int) bool {
	switch length {
	case 2:
		return matchesTagName(s, start, length, "br") || matchesTagName(s, start, length, "hr")
	case 3:
		return matchesTagName(s, start, length, "col") || matchesTagName(s, start, length, "img") ||
			matchesTagName(s, start, length, "wbr")
	case 4:
		return matchesTagName(s, start, length, "area") || matchesTagName(s, start, length, "base") ||
			matchesTagName(s, start, length, "link") || matchesTagName(s, start, length, "meta")
	case 5:
		return matchesTagName(s, start, length, "embed") || matchesTagName(s, start, length, "input") ||
			matchesTagName(s, start, length, "param") || matchesTagName(s, start, length, "track")
	case 6:
		return matchesTagName(s, start, length, "source")
	}
	return false
}

func isRawTextElement(s string, start, length int) bool {
	switch length {
	case 5:
		return matchesTagName(s, start, length, "style")
	case 6:
		return matchesTagName(s, start, length, "script")
	case 8:
		return matchesTagName(s, start, length, "textarea")
	}
	return false
}

func isHexDigit(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')
}

func scanHTMLTag(s string, start, end int, out *tokBuf) int {
	if s[start] != '<' {
		return 0
	}
	offset := start + 1
	if offset >= end {
		out.push(1 | kHTMLTagOpen)
		return 1
	}
	isClosing := s[offset] == '/'
	if isClosing {
		offset++
		if offset >= end {
			return 0
		}
	}
	tagNameStart := offset
	firstCh := s[offset]
	if !((firstCh >= 'A' && firstCh <= 'Z') || (firstCh >= 'a' && firstCh <= 'z')) {
		if !isClosing {
			out.push(1 | kHTMLTagOpen)
			return 1
		}
		return 0
	}
	offset++
	for offset < end {
		ch := s[offset]
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
			ch == '-' || ch == ':' {
			offset++
		} else {
			break
		}
	}
	tagNameLength := offset - tagNameStart
	if tagNameLength == 0 {
		return 0
	}

	openTokenIndex := out.len()
	if isClosing {
		out.push(2 | kHTMLTagOpen)
	} else {
		out.push(1 | kHTMLTagOpen)
	}
	out.push(Token(tagNameLength) | kHTMLTagName)

	if isClosing {
		wsStart := offset
		hasNewline := false
		for offset < end {
			ch := s[offset]
			if ch == 9 || ch == 32 || ch == 10 || ch == 13 {
				if ch == 10 || ch == 13 {
					hasNewline = true
				}
				offset++
			} else {
				break
			}
		}
		if offset > wsStart {
			out.push(Token(offset-wsStart) | kWhitespace)
		}
		if offset < end && s[offset] == '>' {
			if hasNewline {
				out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
				out.push(1 | kHTMLTagClose | ErrorUnbalancedFlag)
			} else {
				out.push(1 | kHTMLTagClose)
			}
			return offset - start + 1
		}
		out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
		return offset - start
	}

	hasError := false
	prevWasNewlineOrWs := false
	for offset < end {
		wsStart := offset
		wsHasNewline := false
		for offset < end {
			ch := s[offset]
			if ch == 9 || ch == 32 || ch == 10 || ch == 13 {
				if ch == 10 || ch == 13 {
					if prevWasNewlineOrWs {
						if offset > wsStart {
							out.push(Token(offset-wsStart) | kWhitespace)
						}
						out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
						return offset - start
					}
					wsHasNewline = true
				}
				offset++
			} else {
				break
			}
		}
		if offset > wsStart {
			out.push(Token(offset-wsStart) | kWhitespace)
		}
		prevWasNewlineOrWs = wsHasNewline

		if offset >= end {
			out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
			break
		}
		ch := s[offset]
		if ch == '<' {
			out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
			return offset - start
		}
		if ch == '>' {
			out.push(1 | kHTMLTagClose)
			return offset - start + 1
		}
		if ch == '/' && offset+1 < end && s[offset+1] == '>' {
			out.push(2 | kHTMLTagSelfClosing)
			return offset - start + 2
		}
		prevWasNewlineOrWs = false

		attrNameStart := offset
		firstAttr := s[offset]
		if !((firstAttr >= 'A' && firstAttr <= 'Z') || (firstAttr >= 'a' && firstAttr <= 'z') ||
			firstAttr == '_' || firstAttr == ':') {
			hasError = true
			break
		}
		offset++
		colonPos := -1
		for offset < end {
			ac := s[offset]
			if (ac >= 'A' && ac <= 'Z') || (ac >= 'a' && ac <= 'z') || (ac >= '0' && ac <= '9') ||
				ac == '-' || ac == '_' || ac == '.' {
				offset++
			} else if ac == ':' && colonPos == -1 {
				colonPos = offset
				offset++
			} else {
				break
			}
		}
		if colonPos != -1 {
			prefixLen := colonPos - attrNameStart
			if prefixLen > 0 {
				out.push(Token(prefixLen) | kHTMLAttrName)
			}
			out.push(1 | kHTMLAttrColon)
			localLen := offset - colonPos - 1
			if localLen > 0 {
				out.push(Token(localLen) | kHTMLAttrName)
			}
		} else {
			out.push(Token(offset-attrNameStart) | kHTMLAttrName)
		}

		ws2 := offset
		for offset < end {
			c := s[offset]
			if c == 9 || c == 32 || c == 10 || c == 13 {
				offset++
			} else {
				break
			}
		}
		if offset > ws2 {
			out.push(Token(offset-ws2) | kWhitespace)
		}
		if offset >= end {
			break
		}
		if s[offset] != '=' {
			continue
		}
		out.push(1 | kHTMLAttrEquals)
		offset++
		ws3 := offset
		for offset < end {
			c := s[offset]
			if c == 9 || c == 32 || c == 10 || c == 13 {
				offset++
			} else {
				break
			}
		}
		if offset > ws3 {
			out.push(Token(offset-ws3) | kWhitespace)
		}
		if offset >= end {
			break
		}
		quoteCh := s[offset]
		if quoteCh == '"' || quoteCh == '\'' {
			out.push(1 | kHTMLAttrQuote)
			offset++
			attrPrevWsNl := false
			for offset < end {
				valCh := s[offset]
				if valCh == quoteCh {
					out.push(1 | kHTMLAttrQuote)
					offset++
					break
				}
				if valCh == 10 || valCh == 13 {
					if attrPrevWsNl {
						out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
						return offset - start
					}
					wsS := offset
					if valCh == 13 && offset+1 < end && s[offset+1] == 10 {
						offset += 2
					} else {
						offset++
					}
					out.push(Token(offset-wsS) | kWhitespace)
					attrPrevWsNl = true
					continue
				}
				if valCh == '<' {
					out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
					return offset - start
				}
				if valCh == '>' {
					out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
					return offset - start
				}
				if valCh != 32 && valCh != 9 {
					attrPrevWsNl = false
				}
				if valCh == '&' {
					if et := scanEntity(s, offset, end); et != 0 {
						out.push(et)
						offset += int(et & lengthMask)
						continue
					}
				}
				textStart := offset
				for offset < end {
					c := s[offset]
					if c == quoteCh || c == '&' || c == 10 || c == 13 || c == '<' || c == '>' {
						break
					}
					if c == '%' && offset+2 < end && isHexDigit(s[offset+1]) && isHexDigit(s[offset+2]) {
						break
					}
					offset++
				}
				if offset > textStart {
					out.push(Token(offset-textStart) | kHTMLAttrValue)
				}
				if offset < end && s[offset] == '%' && offset+2 < end && isHexDigit(s[offset+1]) && isHexDigit(s[offset+2]) {
					out.push(3 | kPercentEncoding)
					offset += 3
				}
				if offset < end && s[offset] == '&' {
					if et := scanEntity(s, offset, end); et != 0 {
						out.push(et)
						offset += int(et & lengthMask)
					}
				}
			}
			if offset >= end && (offset == 0 || s[offset-1] != quoteCh) {
				out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
				hasError = true
			}
		} else {
			valueStart := offset
			for offset < end {
				c := s[offset]
				if c == 9 || c == 32 || c == 10 || c == 13 || c == '<' || c == '>' ||
					c == '"' || c == '\'' || c == '=' || c == '`' {
					break
				}
				offset++
			}
			if offset > valueStart {
				out.push(Token(offset-valueStart) | kHTMLAttrValue)
			}
		}
	}

	if hasError || offset >= end {
		out.setAt(openTokenIndex, out.at(openTokenIndex)|ErrorUnbalancedFlag)
		return offset - start
	}
	return offset - start
}
