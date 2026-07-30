package mixpad

// Character classification helpers operating on bytes. MixPad's structural
// grammar is ASCII, so byte-wise scanning is both faithful and fast; multi-byte
// UTF-8 sequences fall through to InlineText and are coalesced.

func isAsciiAlpha(ch byte) bool {
	return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
}

func isAsciiAlphaNum(ch byte) bool {
	return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')
}

func isDigit(ch byte) bool { return ch >= '0' && ch <= '9' }

// isWhitespace matches ASCII whitespace (0 boundary sentinel included).
func isWhitespace(ch byte) bool {
	switch ch {
	case 0, 9, 10, 13, 32, 11, 12:
		return true
	}
	return false
}

// isPunctuation matches ASCII punctuation (0 boundary is not punctuation).
func isPunctuation(ch byte) bool {
	if ch == 0 {
		return false
	}
	return (ch >= 33 && ch <= 47) ||
		(ch >= 58 && ch <= 64) ||
		(ch >= 91 && ch <= 96) ||
		(ch >= 123 && ch <= 126)
}

// findLineStart scans back to the character following the previous newline.
func findLineStart(s string, pos int) int {
	for pos > 0 {
		ch := s[pos-1]
		if ch == '\n' || ch == '\r' {
			return pos
		}
		pos--
	}
	return 0
}

// countIndentation counts spaces/tabs from lineStart to pos (tab -> next mult of 4).
func countIndentation(s string, lineStart, pos int) int {
	indent := 0
	for i := lineStart; i < pos; i++ {
		ch := s[i]
		if ch == 32 {
			indent++
		} else if ch == 9 {
			indent = (indent + 4) &^ 3
		} else {
			break
		}
	}
	return indent
}

// charAt returns the byte at i, or 0 when out of bounds (mirrors charCodeAt sentinel).
func charAt(s string, i int) byte {
	if i < 0 || i >= len(s) {
		return 0
	}
	return s[i]
}
