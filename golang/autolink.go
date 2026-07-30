package mixpad

// Autolinks: angle-bracket, bare http(s) URLs, www. and email (GFM). Faithful
// ports of the scan-autolink-*.js scanners.

func autolinkIsAlphaNum(ch byte) bool {
	return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
}

// scanAngleAutolink parses <scheme:...> or <email@host>.
func scanAngleAutolink(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '<' {
		return 0
	}
	pos := start + 1
	hasColon := false
	hasAt := false
	for pos < end {
		ch := s[pos]
		if ch == '>' {
			break
		}
		if ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '<' {
			return 0
		}
		if ch == ':' {
			hasColon = true
		}
		if ch == '@' {
			hasAt = true
		}
		pos++
	}
	if pos >= end || s[pos] != '>' {
		return 0
	}
	inner := pos - (start + 1)
	if inner == 0 || (!hasColon && !hasAt) {
		return 0
	}
	out.push(1 | kAngleLinkOpen)
	if hasAt && !hasColon {
		out.push(Token(inner) | kAngleLinkEmail)
	} else {
		out.push(Token(inner) | kAngleLinkURL)
	}
	out.push(1 | kAngleLinkClose)
	return pos + 1 - start
}

func scanRawURLAutolink(s string, start, end int) Token {
	if start < 0 || start >= end {
		return 0
	}
	offset := start
	isHttp := false
	isHttps := false
	if offset+7 <= end && s[offset] == 'h' && s[offset+1] == 't' && s[offset+2] == 't' &&
		s[offset+3] == 'p' && s[offset+4] == ':' && s[offset+5] == '/' && s[offset+6] == '/' {
		isHttp = true
		offset += 7
	} else if offset+8 <= end && s[offset] == 'h' && s[offset+1] == 't' && s[offset+2] == 't' &&
		s[offset+3] == 'p' && s[offset+4] == 's' && s[offset+5] == ':' && s[offset+6] == '/' && s[offset+7] == '/' {
		isHttps = true
		offset += 8
	}
	if !isHttp && !isHttps {
		return 0
	}
	if offset >= end {
		return 0
	}
	parenDepth := 0
	lastGood := offset
	hasDomainDot := false
	for offset < end {
		ch := s[offset]
		if ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '<' || ch == '&' {
			break
		}
		if ch == '(' {
			parenDepth++
			lastGood = offset + 1
			offset++
			continue
		}
		if ch == ')' {
			parenDepth--
			if parenDepth < 0 {
				break
			}
			lastGood = offset + 1
			offset++
			continue
		}
		if ch == '.' {
			hasDomainDot = true
		}
		trailing := ch == '.' || ch == ',' || ch == ':' || ch == ';' || ch == '!' || ch == '?'
		if !trailing {
			lastGood = offset + 1
		}
		offset++
	}
	finalOffset := lastGood
	contentLength := finalOffset - start
	minLen := 7
	if isHttps {
		minLen = 8
	}
	if contentLength <= minLen || !hasDomainDot {
		return 0
	}
	return Token(contentLength) | kRawURL
}

func scanWWWAutolink(s string, start, end int, prevCharCode byte) Token {
	if start < 0 || start >= end {
		return 0
	}
	if prevCharCode != 0 && autolinkIsAlphaNum(prevCharCode) {
		return 0
	}
	if start+4 > end {
		return 0
	}
	c0, c1, c2, c3 := s[start], s[start+1], s[start+2], s[start+3]
	if (c0 != 'w' && c0 != 'W') || (c1 != 'w' && c1 != 'W') || (c2 != 'w' && c2 != 'W') || c3 != '.' {
		return 0
	}
	offset := start + 4
	if offset >= end {
		return 0
	}
	parenDepth := 0
	lastGood := offset
	hasDomainDot := false
	for offset < end {
		ch := s[offset]
		if ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '<' || ch == '&' {
			break
		}
		if ch == '(' {
			parenDepth++
			lastGood = offset + 1
			offset++
			continue
		}
		if ch == ')' {
			parenDepth--
			if parenDepth < 0 {
				break
			}
			lastGood = offset + 1
			offset++
			continue
		}
		if ch == '.' {
			hasDomainDot = true
		}
		trailing := ch == '.' || ch == ',' || ch == ':' || ch == ';' || ch == '!' || ch == '?'
		if !trailing {
			lastGood = offset + 1
		}
		offset++
	}
	contentLength := lastGood - start
	if contentLength <= 4 || !hasDomainDot {
		return 0
	}
	return Token(contentLength) | kWWWAutolink
}

// scanEmailAutolink scans backwards from '@' to validate a bare email. Returns
// the token and the start offset of the local part (before '@'), or 0 length.
func scanEmailAutolink(s string, atPos, lineStart, end int) (Token, int) {
	if atPos < 0 || atPos >= end || s[atPos] != '@' {
		return 0, atPos
	}
	localStart := atPos - 1
	if localStart < lineStart {
		return 0, atPos
	}
	if localStart > lineStart {
		prev := s[localStart-1]
		if autolinkIsAlphaNum(prev) || prev == '-' {
			return 0, atPos
		}
	}
	for localStart >= lineStart {
		ch := s[localStart]
		special := ch == '.' || ch == '-' || ch == '_' || ch == '+'
		if !autolinkIsAlphaNum(ch) && !special {
			break
		}
		localStart--
	}
	localStart++
	if localStart >= atPos {
		return 0, atPos
	}
	for i := localStart; i < atPos; i++ {
		ch := s[i]
		special := ch == '.' || ch == '-' || ch == '_' || ch == '+'
		if !autolinkIsAlphaNum(ch) && !special {
			return 0, atPos
		}
	}
	offset := atPos + 1
	if offset >= end {
		return 0, atPos
	}
	hasDot := false
	domainEnd := offset
	for offset < end {
		ch := s[offset]
		isDot := ch == '.'
		isHyphen := ch == '-'
		if !autolinkIsAlphaNum(ch) && !isDot && !isHyphen {
			break
		}
		if isDot {
			hasDot = true
		}
		domainEnd = offset + 1
		offset++
	}
	if domainEnd <= atPos+1 || !hasDot {
		return 0, atPos
	}
	if domainEnd < end {
		nc := s[domainEnd]
		if autolinkIsAlphaNum(nc) || nc == '-' || nc == '_' {
			return 0, atPos
		}
	}
	if s[domainEnd-1] == '-' {
		return 0, atPos
	}
	totalLength := domainEnd - localStart
	return Token(totalLength) | kEmailAutolink, localStart
}
