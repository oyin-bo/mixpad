package mixpad

// Display-math formula blocks delimited by $$ (or longer runs). Faithful port of
// scan-formula.js, mirroring the fenced-code scanning strategy.

func scanFormulaBlock(s string, startOffset, endOffset int, out *tokBuf) int {
	if startOffset >= endOffset {
		return 0
	}
	if s[startOffset] != '$' {
		return 0
	}
	lineStart := findLineStart(s, startOffset)
	if startOffset-lineStart > 3 {
		return 0
	}
	pos := startOffset
	openLen := 0
	for pos < endOffset && s[pos] == '$' {
		openLen++
		pos++
	}
	if openLen < 2 {
		return 0
	}
	contentStart := pos
	if pos < endOffset {
		ch := s[pos]
		if ch == '\r' && pos+1 < endOffset && s[pos+1] == '\n' {
			contentStart = pos + 2
		} else if ch == '\n' || ch == '\r' {
			contentStart = pos + 1
		}
	}
	p := pos
	for p < endOffset {
		newlinePos := -1
		for p < endOffset {
			ch := s[p]
			if ch == '\n' || ch == '\r' {
				newlinePos = p
				if ch == '\r' && p+1 < endOffset && s[p+1] == '\n' {
					p += 2
				} else {
					p++
				}
				break
			}
			p++
		}
		if p >= endOffset {
			break
		}
		linePos := p
		spaces := 0
		for linePos < endOffset && s[linePos] == ' ' && spaces < 3 {
			spaces++
			linePos++
		}
		if linePos < endOffset && s[linePos] == '$' {
			closeLen := 0
			dollarPos := linePos
			for dollarPos < endOffset && s[dollarPos] == '$' {
				closeLen++
				dollarPos++
			}
			if closeLen >= openLen {
				valid := true
				checkPos := dollarPos
				for checkPos < endOffset {
					nc := s[checkPos]
					if nc == '\n' || nc == '\r' {
						break
					}
					if nc != ' ' && nc != '\t' {
						valid = false
						break
					}
					checkPos++
				}
				if valid {
					openTokenLen := contentStart - startOffset
					contentLength := newlinePos + 1 - contentStart
					closeLineEnd := checkPos
					if checkPos < endOffset {
						nc := s[checkPos]
						if nc == '\r' && checkPos+1 < endOffset && s[checkPos+1] == '\n' {
							closeLineEnd = checkPos + 2
						} else if nc == '\n' || nc == '\r' {
							closeLineEnd = checkPos + 1
						}
					}
					closeTokenLen := closeLineEnd - linePos
					out.push(kFormulaOpen | Token(openTokenLen))
					out.push(kFormulaContent | Token(contentLength))
					out.push(kFormulaClose | Token(closeTokenLen))
					return closeLineEnd - startOffset
				}
			}
		}
	}
	openTokenLen := contentStart - startOffset
	out.push(kFormulaOpen | ErrorUnbalancedFlag | Token(openTokenLen))
	out.push(kFormulaContent | ErrorUnbalancedFlag | Token(endOffset-contentStart))
	return endOffset - startOffset
}
