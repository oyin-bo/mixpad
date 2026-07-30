package mixpad

// Front matter (YAML ---, TOML +++, JSON {...}) at document start. Type is
// stored in bits 26-27 of the tokens. Faithful port of scan-frontmatter.js.

const (
	fmYAML = 0
	fmTOML = 1
	fmJSON = 2
)

func scanFrontmatter(s string, startOffset, endOffset int, out *tokBuf) int {
	if startOffset != 0 || startOffset >= endOffset {
		return 0
	}
	switch s[startOffset] {
	case '-':
		return scanDelimitedFrontmatter(s, startOffset, endOffset, out, '-', fmYAML)
	case '+':
		return scanDelimitedFrontmatter(s, startOffset, endOffset, out, '+', fmTOML)
	case '{':
		return scanJSONFrontmatter(s, startOffset, endOffset, out)
	}
	return 0
}

func scanDelimitedFrontmatter(s string, startOffset, endOffset int, out *tokBuf, delim byte, typ int) int {
	if startOffset+3 > endOffset {
		return 0
	}
	if s[startOffset] != delim || s[startOffset+1] != delim || s[startOffset+2] != delim {
		return 0
	}
	pos := startOffset + 3
	if pos < endOffset {
		nc := s[pos]
		if nc == '\n' {
			pos++
		} else if nc == '\r' {
			pos++
			if pos < endOffset && s[pos] == '\n' {
				pos++
			}
		} else if nc == ' ' || nc == '\t' {
			for pos < endOffset {
				ch := s[pos]
				if ch == '\n' || ch == '\r' {
					break
				}
				if ch != ' ' && ch != '\t' {
					return 0
				}
				pos++
			}
			if pos < endOffset {
				ch := s[pos]
				if ch == '\r' {
					pos++
					if pos < endOffset && s[pos] == '\n' {
						pos++
					}
				} else if ch == '\n' {
					pos++
				}
			}
		} else {
			return 0
		}
	}
	typeBits := Token(typ&0x3) << 26
	out.push(kFrontmatterOpen | typeBits | Token(pos-startOffset))
	contentStart := pos
	for pos < endOffset {
		lineStart := pos
		if pos+3 <= endOffset && s[pos] == delim && s[pos+1] == delim && s[pos+2] == delim {
			closerEnd := pos + 3
			validCloser := true
			if closerEnd < endOffset {
				nc := s[closerEnd]
				if nc == '\n' {
					closerEnd++
				} else if nc == '\r' {
					closerEnd++
					if closerEnd < endOffset && s[closerEnd] == '\n' {
						closerEnd++
					}
				} else if nc == ' ' || nc == '\t' {
					for closerEnd < endOffset {
						ch := s[closerEnd]
						if ch == '\n' || ch == '\r' {
							break
						}
						if ch != ' ' && ch != '\t' {
							validCloser = false
							break
						}
						closerEnd++
					}
					if validCloser && closerEnd < endOffset {
						ch := s[closerEnd]
						if ch == '\r' {
							closerEnd++
							if closerEnd < endOffset && s[closerEnd] == '\n' {
								closerEnd++
							}
						} else if ch == '\n' {
							closerEnd++
						}
					}
				} else {
					validCloser = false
				}
			}
			if validCloser {
				contentEnd := lineStart
				if contentEnd > contentStart {
					out.push(kFrontmatterContent | typeBits | Token(contentEnd-contentStart))
				}
				out.push(kFrontmatterClose | typeBits | Token(closerEnd-lineStart))
				return closerEnd - startOffset
			}
		}
		for pos < endOffset {
			ch := s[pos]
			pos++
			if ch == '\n' {
				break
			}
			if ch == '\r' {
				if pos < endOffset && s[pos] == '\n' {
					pos++
				}
				break
			}
		}
	}
	if endOffset > contentStart {
		out.push(kFrontmatterContent | typeBits | Token(endOffset-contentStart) | ErrorUnbalancedFlag)
	}
	return endOffset - startOffset
}

func scanJSONFrontmatter(s string, startOffset, endOffset int, out *tokBuf) int {
	if s[startOffset] != '{' {
		return 0
	}
	typeBits := Token(fmJSON&0x3) << 26
	pos := startOffset + 1
	out.push(kFrontmatterOpen | typeBits | 1)
	braceDepth := 1
	contentStart := pos
	inString := false
	escapeNext := false
	for pos < endOffset && braceDepth > 0 {
		ch := s[pos]
		if escapeNext {
			escapeNext = false
			pos++
			continue
		}
		if ch == '\\' && inString {
			escapeNext = true
			pos++
			continue
		}
		if ch == '"' {
			inString = !inString
			pos++
			continue
		}
		if !inString {
			if ch == '{' {
				braceDepth++
			} else if ch == '}' {
				braceDepth--
				if braceDepth == 0 {
					contentEnd := pos
					if contentEnd > contentStart {
						out.push(kFrontmatterContent | typeBits | Token(contentEnd-contentStart))
					}
					pos++
					out.push(kFrontmatterClose | typeBits | 1)
					return pos - startOffset
				}
			}
		}
		pos++
	}
	if endOffset > contentStart {
		out.push(kFrontmatterContent | typeBits | Token(endOffset-contentStart) | ErrorUnbalancedFlag)
	}
	return endOffset - startOffset
}
