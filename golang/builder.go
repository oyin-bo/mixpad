package mixpad

// astBuilder is a faithful port of ast/builder.js: a single streaming pass over
// the semantic token stream that maintains a block stack and an inline stack,
// handling headings, lists, blockquotes, tables, fenced/frontmatter/formula
// blocks, native HTML element nesting, and inline formatting.
type astBuilder struct {
	d           *Document
	blockStack  []int32
	inlineStack []int32
	resumeIndex int
}

func newASTBuilder(src string) *astBuilder {
	d := &Document{Src: src}
	d.Nodes = append(d.Nodes, Node{Kind: KindDocument, Start: 0, End: 0})
	return &astBuilder{d: d, blockStack: []int32{0}}
}

func (b *astBuilder) newNode(kind NodeKind, start int) int32 {
	b.d.Nodes = append(b.d.Nodes, Node{Kind: kind, Start: int32(start), End: int32(start)})
	return int32(len(b.d.Nodes) - 1)
}

func (b *astBuilder) kindOf(i int32) NodeKind { return b.d.Nodes[i].Kind }

func (b *astBuilder) activeParent() int32 {
	if len(b.inlineStack) > 0 {
		return b.inlineStack[len(b.inlineStack)-1]
	}
	return b.blockStack[len(b.blockStack)-1]
}

func (b *astBuilder) appendText(start, end int) {
	parent := b.activeParent()
	kids := b.d.Nodes[parent].Children
	if len(kids) > 0 && b.kindOf(kids[len(kids)-1]) == KindText {
		b.d.Nodes[kids[len(kids)-1]].End = int32(end)
	} else {
		t := b.newNode(KindText, start)
		b.d.Nodes[t].End = int32(end)
		b.appendChild(t)
	}
}

func (b *astBuilder) activeBlock() int32 { return b.blockStack[len(b.blockStack)-1] }

func (b *astBuilder) appendChild(child int32) {
	p := b.activeParent()
	b.d.Nodes[p].Children = append(b.d.Nodes[p].Children, child)
}

func (b *astBuilder) pushBlock(n int32) {
	b.appendChild(n)
	b.blockStack = append(b.blockStack, n)
}

func (b *astBuilder) popBlock() {
	b.blockStack = b.blockStack[:len(b.blockStack)-1]
}

func (b *astBuilder) extendAncestors(endPos int) {
	for _, idx := range b.blockStack {
		if b.d.Nodes[idx].End < int32(endPos) {
			b.d.Nodes[idx].End = int32(endPos)
		}
	}
}

func (b *astBuilder) lineHasPipe(tokens []Token, fromTIdx int) bool {
	for i := fromTIdx; i < len(tokens); i++ {
		k := tokKind(tokens[i])
		if k == kNewLine {
			break
		}
		if k == kTablePipe {
			return true
		}
	}
	return false
}

func (b *astBuilder) currentLineIsTableHeader(tokens []Token, fromTIdx, fromPos int) bool {
	pos := fromPos
	hasPipe := false
	newLineTIdx := -1
	newLinePos := pos
	for i := fromTIdx; i < len(tokens); i++ {
		k := tokKind(tokens[i])
		l := tokLen(tokens[i])
		if k == kNewLine {
			newLineTIdx = i
			newLinePos = pos
			break
		}
		if k == kTablePipe {
			hasPipe = true
		}
		pos += l
	}
	if !hasPipe || newLineTIdx == -1 {
		return false
	}
	nextLineTIdx := newLineTIdx + 1
	nextLinePos := newLinePos + tokLen(tokens[newLineTIdx])
	return nextLineTIdx < len(tokens) && b.isDelimiterLine(tokens, nextLineTIdx, nextLinePos)
}

func (b *astBuilder) isDelimiterLine(tokens []Token, fromTIdx, fromPos int) bool {
	pos := fromPos
	hasPipe := false
	cellCount := 0
	for i := fromTIdx; i < len(tokens); i++ {
		tok := tokens[i]
		k := tokKind(tok)
		l := tokLen(tok)
		if k == kNewLine {
			break
		}
		if k == kTablePipe {
			hasPipe = true
		} else if k == kInlineText {
			if !b.isDelimiterCell(pos, pos+l) {
				return false
			}
			cellCount++
		} else if k != kWhitespace {
			return false
		}
		pos += l
	}
	return hasPipe && cellCount > 0
}

func (b *astBuilder) isDelimiterCell(start, end int) bool {
	s := b.d.Src
	i, j := start, end
	for i < j && (s[i] == ' ' || s[i] == '\t') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t') {
		j--
	}
	if i >= j {
		return false
	}
	if s[i] == ':' {
		i++
	}
	if j > i && s[j-1] == ':' {
		j--
	}
	if i >= j {
		return false
	}
	for k := i; k < j; k++ {
		if s[k] != '-' {
			return false
		}
	}
	return (j - i) >= 3
}

func (b *astBuilder) delimiterAlign(start, end int) Alignment {
	s := b.d.Src
	i, j := start, end
	for i < j && (s[i] == ' ' || s[i] == '\t') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t') {
		j--
	}
	left := i < j && s[i] == ':'
	right := j > i && s[j-1] == ':'
	switch {
	case left && right:
		return AlignCenter
	case left:
		return AlignLeft
	case right:
		return AlignRight
	}
	return AlignNone
}

func (b *astBuilder) trimCellTrailingWhitespace(cell int32) {
	kids := b.d.Nodes[cell].Children
	if len(kids) == 0 {
		return
	}
	last := kids[len(kids)-1]
	if b.d.Nodes[last].Kind != KindText {
		return
	}
	s := b.d.Src[b.d.Nodes[last].Start:b.d.Nodes[last].End]
	trimmedLen := len(trimEnd(s))
	if trimmedLen == 0 {
		b.d.Nodes[cell].Children = kids[:len(kids)-1]
	} else {
		b.d.Nodes[last].End = b.d.Nodes[last].Start + int32(trimmedLen)
	}
}

func trimEnd(s string) string {
	j := len(s)
	for j > 0 && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\n' || s[j-1] == '\r') {
		j--
	}
	return s[:j]
}

func (b *astBuilder) consumeUntil(tokens []Token, tIdx, pos int, closeKind Token, node int32) int {
	idx := tIdx + 1
	currentPos := pos + tokLen(tokens[tIdx])
	for idx < len(tokens) {
		l := tokLen(tokens[idx])
		if tokKind(tokens[idx]) == closeKind {
			currentPos += l
			idx++
			break
		}
		currentPos += l
		idx++
	}
	b.d.Nodes[node].End = int32(currentPos)
	b.appendChild(node)
	return idx
}

func (b *astBuilder) openListItem(tokens []Token, tIdx, pos int, isOrdered bool) {
	activeBlock := b.activeBlock()
	if b.kindOf(activeBlock) == KindParagraph {
		b.popBlock()
		activeBlock = b.activeBlock()
	}
	currentIndent := int32(0)
	if tIdx > 0 && tokKind(tokens[tIdx-1]) == kWhitespace {
		currentIndent = int32(tokLen(tokens[tIdx-1]))
	}
	if b.kindOf(activeBlock) == KindListItem {
		parentIndent := b.d.Nodes[b.blockStack[len(b.blockStack)-2]].Indent
		if currentIndent > parentIndent {
			nl := b.newNode(KindList, pos)
			b.d.Nodes[nl].Ordered = isOrdered
			b.d.Nodes[nl].Indent = currentIndent
			b.pushBlock(nl)
			ni := b.newNode(KindListItem, pos)
			b.pushBlock(ni)
			return
		}
		if currentIndent < parentIndent {
			b.popBlock()
			for len(b.blockStack) > 0 {
				top := b.activeBlock()
				if b.kindOf(top) == KindList {
					if b.d.Nodes[top].Indent > currentIndent {
						b.popBlock()
						if b.kindOf(b.activeBlock()) == KindListItem {
							b.popBlock()
						}
					} else {
						break
					}
				} else if b.kindOf(top) == KindListItem {
					b.popBlock()
				} else {
					break
				}
			}
		} else {
			b.popBlock()
		}
		activeBlock = b.activeBlock()
	}
	if b.kindOf(activeBlock) != KindList {
		nl := b.newNode(KindList, pos)
		b.d.Nodes[nl].Ordered = isOrdered
		b.d.Nodes[nl].Indent = currentIndent
		b.pushBlock(nl)
	} else if b.d.Nodes[activeBlock].Ordered != isOrdered {
		b.popBlock()
		nl := b.newNode(KindList, pos)
		b.d.Nodes[nl].Ordered = isOrdered
		b.d.Nodes[nl].Indent = currentIndent
		b.pushBlock(nl)
	}
	ni := b.newNode(KindListItem, pos)
	b.pushBlock(ni)
}

func (b *astBuilder) buildHtmlTag(tokens []Token, tIdx, pos, openLen int) int {
	isClosingTag := openLen == 2
	tagName := ""
	tagNameStart := 0
	tagNameLen := 0
	selfClosing := false
	tagEndPos := -1
	var attributes []Attr
	idx := tIdx + 1
	currentPos := pos + openLen

	for idx < len(tokens) {
		k := tokKind(tokens[idx])
		l := tokLen(tokens[idx])
		switch k {
		case kHTMLTagName:
			tagNameStart = currentPos
			tagNameLen = l
			tagName = asciiLower(b.d.Src[currentPos : currentPos+l])
		case kHTMLTagClose:
			currentPos += l
			tagEndPos = currentPos
			idx++
			goto done
		case kHTMLTagSelfClosing:
			selfClosing = true
			currentPos += l
			tagEndPos = currentPos
			idx++
			goto done
		case kHTMLAttrName:
			attributes = append(attributes, Attr{Name: b.d.Src[currentPos : currentPos+l]})
		case kHTMLAttrValue:
			if len(attributes) > 0 {
				attributes[len(attributes)-1].Value = b.d.Src[currentPos : currentPos+l]
				attributes[len(attributes)-1].HasValue = true
			}
		case kHTMLAttrQuote, kHTMLAttrEquals, kHTMLAttrColon:
			if len(attributes) > 0 && !attributes[len(attributes)-1].HasValue {
				attributes[len(attributes)-1].Value = ""
				attributes[len(attributes)-1].HasValue = true
			}
		case kWhitespace:
			// ignore
		default:
			// Not an HTML tag token - stop here.
			goto done
		}
		currentPos += l
		idx++
	}
done:
	if tagEndPos == -1 {
		tagEndPos = currentPos
	}

	if isClosingTag {
		matchIndex := -1
		for i := len(b.blockStack) - 1; i >= 0; i-- {
			nd := b.blockStack[i]
			if b.kindOf(nd) == KindDocument {
				break
			}
			if b.kindOf(nd) == KindHtmlElement && b.d.Nodes[nd].TagName == tagName {
				matchIndex = i
				break
			}
		}
		if matchIndex != -1 {
			for len(b.blockStack) > matchIndex {
				popped := b.blockStack[len(b.blockStack)-1]
				b.blockStack = b.blockStack[:len(b.blockStack)-1]
				b.d.Nodes[popped].End = int32(tagEndPos)
			}
		} else {
			b.appendText(pos, tagEndPos)
		}
	} else {
		if tagName == "" {
			b.appendText(pos, tagEndPos)
		} else {
			el := b.newNode(KindHtmlElement, pos)
			b.d.Nodes[el].TagName = tagName
			b.d.Nodes[el].Attrs = attributes
			b.d.Nodes[el].End = int32(tagEndPos)
			b.appendChild(el)
			isVoid := tagNameLen > 0 && isVoidElement(b.d.Src, tagNameStart, tagNameLen)
			if !selfClosing && !isVoid {
				b.blockStack = append(b.blockStack, el)
			}
		}
	}
	b.resumeIndex = idx
	return tagEndPos
}

func (b *astBuilder) buildAngleAutolink(tokens []Token, tIdx, pos, openLen int) int {
	idx := tIdx + 1
	currentPos := pos + openLen
	for idx < len(tokens) {
		l := tokLen(tokens[idx])
		if tokKind(tokens[idx]) == kAngleLinkClose {
			currentPos += l
			idx++
			break
		}
		currentPos += l
		idx++
	}
	a := b.newNode(KindAutolink, pos)
	b.d.Nodes[a].End = int32(currentPos)
	b.d.Nodes[a].DestStart = int32(pos + 1)
	b.d.Nodes[a].DestEnd = int32(currentPos - 1)
	t := b.newNode(KindText, pos+1)
	b.d.Nodes[t].End = int32(currentPos - 1)
	b.d.Nodes[a].Children = []int32{t}
	b.appendChild(a)
	b.resumeIndex = idx
	return currentPos
}

func (b *astBuilder) consumeDelimiterRow(tokens []Token, tIdx, pos int, closedRow int32) int {
	tIdx++
	var alignments []Alignment
	sawCell := false
	curAlign := AlignNone
	for tIdx < len(tokens) {
		delimKind := tokKind(tokens[tIdx])
		delimLen := tokLen(tokens[tIdx])
		delimPos := pos
		pos += delimLen
		if delimKind == kNewLine {
			break
		}
		if delimKind == kTablePipe {
			if sawCell {
				alignments = append(alignments, curAlign)
				sawCell = false
				curAlign = AlignNone
			}
		} else if delimKind == kInlineText {
			sawCell = true
			curAlign = b.delimiterAlign(delimPos, delimPos+delimLen)
		}
		tIdx++
	}
	if sawCell {
		alignments = append(alignments, curAlign)
	}
	cells := b.d.Nodes[closedRow].Children
	ci := 0
	for i := 0; i < len(cells); i++ {
		if b.kindOf(cells[i]) != KindTableCell {
			continue
		}
		if ci < len(alignments) && alignments[ci] != AlignNone {
			b.d.Nodes[cells[i]].Align = alignments[ci]
		}
		ci++
	}
	peekTIdx := tIdx + 1
	if peekTIdx >= len(tokens) || !b.lineHasPipe(tokens, peekTIdx) {
		if b.kindOf(b.activeBlock()) == KindTable {
			b.popBlock()
		}
	}
	b.resumeIndex = tIdx
	return pos
}

func (b *astBuilder) finish() *Document {
	root := int32(0)
	if kids := b.d.Nodes[root].Children; len(kids) > 0 {
		last := kids[len(kids)-1]
		if b.d.Nodes[last].End > 0 {
			b.d.Nodes[root].End = b.d.Nodes[last].End
		}
	} else {
		b.d.Nodes[root].End = 0
	}
	return b.d
}

func asciiLower(s string) string {
	hasUpper := false
	for i := 0; i < len(s); i++ {
		if s[i] >= 'A' && s[i] <= 'Z' {
			hasUpper = true
			break
		}
	}
	if !hasUpper {
		return s
	}
	buf := []byte(s)
	for i := range buf {
		if buf[i] >= 'A' && buf[i] <= 'Z' {
			buf[i] += 32
		}
	}
	return string(buf)
}
