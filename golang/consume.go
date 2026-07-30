package mixpad

// consumeChunk streams the full semantic token array into the AST. Faithful port
// of ASTBuilder.consumeChunk, with two natural-expectation refinements over the
// JS reference: fenced-code openers are captured as the info/language span (not
// emitted as body text), and bare www. autolinks produce Autolink nodes.
func (b *astBuilder) consumeChunk(tokens []Token, startOffset int) {
	if len(tokens) == 0 {
		return
	}
	pos := startOffset
	tIdx := 0

	lineQuoteDepth := 0
	lineHasPipe := false
	inTableHeader := false
	currentLineHasContent := false
	pendingWsStart := -1
	pendingImage := false

	flushPendingWs := func(uptoPos int) {
		if pendingWsStart == -1 {
			return
		}
		b.appendText(pendingWsStart, uptoPos)
		pendingWsStart = -1
	}

	for ; tIdx < len(tokens); tIdx++ {
		token := tokens[tIdx]
		kind := tokKind(token)
		length := tokLen(token)
		nextPos := pos + length
		activeBlock := b.activeBlock()

		if kind != kNewLine && kind != kWhitespace {
			currentLineHasContent = true
		}

		switch kind {
		case kBulletListMarker, kOrderedListMarker, kTaskListMarker, kBlockquoteMarker,
			kTablePipe, kATXHeadingOpen, kATXHeadingClose, kFencedOpen, kThematicBreak,
			kFrontmatterOpen, kFormulaOpen:
			pendingWsStart = -1
		}

		if kind == kNewLine {
			if !currentLineHasContent && b.kindOf(activeBlock) == KindParagraph {
				b.popBlock()
				pendingWsStart = -1
				activeBlock = b.activeBlock()
			}
			currentLineHasContent = false
			lineQuoteDepth = 0
			lineHasPipe = false

			for len(b.inlineStack) > 0 {
				top := b.inlineStack[len(b.inlineStack)-1]
				k := b.kindOf(top)
				if k == KindEmphasis || k == KindStrong || k == KindStrikethrough {
					b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
					b.d.Nodes[top].End = int32(pos)
				} else {
					break
				}
			}

			if b.kindOf(activeBlock) == KindTableCell {
				b.trimCellTrailingWhitespace(activeBlock)
				b.popBlock()
				activeBlock = b.activeBlock()
			}
			if b.kindOf(activeBlock) == KindTableRow {
				closedRow := activeBlock
				b.popBlock()
				activeBlock = b.activeBlock()
				if inTableHeader {
					inTableHeader = false
					pos = b.consumeDelimiterRow(tokens, tIdx, nextPos, closedRow)
					tIdx = b.resumeIndex
					b.extendAncestors(pos)
					continue
				}
				peekTIdx := tIdx + 1
				if peekTIdx >= len(tokens) || !b.lineHasPipe(tokens, peekTIdx) {
					if b.kindOf(b.activeBlock()) == KindTable {
						b.popBlock()
					}
				}
				b.extendAncestors(nextPos)
				pos = nextPos
				continue
			}
			if b.kindOf(activeBlock) == KindHeading {
				b.popBlock()
			}
		} else if kind == kThematicBreak {
			if b.kindOf(activeBlock) == KindParagraph {
				b.popBlock()
			}
			tb := b.newNode(KindThematicBreak, pos)
			b.d.Nodes[tb].End = int32(nextPos)
			b.appendChild(tb)
			activeBlock = b.activeBlock()
		}

		// Setext underline retroactively promotes the open paragraph to a heading
		// (natural expectation; the JS reference drops the underline).
		if kind == kSetextHeadingUnderline {
			if b.kindOf(activeBlock) == KindParagraph {
				b.d.Nodes[activeBlock].Kind = KindHeading
				b.d.Nodes[activeBlock].Level = uint8(headingDepth(token))
				b.d.Nodes[activeBlock].End = int32(nextPos)
				b.popBlock()
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		}

		if kind == kBulletListMarker || kind == kOrderedListMarker {
			b.openListItem(tokens, tIdx, pos, kind == kOrderedListMarker)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kTaskListMarker {
			// Mark the enclosing list item as a task (natural expectation).
			for i := len(b.blockStack) - 1; i >= 0; i-- {
				if b.kindOf(b.blockStack[i]) == KindListItem {
					b.d.Nodes[b.blockStack[i]].Checked = token&0x10000000 != 0
					break
				}
			}
			pendingWsStart = -1
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kBlockquoteMarker {
			if b.kindOf(activeBlock) == KindParagraph {
				b.popBlock()
				activeBlock = b.activeBlock()
			}
			lineQuoteDepth++
			existingQuoteDepth := 0
			for _, idx := range b.blockStack {
				if b.kindOf(idx) == KindBlockquote {
					existingQuoteDepth++
				}
			}
			if lineQuoteDepth > existingQuoteDepth {
				bq := b.newNode(KindBlockquote, pos)
				b.pushBlock(bq)
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kTablePipe {
			if b.kindOf(activeBlock) == KindTableCell {
				b.trimCellTrailingWhitespace(activeBlock)
				b.popBlock()
				activeBlock = b.activeBlock()
			}
			if b.kindOf(activeBlock) == KindTableRow {
				lineHasPipe = true
				b.extendAncestors(nextPos)
				pos = nextPos
				continue
			}
			if b.kindOf(activeBlock) == KindTable {
				row := b.newNode(KindTableRow, pos)
				b.pushBlock(row)
				lineHasPipe = true
				b.extendAncestors(nextPos)
				pos = nextPos
				continue
			}
			if !lineHasPipe {
				curLineEndTIdx := tIdx + 1
				curLineEndPos := nextPos
				for curLineEndTIdx < len(tokens) && tokKind(tokens[curLineEndTIdx]) != kNewLine {
					curLineEndPos += tokLen(tokens[curLineEndTIdx])
					curLineEndTIdx++
				}
				nextLineTIdx := curLineEndTIdx + 1
				nextLinePos := curLineEndPos
				if curLineEndTIdx < len(tokens) {
					nextLinePos += tokLen(tokens[curLineEndTIdx])
				}
				if nextLineTIdx < len(tokens) && b.isDelimiterLine(tokens, nextLineTIdx, nextLinePos) {
					if b.kindOf(activeBlock) == KindParagraph {
						b.popBlock()
					}
					tableNode := b.newNode(KindTable, pos)
					b.pushBlock(tableNode)
					headerRow := b.newNode(KindTableRow, pos)
					b.d.Nodes[headerRow].IsHeader = true
					b.pushBlock(headerRow)
					inTableHeader = true
					lineHasPipe = true
					b.extendAncestors(nextPos)
					pos = nextPos
					continue
				}
			}
			// Not a structural pipe — treat as inline text.
			curAb := b.activeBlock()
			if b.kindOf(curAb) == KindDocument || b.kindOf(curAb) == KindBlockquote {
				p := b.newNode(KindParagraph, pos)
				b.pushBlock(p)
			}
			b.appendText(pos, nextPos)
			lineHasPipe = true
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kATXHeadingOpen {
			if b.kindOf(activeBlock) == KindParagraph {
				b.popBlock()
			}
			h := b.newNode(KindHeading, pos)
			b.d.Nodes[h].Level = uint8(headingDepth(token))
			b.pushBlock(h)
			activeBlock = b.activeBlock()
			peekTIdx := tIdx + 1
			if peekTIdx < len(tokens) && tokKind(tokens[peekTIdx]) == kWhitespace {
				nextPos += tokLen(tokens[peekTIdx])
				tIdx = peekTIdx
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kFencedOpen {
			if b.kindOf(activeBlock) == KindParagraph {
				b.popBlock()
			}
			fc := b.newNode(KindFencedCodeBlock, pos)
			b.pushBlock(fc)
			// Capture info/language span from the opener (natural expectation).
			s := b.d.Src
			p := pos
			if p < nextPos {
				fcChar := s[p]
				for p < nextPos && s[p] == fcChar {
					p++
				}
			}
			infoStart := p
			infoEnd := p
			for infoEnd < nextPos && s[infoEnd] != '\n' && s[infoEnd] != '\r' {
				infoEnd++
			}
			b.d.Nodes[fc].InfoStart = int32(infoStart)
			b.d.Nodes[fc].InfoEnd = int32(infoEnd)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind != kNewLine && (b.kindOf(activeBlock) == KindDocument ||
			b.kindOf(activeBlock) == KindBlockquote ||
			(b.kindOf(activeBlock) == KindTable && kind != kWhitespace)) {
			if b.kindOf(activeBlock) == KindTable {
				row := b.newNode(KindTableRow, pos)
				b.pushBlock(row)
			} else if b.currentLineIsTableHeader(tokens, tIdx, pos) {
				tableNode := b.newNode(KindTable, pos)
				b.pushBlock(tableNode)
				headerRow := b.newNode(KindTableRow, pos)
				b.d.Nodes[headerRow].IsHeader = true
				b.pushBlock(headerRow)
				inTableHeader = true
			} else {
				p := b.newNode(KindParagraph, pos)
				b.pushBlock(p)
			}
			activeBlock = b.activeBlock()
		}

		// Fenced code content.
		if b.kindOf(b.activeBlock()) == KindFencedCodeBlock {
			if kind == kFencedClose {
				b.popBlock()
			} else {
				b.appendText(pos, nextPos)
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		}

		// Frontmatter content.
		if b.kindOf(b.activeBlock()) == KindFrontmatter {
			if kind == kFrontmatterClose {
				b.popBlock()
			} else {
				b.appendText(pos, nextPos)
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		}

		if kind == kFrontmatterOpen {
			fm := b.newNode(KindFrontmatter, pos)
			b.pushBlock(fm)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		} else if kind == kFormulaOpen {
			fb := b.newNode(KindFormulaBlock, pos)
			b.pushBlock(fb)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		}

		// Formula content.
		if b.kindOf(b.activeBlock()) == KindFormulaBlock {
			if kind == kFormulaClose {
				b.popBlock()
			} else {
				b.appendText(pos, nextPos)
			}
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		}

		// Inside a TableRow: skip padding whitespace; open a cell on first content.
		if curAb := b.activeBlock(); b.kindOf(curAb) == KindTableRow {
			if kind == kWhitespace {
				b.extendAncestors(nextPos)
				pos = nextPos
				continue
			} else if kind != kNewLine && kind != kTablePipe {
				cell := b.newNode(KindTableCell, pos)
				b.pushBlock(cell)
			}
		}

		if kind != kWhitespace && kind != kNewLine {
			flushPendingWs(pos)
		}

		switch kind {
		case kEmphasisOpen:
			em := b.newNode(KindEmphasis, pos)
			b.appendChild(em)
			b.inlineStack = append(b.inlineStack, em)
		case kEmphasisClose:
			if len(b.inlineStack) > 0 {
				top := b.inlineStack[len(b.inlineStack)-1]
				b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
				b.d.Nodes[top].End = int32(nextPos)
			}
		case kStrongOpen:
			st := b.newNode(KindStrong, pos)
			b.appendChild(st)
			b.inlineStack = append(b.inlineStack, st)
		case kStrongClose:
			if len(b.inlineStack) > 0 {
				top := b.inlineStack[len(b.inlineStack)-1]
				b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
				b.d.Nodes[top].End = int32(nextPos)
			}
		case kStrikethroughOpen:
			sk := b.newNode(KindStrikethrough, pos)
			b.appendChild(sk)
			b.inlineStack = append(b.inlineStack, sk)
		case kStrikethroughClose:
			if len(b.inlineStack) > 0 {
				top := b.inlineStack[len(b.inlineStack)-1]
				b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
				b.d.Nodes[top].End = int32(nextPos)
			}
		case kAngleLinkOpen:
			nextPos = b.buildAngleAutolink(tokens, tIdx, pos, length)
			tIdx = b.resumeIndex - 1
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kImageMarker:
			pendingImage = true
		case kLinkOpen:
			if pendingImage {
				pendingImage = false
				img := b.newNode(KindImage, pos-1)
				b.appendChild(img)
				b.inlineStack = append(b.inlineStack, img)
			} else {
				link := b.newNode(KindLink, pos)
				b.appendChild(link)
				b.inlineStack = append(b.inlineStack, link)
			}
		case kLinkClose:
			// awaiting destination
		case kLinkDestOpen:
			top := b.activeParent()
			if b.kindOf(top) == KindLink || b.kindOf(top) == KindImage {
				b.d.Nodes[top].DestStart = int32(nextPos)
			}
		case kLinkDestClose:
			if len(b.inlineStack) > 0 {
				top := b.inlineStack[len(b.inlineStack)-1]
				b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
				if b.kindOf(top) == KindLink || b.kindOf(top) == KindImage {
					b.d.Nodes[top].DestEnd = int32(pos)
					b.d.Nodes[top].End = int32(nextPos)
				}
			}
		case kRawURL, kEmailAutolink, kWWWAutolink:
			a := b.newNode(KindAutolink, pos)
			b.d.Nodes[a].End = int32(nextPos)
			b.d.Nodes[a].DestStart = int32(pos)
			b.d.Nodes[a].DestEnd = int32(nextPos)
			b.appendChild(a)
		case kInlineCode:
			code := b.newNode(KindInlineCode, pos)
			b.d.Nodes[code].End = int32(nextPos)
			b.appendChild(code)
		case kWhitespace, kNewLine:
			parent := b.activeParent()
			if b.kindOf(parent) == KindDocument || b.kindOf(parent) == KindBlockquote {
				break
			}
			if pendingWsStart == -1 {
				pendingWsStart = pos
			}
		case kInlineText, kHTMLRawText, kEntityNamed, kEntityDecimal, kEntityHex:
			b.appendText(pos, nextPos)
		case kHTMLCommentOpen:
			node := b.newNode(KindHtmlComment, pos)
			tIdx = b.consumeUntil(tokens, tIdx, pos, kHTMLCommentClose, node) - 1
			nextPos = int(b.d.Nodes[node].End)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kHTMLCDataOpen:
			node := b.newNode(KindHtmlCData, pos)
			tIdx = b.consumeUntil(tokens, tIdx, pos, kHTMLCDataClose, node) - 1
			nextPos = int(b.d.Nodes[node].End)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kHTMLDocTypeOpen:
			node := b.newNode(KindHtmlDocType, pos)
			tIdx = b.consumeUntil(tokens, tIdx, pos, kHTMLDocTypeClose, node) - 1
			nextPos = int(b.d.Nodes[node].End)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kXMLPIOpen:
			node := b.newNode(KindXmlProcessingInstruction, pos)
			tIdx = b.consumeUntil(tokens, tIdx, pos, kXMLPIClose, node) - 1
			nextPos = int(b.d.Nodes[node].End)
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kHTMLTagOpen:
			nextPos = b.buildHtmlTag(tokens, tIdx, pos, length)
			tIdx = b.resumeIndex - 1
			b.extendAncestors(nextPos)
			pos = nextPos
			continue
		case kHTMLTagClose, kHTMLTagSelfClosing:
			b.appendText(pos, nextPos)
		}

		b.extendAncestors(nextPos)
		pos = nextPos
	}

	for len(b.inlineStack) > 0 {
		leftover := b.inlineStack[len(b.inlineStack)-1]
		b.inlineStack = b.inlineStack[:len(b.inlineStack)-1]
		b.d.Nodes[leftover].End = int32(pos)
	}

	_ = lineQuoteDepth
}
