package mixpad

// Phase 2: the semantic scanner. It drives scan0 chunk by chunk, then pairs
// emphasis/strong/strikethrough delimiters (CommonMark mod-3 rule) and
// link/image markers over the compact token stream, finally coalescing text.
// All working state lives in reusable slices — no per-token allocation.

const (
	delimCanOpen  = 0x01
	delimCanClose = 0x02
	delimKindMask = 0x03FF0000
)

type semanticState struct {
	input string

	provisional tokBuf

	// delimiter catalog (SoA)
	delimsData      []Token
	delimsProvIdx   []int
	delimsRemaining []int

	matchOpenerDi []int
	matchCloserDi []int
	matchUsedLen  []int
	openerStackDi []int

	linkOpenerStack  []int
	linkMatches      []int // 4 ints per match: open, close, destOpen, destClose
	isMatchedLinkTok []bool
	openerIndicesBuf []int
}

// semanticScan runs the full two-phase pipeline over s and returns final tokens.
func semanticScan(s string) []Token {
	st := &semanticState{input: s}
	out := &tokBuf{}
	pos := 0
	end := len(s)

	for pos < end {
		st.provisional.reset()
		chunkStart := pos

		for pos < end {
			prevLen := st.provisional.len()
			count := scan0(s, pos, end, &st.provisional)
			if count == 0 {
				pos++
				continue
			}
			addedLen := 0
			chunkEnd := false
			for i := prevLen; i < st.provisional.len(); i++ {
				tok := st.provisional.at(i)
				kind := tokKind(tok)
				addedLen += tokLen(tok)
				if kind == kNewLine && i > 0 && tokKind(st.provisional.at(i-1)) == kNewLine {
					chunkEnd = true
				} else if kind == kFencedOpen || kind == kThematicBreak {
					chunkEnd = true
				}
			}
			pos += addedLen
			if addedLen == 0 {
				pos++
			}
			if chunkEnd {
				break
			}
		}

		if st.provisional.len() > 0 {
			st.processChunk(out, chunkStart)
		}
	}

	return out.data
}

func (st *semanticState) processChunk(out *tokBuf, chunkStartOffset int) {
	input := st.input
	pb := &st.provisional

	st.delimsData = st.delimsData[:0]
	st.delimsProvIdx = st.delimsProvIdx[:0]
	st.delimsRemaining = st.delimsRemaining[:0]

	// Phase 1: catalog delimiters, compute flanking.
	inputPos := chunkStartOffset
	for i := 0; i < pb.len(); i++ {
		tok := pb.at(i)
		kind := tokKind(tok)
		length := tokLen(tok)
		originalFlags := tokFlags(tok)

		if kind == kAsteriskDelim || kind == kUnderscoreDelim || kind == kTildeDelim {
			before := byte(0)
			if inputPos > 0 {
				before = input[inputPos-1]
			}
			after := byte(0)
			if inputPos+length < len(input) {
				after = input[inputPos+length]
			}
			canOpen := isLeftFlanking(before, after)
			canClose := isRightFlanking(before, after)
			if kind == kUnderscoreDelim && canOpen && canClose {
				canOpen = isPunctuation(before) || before == 0
				canClose = isPunctuation(after) || after == 0
			}
			data := kind | originalFlags
			if canOpen {
				data |= delimCanOpen
			}
			if canClose {
				data |= delimCanClose
			}
			st.delimsData = append(st.delimsData, data)
			st.delimsProvIdx = append(st.delimsProvIdx, i)
			st.delimsRemaining = append(st.delimsRemaining, length)
		}
		inputPos += length
	}

	// Phase 2: stack-based matching (mod-3 rule).
	st.matchOpenerDi = st.matchOpenerDi[:0]
	st.matchCloserDi = st.matchCloserDi[:0]
	st.matchUsedLen = st.matchUsedLen[:0]
	st.openerStackDi = st.openerStackDi[:0]

	for di := 0; di < len(st.delimsData); di++ {
		data := st.delimsData[di]
		if data&delimCanClose != 0 {
			kind := data & delimKindMask
			si := len(st.openerStackDi) - 1
			for si >= 0 && st.delimsRemaining[di] > 0 {
				odi := st.openerStackDi[si]
				odata := st.delimsData[odi]
				if (odata&delimKindMask) == kind && (odata&delimCanOpen != 0) {
					opLen := tokLen(pb.at(st.delimsProvIdx[odi]))
					clLen := tokLen(pb.at(st.delimsProvIdx[di]))
					if (opLen+clLen)%3 == 0 && opLen%3 != 0 && clLen%3 != 0 {
						si--
						continue
					}
					useLen := 1
					if st.delimsRemaining[odi] >= 2 && st.delimsRemaining[di] >= 2 {
						useLen = 2
					}
					st.matchOpenerDi = append(st.matchOpenerDi, odi)
					st.matchCloserDi = append(st.matchCloserDi, di)
					st.matchUsedLen = append(st.matchUsedLen, useLen)
					st.delimsRemaining[odi] -= useLen
					st.delimsRemaining[di] -= useLen
					if st.delimsRemaining[odi] == 0 {
						st.openerStackDi = append(st.openerStackDi[:si], st.openerStackDi[si+1:]...)
					}
					si = len(st.openerStackDi) - 1
				} else {
					si--
				}
			}
		}
		if (st.delimsData[di]&delimCanOpen != 0) && st.delimsRemaining[di] > 0 {
			st.openerStackDi = append(st.openerStackDi, di)
		}
	}

	// Phase 2.5: link and image pairing.
	st.linkOpenerStack = st.linkOpenerStack[:0]
	st.linkMatches = st.linkMatches[:0]
	if cap(st.isMatchedLinkTok) < pb.len() {
		st.isMatchedLinkTok = make([]bool, pb.len())
	} else {
		st.isMatchedLinkTok = st.isMatchedLinkTok[:pb.len()]
		for i := range st.isMatchedLinkTok {
			st.isMatchedLinkTok[i] = false
		}
	}

	for i := 0; i < pb.len(); i++ {
		kind := tokKind(pb.at(i))
		if kind == kLinkOpen {
			st.linkOpenerStack = append(st.linkOpenerStack, i)
		} else if kind == kLinkClose {
			if len(st.linkOpenerStack) > 0 {
				openIdx := st.linkOpenerStack[len(st.linkOpenerStack)-1]
				st.linkOpenerStack = st.linkOpenerStack[:len(st.linkOpenerStack)-1]
				hasDest := false
				destOpenIdx := -1
				destCloseIdx := -1
				if i+1 < pb.len() && tokKind(pb.at(i+1)) == kLinkDestOpen {
					destOpenIdx = i + 1
					for j := destOpenIdx + 1; j < pb.len(); j++ {
						if tokKind(pb.at(j)) == kLinkDestClose {
							destCloseIdx = j
							hasDest = true
							break
						} else if tokKind(pb.at(j)) == kNewLine {
							break
						}
					}
				}
				if hasDest {
					st.linkMatches = append(st.linkMatches, openIdx, i, destOpenIdx, destCloseIdx)
				}
			}
		}
	}

	nMatches := len(st.linkMatches) / 4
	isContained := make([]bool, nMatches)
	for m1 := 0; m1 < len(st.linkMatches); m1 += 4 {
		start1 := st.linkMatches[m1]
		end1 := st.linkMatches[m1+3]
		for m2 := 0; m2 < len(st.linkMatches); m2 += 4 {
			if m1 != m2 {
				start2 := st.linkMatches[m2]
				end2 := st.linkMatches[m2+3]
				if start1 <= start2 && end1 >= end2 {
					isContained[m2/4] = true
				}
			}
		}
	}
	for m := 0; m < len(st.linkMatches); m += 4 {
		if !isContained[m/4] {
			startIdx := st.linkMatches[m]
			closeIdx := st.linkMatches[m+1]
			destOpenIdx := st.linkMatches[m+2]
			destCloseIdx := st.linkMatches[m+3]
			st.isMatchedLinkTok[startIdx] = true
			st.isMatchedLinkTok[closeIdx] = true
			st.isMatchedLinkTok[destOpenIdx] = true
			st.isMatchedLinkTok[destCloseIdx] = true
			if startIdx > 0 && tokKind(pb.at(startIdx-1)) == kImageMarker {
				st.isMatchedLinkTok[startIdx-1] = true
			}
		}
	}

	// Phase 3: emission + coalescing.
	nextDiIdx := 0
	for i := 0; i < pb.len(); i++ {
		tok := pb.at(i)
		kind := tokKind(tok)
		length := tokLen(tok)
		flags := tokFlags(tok)

		if nextDiIdx < len(st.delimsProvIdx) && st.delimsProvIdx[nextDiIdx] == i {
			di := nextDiIdx
			nextDiIdx++
			st.emitDelimiterTokens(di, out)
			inputPos += length
			continue
		}

		isDemotedLink := (kind == kLinkOpen || kind == kLinkClose || kind == kLinkDestOpen ||
			kind == kLinkDestClose || kind == kImageMarker) && !st.isMatchedLinkTok[i]

		if kind == kInlineText || isDemotedLink {
			if out.len() > 1 && kind == kInlineText && length == 1 {
				last := out.last()
				lastKind := tokKind(last)
				lastLen := tokLen(last)
				prevKind := tokKind(out.at(out.len() - 2))
				if lastKind == kWhitespace && prevKind == kInlineText && lastLen == 1 &&
					inputPos > 0 && st.input[inputPos-1] == ' ' {
					out.setAt(out.len()-2, out.at(out.len()-2)+2)
					out.pop()
				}
			}
			pushInlineText(out, length, flags)
		} else {
			out.push(tok)
		}
		inputPos += length
	}
}

func (st *semanticState) emitDelimiterTokens(di int, out *tokBuf) {
	data := st.delimsData[di]
	kind := data & delimKindMask
	currentFlags := data

	// close events
	for mi := 0; mi < len(st.matchOpenerDi); mi++ {
		if st.matchCloserDi[mi] == di {
			ul := st.matchUsedLen[mi]
			var closeKind Token
			if kind == kTildeDelim {
				closeKind = kStrikethroughClose
			} else if ul == 2 {
				closeKind = kStrongClose
			} else {
				closeKind = kEmphasisClose
			}
			out.push(closeKind | Token(ul) | (currentFlags & IsSafeReparsePoint))
			currentFlags &^= IsSafeReparsePoint
		}
	}

	// middle text
	if st.delimsRemaining[di] > 0 {
		pushInlineText(out, st.delimsRemaining[di], currentFlags)
		currentFlags &^= IsSafeReparsePoint
	}

	// open events (reverse order)
	st.openerIndicesBuf = st.openerIndicesBuf[:0]
	for mi := 0; mi < len(st.matchOpenerDi); mi++ {
		if st.matchOpenerDi[mi] == di {
			st.openerIndicesBuf = append(st.openerIndicesBuf, mi)
		}
	}
	for i := len(st.openerIndicesBuf) - 1; i >= 0; i-- {
		mi := st.openerIndicesBuf[i]
		ul := st.matchUsedLen[mi]
		var openKind Token
		if kind == kTildeDelim {
			openKind = kStrikethroughOpen
		} else if ul == 2 {
			openKind = kStrongOpen
		} else {
			openKind = kEmphasisOpen
		}
		out.push(openKind | Token(ul) | (currentFlags & IsSafeReparsePoint))
		currentFlags &^= IsSafeReparsePoint
	}
}

func pushInlineText(out *tokBuf, length int, flags Token) {
	if out.len() > 0 && tokKind(out.last()) == kInlineText {
		out.setAt(out.len()-1, out.last()+Token(length))
	} else {
		out.push(kInlineText | Token(length) | (flags & IsSafeReparsePoint))
	}
}

func isLeftFlanking(before, after byte) bool {
	if isWhitespace(after) || after == 0 {
		return false
	}
	if !isPunctuation(after) {
		return true
	}
	return isWhitespace(before) || before == 0 || isPunctuation(before)
}

func isRightFlanking(before, after byte) bool {
	if isWhitespace(before) || before == 0 {
		return false
	}
	if !isPunctuation(before) {
		return true
	}
	return isWhitespace(after) || after == 0 || isPunctuation(after)
}
