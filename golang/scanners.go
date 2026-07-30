package mixpad

// tokBuf is a growing buffer of packed tokens — the append-only sink shared by
// scan0 and its scanners, mirroring MixPad's `output` array.
type tokBuf struct{ data []Token }

func (b *tokBuf) push(t Token)         { b.data = append(b.data, t) }
func (b *tokBuf) len() int             { return len(b.data) }
func (b *tokBuf) at(i int) Token       { return b.data[i] }
func (b *tokBuf) setAt(i int, t Token) { b.data[i] = t }
func (b *tokBuf) pop()                 { b.data = b.data[:len(b.data)-1] }
func (b *tokBuf) last() Token          { return b.data[len(b.data)-1] }
func (b *tokBuf) reset()               { b.data = b.data[:0] }

// ---------------------------------------------------------------------------
// Inline text / escapes / entities
// ---------------------------------------------------------------------------

func scanInlineText(s string, offset, end int, out *tokBuf) int {
	if out.len() > 1 {
		last := out.last()
		lastKind := tokKind(last)
		lastLen := tokLen(last)
		prevKind := tokKind(out.at(out.len() - 2))
		if lastKind == kWhitespace && prevKind == kInlineText && lastLen == 1 &&
			offset > 0 && s[offset-1] == ' ' {
			out.setAt(out.len()-2, out.at(out.len()-2)+2)
			out.pop()
			return 1
		}
	}
	if out.len() > 0 && tokKind(out.last()) == kInlineText {
		out.setAt(out.len()-1, out.last()+1)
		return 1
	}
	out.push(kInlineText | 1)
	return 1
}

func scanEscaped(s string, start, end int) Token {
	if start < 0 || start >= end || s[start] != '\\' {
		return 0
	}
	if start+1 >= end {
		return kEscaped | 1
	}
	return kEscaped | 2
}

func scanEntity(s string, start, end int) Token {
	if start < 0 || start >= end || s[start] != '&' {
		return 0
	}
	offset := start + 1
	if offset >= end {
		return 0
	}
	ch := s[offset]

	if ch == '#' { // numeric
		offset++
		if offset >= end {
			return 0
		}
		isHex := false
		cc := s[offset]
		if cc == 'x' || cc == 'X' {
			isHex = true
			offset++
			if offset >= end {
				return 0
			}
		}
		digitsStart := offset
		for offset < end {
			d := s[offset]
			if isHex {
				if !((d >= '0' && d <= '9') || (d >= 'A' && d <= 'F') || (d >= 'a' && d <= 'f')) {
					break
				}
			} else if !(d >= '0' && d <= '9') {
				break
			}
			offset++
		}
		if offset == digitsStart {
			return 0
		}
		if offset < end && s[offset] == ';' {
			length := offset - start + 1
			if isHex {
				return Token(length) | kEntityHex
			}
			return Token(length) | kEntityDecimal
		}
		return 0
	}

	// named: &name;
	if !isAsciiAlpha(ch) {
		return 0
	}
	nameStart := offset
	for offset < end {
		c := s[offset]
		if isAsciiAlphaNum(c) {
			offset++
		} else {
			break
		}
	}
	if offset < end && s[offset] == ';' {
		name := s[nameStart:offset]
		if entityWithSemi[name+";"] || entityLegacy[name] {
			return Token(offset-start+1) | kEntityNamed
		}
	}
	return 0
}

// ---------------------------------------------------------------------------
// Emphasis delimiters (*, _, ~)
// ---------------------------------------------------------------------------

func scanEmphasis(s string, start, end int, out *tokBuf) int {
	if start < 0 || start >= end {
		return 0
	}
	first := s[start]
	if first != '*' && first != '_' && first != '~' {
		return 0
	}
	run := 1
	for start+run < end && s[start+run] == first {
		run++
	}
	if first == '~' && run < 2 {
		return 0
	}
	before := charAt(s, start-1)
	after := charAt(s, start+run)
	if isWhitespace(before) && isWhitespace(after) {
		return 0
	}
	if first == '_' && isAsciiAlphaNum(before) && isAsciiAlphaNum(after) {
		if out.len() > 0 && tokKind(out.last()) == kInlineText {
			return 0
		}
	}
	var kind Token
	switch first {
	case '*':
		kind = kAsteriskDelim
	case '_':
		kind = kUnderscoreDelim
	default:
		kind = kTildeDelim
	}
	out.push(Token(run) | kind)
	return run
}

// ---------------------------------------------------------------------------
// Inline code (backtick runs)
// ---------------------------------------------------------------------------

func scanBacktickOpen(s string, start, end int) Token {
	if start < 0 || start >= end || s[start] != '`' {
		return 0
	}
	offset := start + 1
	for offset < end && s[offset] == '`' {
		offset++
	}
	return kBacktickBoundary | Token(offset-start)
}

func scanInlineCode(s string, start, end, openN int) Token {
	runLen := 0
	fallback := -1
	for pos := start; pos < end; pos++ {
		ch := s[pos]
		if ch == '`' {
			if fallback < 0 {
				fallback = pos - start
			}
			runLen++
			if runLen == openN {
				total := pos + 1 - openN - start
				return kInlineCode | Token(total)
			}
		} else {
			runLen = 0
			if ch == '\n' || ch == '\r' {
				if fallback < 0 {
					fallback = pos
				}
			}
		}
	}
	if fallback < 0 {
		fallback = 0
	}
	return kInlineCode | ErrorUnbalancedFlag | Token(fallback)
}

func scanBacktickInline(s string, startOffset, endOffset int, out *tokBuf) int {
	openTok := scanBacktickOpen(s, startOffset, endOffset)
	if openTok == 0 {
		return 0
	}
	openLen := int(openTok & lengthMask)
	inlineTok := scanInlineCode(s, startOffset+openLen, endOffset, openLen)

	if inlineTok&ErrorUnbalancedFlag != 0 {
		inlineLen := int(inlineTok & lengthMask)
		closingTryStart := startOffset + openLen + inlineLen
		closingTok := scanBacktickOpen(s, closingTryStart, endOffset)
		if closingTok != 0 {
			out.push(openTok | ErrorUnbalancedFlag)
			out.push(inlineTok)
			out.push(closingTok | ErrorUnbalancedFlag)
			return openLen + inlineLen + int(closingTok&lengthMask)
		}
		out.push(openTok | ErrorUnbalancedFlag)
		out.push(inlineTok)
		return openLen + inlineLen
	}

	inlineLen := int(inlineTok & lengthMask)
	out.push(openTok)
	out.push(inlineTok)
	out.push(kBacktickBoundary | Token(openLen))
	return openLen + inlineLen + openLen
}

// ---------------------------------------------------------------------------
// Fenced code blocks
// ---------------------------------------------------------------------------

func scanFencedBlock(s string, startOffset, endOffset int, out *tokBuf) int {
	if startOffset >= endOffset {
		return 0
	}
	fenceChar := s[startOffset]
	if fenceChar != '`' && fenceChar != '~' {
		return 0
	}
	lineStart := findLineStart(s, startOffset)
	if startOffset-lineStart > 3 {
		return 0
	}
	pos := startOffset
	openLen := 0
	for pos < endOffset && s[pos] == fenceChar {
		openLen++
		pos++
	}
	if openLen < 3 {
		return 0
	}
	infoPos := pos
	for infoPos < endOffset {
		ch := s[infoPos]
		if ch == '\n' || ch == '\r' {
			break
		}
		infoPos++
	}
	contentStart := pos
	if infoPos < endOffset {
		ch := s[infoPos]
		if ch == '\r' && infoPos+1 < endOffset && s[infoPos+1] == '\n' {
			contentStart = infoPos + 2
		} else if ch == '\n' || ch == '\r' {
			contentStart = infoPos + 1
		} else {
			contentStart = pos
		}
	}

	p := infoPos
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
		if linePos < endOffset && s[linePos] == fenceChar {
			closeLen := 0
			fencePos := linePos
			for fencePos < endOffset && s[fencePos] == fenceChar {
				closeLen++
				fencePos++
			}
			if closeLen >= openLen {
				valid := true
				checkPos := fencePos
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
					out.push(kFencedOpen | Token(openTokenLen))
					if contentLength > 0 {
						out.push(kFencedContent | Token(contentLength))
					}
					out.push(kFencedClose | Token(closeTokenLen))
					return closeLineEnd - startOffset
				}
			}
		}
	}

	contentLength := endOffset - contentStart
	out.push(kFencedOpen | ErrorUnbalancedFlag | Token(openLen))
	if contentLength > 0 {
		out.push(kFencedContent | ErrorUnbalancedFlag | Token(contentLength))
	}
	return endOffset - startOffset
}

// ---------------------------------------------------------------------------
// ATX headings
// ---------------------------------------------------------------------------

func scanATXHeading(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '#' {
		return 0
	}
	lineStart := findLineStart(s, start)
	lineIndent := countIndentation(s, lineStart, start)
	if lineIndent > 3 || lineStart+lineIndent != start {
		return 0
	}
	hashCount := 0
	pos := start
	for pos < end && s[pos] == '#' && hashCount < 7 {
		hashCount++
		pos++
	}
	if hashCount > 6 {
		return 0
	}
	if pos < end {
		ch := s[pos]
		if ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r' {
			return 0
		}
	}
	depth := hashCount
	depthBits := Token(depth&0x7) << headDepthShf

	lineEnd := pos
	for lineEnd < end {
		ch := s[lineEnd]
		if ch == '\n' || ch == '\r' {
			break
		}
		lineEnd++
	}

	out.push(Token(hashCount) | kATXHeadingOpen | depthBits)

	wsStart := pos
	for pos < end && (s[pos] == ' ' || s[pos] == '\t') {
		pos++
	}
	if pos > wsStart {
		out.push(Token(pos-wsStart) | kWhitespace | depthBits)
	}
	contentStart := pos
	contentEnd := lineEnd
	for contentEnd > contentStart && (s[contentEnd-1] == ' ' || s[contentEnd-1] == '\t') {
		contentEnd--
	}
	closingStart := -1
	closingEnd := -1
	if contentEnd > contentStart && s[contentEnd-1] == '#' {
		hashStart := contentEnd - 1
		for hashStart > contentStart && s[hashStart-1] == '#' {
			hashStart--
		}
		if hashStart == contentStart || s[hashStart-1] == ' ' || s[hashStart-1] == '\t' {
			closingStart = hashStart
			closingEnd = contentEnd
			contentEnd = hashStart
			for contentEnd > contentStart && (s[contentEnd-1] == ' ' || s[contentEnd-1] == '\t') {
				contentEnd--
			}
		}
	}
	if contentEnd > contentStart {
		out.push(Token(contentEnd-contentStart) | kInlineText | depthBits)
	}
	if closingStart >= 0 && closingStart > contentEnd {
		out.push(Token(closingStart-contentEnd) | kWhitespace | depthBits)
	}
	if closingStart >= 0 {
		out.push(Token(closingEnd-closingStart) | kATXHeadingClose | depthBits)
	}

	consumed := lineEnd - start
	if lineEnd < end {
		ch := s[lineEnd]
		if ch == '\r' && lineEnd+1 < end && s[lineEnd+1] == '\n' {
			consumed += 2
		} else if ch == '\n' || ch == '\r' {
			consumed++
		}
	}
	return consumed
}

// ---------------------------------------------------------------------------
// Setext underline detection
// ---------------------------------------------------------------------------

type setextResult struct {
	valid             bool
	depth             int
	consumedLength    int
	underlineTokenLen int
}

func checkSetextUnderline(s string, underlineStart, end int) setextResult {
	if underlineStart >= end {
		return setextResult{}
	}
	lineStart := findLineStart(s, underlineStart)
	lineIndent := countIndentation(s, lineStart, underlineStart)
	if lineIndent > 3 || lineStart+lineIndent != underlineStart {
		return setextResult{}
	}
	first := s[underlineStart]
	if first != '=' && first != '-' {
		return setextResult{}
	}
	pos := underlineStart
	for pos < end && s[pos] == first {
		pos++
	}
	for pos < end && (s[pos] == ' ' || s[pos] == '\t') {
		pos++
	}
	ch := charAt(s, pos)
	if ch != 0 && ch != '\n' && ch != '\r' {
		return setextResult{}
	}
	consumed := pos - lineStart
	underlineTokenLen := pos - underlineStart
	if ch == '\r' && pos+1 < end && s[pos+1] == '\n' {
		consumed += 2
	} else if ch == '\n' || ch == '\r' {
		consumed++
	}
	depth := 2
	if first == '=' {
		depth = 1
	}
	return setextResult{true, depth, consumed, underlineTokenLen}
}

// ---------------------------------------------------------------------------
// Thematic break
// ---------------------------------------------------------------------------

func scanThematicBreak(s string, start, end int, out *tokBuf) int {
	if start >= end {
		return 0
	}
	first := s[start]
	if first != '*' && first != '-' && first != '_' {
		return 0
	}
	lineStart := findLineStart(s, start)
	lineIndent := countIndentation(s, lineStart, start)
	if lineIndent > 3 || lineStart+lineIndent != start {
		return 0
	}
	offset := start
	count := 0
	for offset < end {
		ch := s[offset]
		if ch == first {
			count++
			offset++
		} else if ch == ' ' || ch == '\t' {
			offset++
		} else if ch == '\n' || ch == '\r' {
			break
		} else {
			return 0
		}
	}
	if count < 3 {
		return 0
	}
	out.push(Token(offset-start) | kThematicBreak)
	return offset - start
}

// ---------------------------------------------------------------------------
// Blockquote
// ---------------------------------------------------------------------------

func scanBlockquote(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '>' {
		return 0
	}
	lineStart := findLineStart(s, start)
	lineIndent := countIndentation(s, lineStart, start)
	if lineIndent > 3 {
		return 0
	}
	i := lineStart + lineIndent
	for i < start {
		ch := s[i]
		if ch != '>' && ch != ' ' {
			return 0
		}
		i++
	}
	out.push(1 | kBlockquoteMarker)
	return 1
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

func scanBulletListMarker(s string, start, end int, out *tokBuf) int {
	if start >= end {
		return 0
	}
	ch := s[start]
	if ch != '-' && ch != '*' && ch != '+' {
		return 0
	}
	lineStart := findLineStart(s, start)
	lineIndent := countIndentation(s, lineStart, start)
	if lineIndent > 3 || lineStart+lineIndent != start {
		return 0
	}
	if start+1 >= end {
		return 0
	}
	next := s[start+1]
	if next != ' ' && next != '\t' {
		return 0
	}
	var markerBits Token
	switch ch {
	case '-':
		markerBits = 0 << 28
	case '*':
		markerBits = 1 << 28
	case '+':
		markerBits = 2 << 28
	}
	out.push(1 | kBulletListMarker | markerBits)
	return 1
}

func scanOrderedListMarker(s string, start, end int, out *tokBuf) int {
	if start >= end {
		return 0
	}
	lineStart := findLineStart(s, start)
	lineIndent := countIndentation(s, lineStart, start)
	if lineIndent > 3 || lineStart+lineIndent != start {
		return 0
	}
	offset := start
	digitCount := 0
	for offset < end && digitCount < 9 {
		if isDigit(s[offset]) {
			digitCount++
			offset++
		} else {
			break
		}
	}
	if digitCount == 0 {
		return 0
	}
	if offset >= end {
		return 0
	}
	delim := s[offset]
	if delim != '.' && delim != ')' {
		return 0
	}
	offset++
	if offset >= end {
		return 0
	}
	next := s[offset]
	if next != ' ' && next != '\t' {
		return 0
	}
	length := offset - start
	var delimBit Token
	if delim == ')' {
		delimBit = 1 << 28
	}
	out.push(Token(length) | kOrderedListMarker | delimBit)
	return length
}

func scanTaskListMarker(s string, start, end int, out *tokBuf) int {
	// [ ] or [x] or [X], must be followed by space/tab.
	if start+3 >= end || s[start] != '[' {
		return 0
	}
	mid := s[start+1]
	checked := mid == 'x' || mid == 'X'
	if !checked && mid != ' ' {
		return 0
	}
	if s[start+2] != ']' {
		return 0
	}
	next := s[start+3]
	if next != ' ' && next != '\t' {
		return 0
	}
	var checkedBit Token
	if checked {
		checkedBit = 1 << 28
	}
	out.push(3 | kTaskListMarker | checkedBit)
	return 3
}

// ---------------------------------------------------------------------------
// Links / images (single-character markers)
// ---------------------------------------------------------------------------

func scanLinkOpen(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '[' {
		return 0
	}
	out.push(1 | kLinkOpen)
	return 1
}

func scanLinkClose(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != ']' {
		return 0
	}
	out.push(1 | kLinkClose)
	return 1
}

func scanImageMarker(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '!' {
		return 0
	}
	if start+1 >= end || s[start+1] != '[' {
		return 0
	}
	out.push(1 | kImageMarker)
	return 1
}

func scanLinkDestOpen(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '(' {
		return 0
	}
	out.push(1 | kLinkDestOpen)
	return 1
}

func scanLinkDestClose(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != ')' {
		return 0
	}
	out.push(1 | kLinkDestClose)
	return 1
}

// ---------------------------------------------------------------------------
// Table pipe
// ---------------------------------------------------------------------------

func scanTablePipe(s string, start, end int, out *tokBuf) int {
	if start >= end || s[start] != '|' {
		return 0
	}
	out.push(1 | kTablePipe)
	return 1
}
