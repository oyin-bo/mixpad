// @ts-check

import { getHeadingDepth, getTokenKind, getTokenLength } from '../scan-core.js';
import { isVoidElement } from '../scan-html-tag.js';
import * as Tokens from '../scan-tokens.js';
import * as NodeTypes from './node-types.js';
import {
  AutolinkNode,
  BlockquoteNode,
  DocumentNode,
  EmphasisNode,
  FencedCodeBlockNode,
  FormulaBlockNode,
  FrontmatterNode,
  HeadingNode,
  HtmlCDataNode,
  HtmlCommentNode,
  HtmlDocTypeNode,
  HtmlElementNode,
  ImageNode,
  InlineCodeNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ParagraphNode,
  StrikethroughNode,
  StrongNode,
  TableCellNode,
  TableNode, TableRowNode,
  TextNode,
  ThematicBreakNode,
  XmlProcessingInstructionNode
} from './nodes.js';
import { ParseContext } from './parser.js';

/** @typedef {import('../scan0.js').ProvisionalToken} ProvisionalToken */
/** @typedef {import('./node.js').ASTNode} ASTNode */

/**
 * Builds the AST strictly by streaming semantic tokens.
 * Handles the 5 Phase chunk pipeline: Context Matching, Severance, Initiation, Container, and Inline Stream.
 */
export class ASTBuilder {
  /**
   * @param {string} sourceText 
   */
  constructor(sourceText) {
    this.context = new ParseContext(sourceText);
    /** @type {DocumentNode} */
    this.root = new DocumentNode(this.context, 0);
    /** @type {ASTNode[]} Cross-chunk tracking for block hierarchy */
    this.blockStack = [this.root];
    /** @type {ASTNode[]} Intra-chunk tracking for inline elements */
    this.inlineStack = [];
  }

  /** Gets the active node where new children should be mounted */
  _getActiveParent() {
    return this.inlineStack.length > 0
      ? this.inlineStack[this.inlineStack.length - 1]
      : this.blockStack[this.blockStack.length - 1];
  }

  /** Gets the top block container specifically */
  _getActiveBlock() {
    return this.blockStack[this.blockStack.length - 1];
  }

  /** @param {ASTNode} node */
  _append(node) {
    const parent = this._getActiveParent();
    if (!parent.children) parent.children = [];
    parent.children.push(node);
  }

  /** @param {ASTNode} node */
  _pushBlock(node) {
    this._append(node);
    this.blockStack.push(node);
  }

  /**
   * Extend the ends of all open ancestors to ensure the tree envelopes the content.
   * @param {number} endPos
   */
  _extendAncestors(endPos) {
    for (let i = 0; i < this.blockStack.length; i++) {
      if (this.blockStack[i].end < endPos) {
        this.blockStack[i].end = endPos;
      }
    }
  }

  /**
   * Check whether any token on the current line (up to the next NewLine) is a TablePipe.
   * @param {ProvisionalToken[]} tokens
   * @param {number} fromTIdx
   * @returns {boolean}
   */
  _lineHasPipe(tokens, fromTIdx) {
    for (let i = fromTIdx; i < tokens.length; i++) {
      const k = getTokenKind(tokens[i]);
      if (k === Tokens.NewLine) break;
      if (k === Tokens.TablePipe) return true;
    }
    return false;
  }

  /**
   * Check if the line starting at fromTIdx (which may begin with non-pipe content)
   * contains a TablePipe and is followed by a valid delimiter row.
   * Used to detect GFM tables that have no leading pipe on the header row.
   * @param {ProvisionalToken[]} tokens
   * @param {number} fromTIdx
   * @param {number} fromPos
   * @returns {boolean}
   */
  _currentLineIsTableHeader(tokens, fromTIdx, fromPos) {
    let pos = fromPos;
    let hasPipe = false;
    let newLineTIdx = -1;
    let newLinePos = pos;
    for (let i = fromTIdx; i < tokens.length; i++) {
      const k = getTokenKind(tokens[i]);
      const l = getTokenLength(tokens[i]);
      if (k === Tokens.NewLine) { newLineTIdx = i; newLinePos = pos; break; }
      if (k === Tokens.TablePipe) hasPipe = true;
      pos += l;
    }
    if (!hasPipe || newLineTIdx === -1) return false;
    const nextLineTIdx = newLineTIdx + 1;
    const nextLinePos = newLinePos + getTokenLength(tokens[newLineTIdx]);
    return nextLineTIdx < tokens.length && this._isDelimiterLine(tokens, nextLineTIdx, nextLinePos);
  }

  /**
   * Check if the token sequence from fromTIdx to the next NewLine is a valid
   * GFM table delimiter row (cells containing only :?-{3,}:? with optional whitespace).
   * @param {ProvisionalToken[]} tokens
   * @param {number} fromTIdx
   * @param {number} fromPos
   * @returns {boolean}
   */
  _isDelimiterLine(tokens, fromTIdx, fromPos) {
    let pos = fromPos;
    let hasPipe = false;
    let cellCount = 0;
    for (let i = fromTIdx; i < tokens.length; i++) {
      const tok = tokens[i];
      const k = getTokenKind(tok);
      const l = getTokenLength(tok);
      if (k === Tokens.NewLine) break;
      if (k === Tokens.TablePipe) {
        hasPipe = true;
      } else if (k === Tokens.InlineText) {
        if (!this._isDelimiterCell(pos, pos + l)) return false;
        cellCount++;
      } else if (k !== Tokens.Whitespace) {
        // Any other token type means this is not a pure delimiter row
        return false;
      }
      pos += l;
    }
    return hasPipe && cellCount > 0;
  }

  /**
   * Trim trailing whitespace from a container's last Text child.
   * @param {ASTNode} cell
   */
  _trimCellTrailingWhitespace(cell) {
    if (!cell.children || cell.children.length === 0) return;
    const last = cell.children[cell.children.length - 1];
    if (last.type !== NodeTypes.Text) return;
    const trimmedLen = this.context.sourceText.substring(last.start, last.end).trimEnd().length;
    if (trimmedLen === 0) cell.children.pop();
    else last.end = last.start + trimmedLen;
  }

  /**
   * Whether source span [start,end) is a GFM delimiter cell (:?-{3,}:? with optional
   * surrounding whitespace). Allocation-free: reads char codes over the delimited span.
   * @param {number} start
   * @param {number} end
   * @returns {boolean}
   */
  _isDelimiterCell(start, end) {
    const s = this.context.sourceText;
    let i = start, j = end;
    while (i < j && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
    while (j > i && (s.charCodeAt(j - 1) === 32 || s.charCodeAt(j - 1) === 9)) j--;
    if (i >= j) return false;
    if (s.charCodeAt(i) === 58) i++;
    if (j > i && s.charCodeAt(j - 1) === 58) j--;
    if (i >= j) return false;
    for (let k = i; k < j; k++) if (s.charCodeAt(k) !== 45) return false;
    return (j - i) >= 3;
  }

  /**
   * Alignment for a delimiter cell span, or null when unspecified. Allocation-free.
   * @param {number} start
   * @param {number} end
   * @returns {('left'|'center'|'right'|null)}
   */
  _delimiterAlign(start, end) {
    const s = this.context.sourceText;
    let i = start, j = end;
    while (i < j && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
    while (j > i && (s.charCodeAt(j - 1) === 32 || s.charCodeAt(j - 1) === 9)) j--;
    const left = i < j && s.charCodeAt(i) === 58;
    const right = j > i && s.charCodeAt(j - 1) === 58;
    return left && right ? 'center' : left ? 'left' : right ? 'right' : null;
  }

  /**
   * Consume tokens from the open token at tIdx until a matching close kind,
   * finalise `node` bounds, append it, and return the index just past the run.
   * @param {ProvisionalToken[]} tokens
   * @param {number} tIdx
   * @param {number} pos
   * @param {number} closeKind
   * @param {ASTNode} node
   * @returns {number} token index just past the consumed run
   */
  _consumeUntil(tokens, tIdx, pos, closeKind, node) {
    let idx = tIdx + 1;
    let currentPos = pos + getTokenLength(tokens[tIdx]);
    while (idx < tokens.length) {
      const l = getTokenLength(tokens[idx]);
      if (getTokenKind(tokens[idx]) === closeKind) { currentPos += l; idx++; break; }
      currentPos += l;
      idx++;
    }
    node.end = currentPos;
    this._append(node);
    return idx;
  }

  /**
   * Processes a chunk of semantic tokens (typically one line/paragraph)
   * 
   * @param {ProvisionalToken[]} tokens 
   * @param {number} startOffset 
   */
  consumeChunk(tokens, startOffset) {
    if (tokens.length === 0) return;

    let pos = startOffset;
    let tIdx = 0;

    // Phase 3 & 4: Inner Container Initiation and Resolution
    // (Deferred mostly to Inline Stream looping as we scan multiple kinds of blocks within single chunk stream)

    // Tracks how many BlockquoteMarker tokens have been seen on the current logical line.
    // Resets to 0 on every NewLine token.
    let lineQuoteDepth = 0;
    // Tracks whether a TablePipe has been seen on the current logical line.
    let lineHasPipe = false;
    // Tracks whether we are currently building the header row of a table.
    let inTableHeader = false;

    // Whether the current logical line produced inline content; a content-less
    // line is a blank line that terminates an open paragraph.
    let currentLineHasContent = false;

    // Start offset of buffered whitespace not yet committed to a Text node, or -1.
    // Interior whitespace is committed when inline content follows; trailing
    // whitespace is discarded at block and line boundaries.
    let pendingWsStart = -1;

    const flushPendingWs = (/** @type {number} */ uptoPos) => {
      if (pendingWsStart === -1) return;
      const parent = this._getActiveParent();
      const kids = parent.children;
      if (kids && kids.length > 0 && kids[kids.length - 1].type === NodeTypes.Text) {
        kids[kids.length - 1].end = uptoPos;
      } else {
        const t = new TextNode(this.context, pendingWsStart);
        t.end = uptoPos;
        this._append(t);
      }
      pendingWsStart = -1;
    };

    // Inline Stream Processing
    for (; tIdx < tokens.length; tIdx++) {
      const token = tokens[tIdx];
      const kind = getTokenKind(token);
      const len = getTokenLength(token);
      let nextPos = pos + len;

      let activeBlock = this._getActiveBlock();

      if (kind !== Tokens.NewLine && kind !== Tokens.Whitespace) currentLineHasContent = true;

      // Block boundaries discard any buffered trailing whitespace.
      if (kind === Tokens.BulletListMarker || kind === Tokens.OrderedListMarker ||
          kind === Tokens.TaskListMarker || kind === Tokens.BlockquoteMarker ||
          kind === Tokens.TablePipe || kind === Tokens.ATXHeadingOpen ||
          kind === Tokens.ATXHeadingClose || kind === Tokens.FencedOpen ||
          kind === Tokens.ThematicBreak || kind === Tokens.FrontmatterOpen ||
          kind === Tokens.FormulaOpen) {
        pendingWsStart = -1;
      }

      // Structural Break Introspection inside Stream
      if (kind === Tokens.NewLine) {
        // A blank line (no inline content) terminates an open paragraph.
        if (!currentLineHasContent && activeBlock.type === NodeTypes.Paragraph) {
          this.blockStack.pop();
          pendingWsStart = -1;
          activeBlock = this._getActiveBlock();
        }
        currentLineHasContent = false;

        lineQuoteDepth = 0;
        lineHasPipe = false;

        // Close any open inline stack items at row boundary
        while (this.inlineStack.length > 0) {
          const top = this.inlineStack[this.inlineStack.length - 1];
          if (top.type === NodeTypes.Emphasis || top.type === NodeTypes.Strong || top.type === NodeTypes.Strikethrough) {
            this.inlineStack.pop();
            top.end = pos;
          } else break;
        }

        // Table row/cell closing
        if (activeBlock.type === NodeTypes.TableCell) {
          this._trimCellTrailingWhitespace(activeBlock);
          this.blockStack.pop();
          activeBlock = this._getActiveBlock();
        }
        if (activeBlock.type === NodeTypes.TableRow) {
          const closedRow = activeBlock;
          this.blockStack.pop();
          activeBlock = this._getActiveBlock();
          if (inTableHeader) {
            inTableHeader = false;
            // Fast-forward through the delimiter row, mapping one alignment per cell.
            pos = nextPos;
            tIdx++;
            /** @type {('left' | 'center' | 'right' | null)[]} */
            const alignments = [];
            let sawCell = false;
            let curAlign = null;
            while (tIdx < tokens.length) {
              const delimKind = getTokenKind(tokens[tIdx]);
              const delimLen = getTokenLength(tokens[tIdx]);
              const delimPos = pos;
              pos += delimLen;
              if (delimKind === Tokens.NewLine) break;
              if (delimKind === Tokens.TablePipe) {
                if (sawCell) { alignments.push(curAlign); sawCell = false; curAlign = null; }
              } else if (delimKind === Tokens.InlineText) {
                sawCell = true;
                curAlign = this._delimiterAlign(delimPos, delimPos + delimLen);
              }
              tIdx++;
            }
            if (sawCell) alignments.push(curAlign);
            // Apply alignments to header cells positionally.
            const cells = closedRow.children || [];
            let ci = 0;
            for (let i = 0; i < cells.length; i++) {
              if (cells[i].type !== NodeTypes.TableCell) continue;
              if (alignments[ci]) cells[i].align = alignments[ci];
              ci++;
            }
            // Check if the next line continues the table
            const peekTIdx = tIdx + 1;
            if (peekTIdx >= tokens.length || !this._lineHasPipe(tokens, peekTIdx)) {
              if (this._getActiveBlock().type === NodeTypes.Table) this.blockStack.pop();
            }
            this._extendAncestors(pos);
            continue;
          } else {
            // Finished a data row — check if the next line continues the table
            const peekTIdx = tIdx + 1;
            if (peekTIdx >= tokens.length || !this._lineHasPipe(tokens, peekTIdx)) {
              if (this._getActiveBlock().type === NodeTypes.Table) this.blockStack.pop();
            }
            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
          }
        }

        if (activeBlock.type === NodeTypes.Heading) {
          this.blockStack.pop();
        }
      } else if (kind === Tokens.ThematicBreak) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        const breakNode = new ThematicBreakNode(this.context, pos);
        breakNode.end = nextPos;
        this._append(breakNode);
        activeBlock = this._getActiveBlock();
        // Thematic break is self-contained, no need to push to blockStack
      }
      // Whitespace
      // If leading whitespace before a block marker, we need to handle specific logic?
      // For now, treat indentation as purely visual/textual unless it triggers a block change (which requires indentation awareness)

      if (kind === Tokens.BulletListMarker || kind === Tokens.OrderedListMarker || kind === Tokens.TaskListMarker) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        activeBlock = this._getActiveBlock();

        // duplicate variable remove
        // const isOrdered = (kind === Tokens.OrderedListMarker || kind === Tokens.OrderedListMarker); 
        // The token check above for isOrdered handles OrderedListMarker specifically.
        const isOrderedList = (kind === Tokens.OrderedListMarker);

        // 1. Calculate Indentation
        let currentIndent = 0;
        if (tIdx > 0 && getTokenKind(tokens[tIdx - 1]) === Tokens.Whitespace) {
          currentIndent = getTokenLength(tokens[tIdx - 1]);
        }

        // 2. Resolve Nesting Layout
        // We might be deep in a stack of Lists/ListItems. We need to find the correct level.
        // CommonMark: A list item can contain a sublist.
        // If indent > current List indent, we start a new List inside the current Item.
        // If indent < current List indent, we pop Lists until we find the matching level.

        // Helper: Find the deepest List or Item
        // If we are in a ListItem, the relevant List is the parent.

        let listNode = activeBlock;

        // If we are at a ListItem, check if we should dedent, indent, or stay
        if (listNode.type === NodeTypes.ListItem) {
          const parentList = this.blockStack[this.blockStack.length - 2];
          const parentIndent = parentList.indent || 0;

          if (currentIndent > parentIndent) {
            // Indent: Start NEW nested list INSIDE this item
            // We do NOT pop the item. We push a new List.
            const newList = new ListNode(this.context, pos, isOrderedList, currentIndent);
            this._pushBlock(newList);

            // Immediately add the item
            const newItem = new ListItemNode(this.context, pos, 0);
            this._pushBlock(newItem);

            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
          } else if (currentIndent < parentIndent) {
            // Dedent: We are too deep. Pop until we find a matching indent or root.

            // Pop current Item and current List
            this.blockStack.pop(); // Item
            // Now at List. We check if we need to pop it too.
            // Actually, we need to loop.

            while (this.blockStack.length > 0) {
              const top = this._getActiveBlock();
              if (top.type === NodeTypes.List) {
                if (top.indent > currentIndent) {
                  this.blockStack.pop(); // Pop List
                  // If we pop a List, we are likely in a ListItem of the parent list.
                  if (this._getActiveBlock().type === NodeTypes.ListItem) {
                    this.blockStack.pop(); // Pop that Item too to be ready for sibling?
                    // Wait, if we are dedenting to a sibling of the parent Item, 
                    // we expect to find a List at the target indent.
                  }
                } else {
                  break;
                }
              } else if (top.type === NodeTypes.ListItem) {
                // If we hit an item, we usually want to check ITS list
                this.blockStack.pop();
              } else {
                break;
              }
            }
            // Reset activeBlock after popping
            activeBlock = this._getActiveBlock();
          } else {
            // Same Indent: Sibling Item.
            this.blockStack.pop(); // Close previous Item
            activeBlock = this._getActiveBlock(); // Now at List
          }
        }

        // At this point, activeBlock should be a List (if we found a match) or something else (if we need to start a new root list)

        if (activeBlock.type !== NodeTypes.List) {
          // Start new root list
          const list = new ListNode(this.context, pos, isOrderedList, currentIndent);
          this._pushBlock(list);
          activeBlock = list;
        } else {
          // We are at a List. Check compatibility (Indent is guaranteed <= by loop above, but if <, we created new list above?)
          // Refine: comparison above handles dedent. 
          // What if indent is distinct but close? For now, exact match or treat as new?
          // CommonMark is fuzzy. Let's assume strict indent match for same list.

          if (activeBlock.indent !== currentIndent) {
            // Mismatch indent but didn't pop earlier? logic gap or simply start new list?
            // If we are here, it means indent > active (nested?) or we failed to pop.
            // If indent > active, we should have handled it in "Indent" block above IF we were in an item.
            // If we are at a List directly (no open item?), then we just add item?
            // NOTE: A List without open Item is rare unless just created.

            // Simple fallback: If list type mismatch, pop and new.
          }

          if (activeBlock.isOrdered !== isOrderedList) {
            // Mixed list types at same level -> technically valid in some MD, distinct lists in others.
            // We will close old and start new to be safe.
            this.blockStack.pop();
            const list = new ListNode(this.context, pos, isOrderedList, currentIndent);
            this._pushBlock(list);
          }
        }

        // Now we are guaranteed to be in a compatible List
        // Add new Item
        const item = new ListItemNode(this.context, pos, 0);
        this._pushBlock(item);

        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;

      } else if (kind === Tokens.BlockquoteMarker) {
        // Pop any open paragraph — a blockquote marker always interrupts an outer paragraph.
        if (activeBlock.type === NodeTypes.Paragraph) {
          this.blockStack.pop();
          activeBlock = this._getActiveBlock();
        }

        lineQuoteDepth++;

        // Count the number of BlockquoteNode layers already open on the stack.
        let existingQuoteDepth = 0;
        for (let i = 0; i < this.blockStack.length; i++) {
          if (this.blockStack[i].type === NodeTypes.Blockquote) existingQuoteDepth++;
        }

        if (lineQuoteDepth > existingQuoteDepth) {
          // This marker opens a new (possibly nested) blockquote.
          const bq = new BlockquoteNode(this.context, pos);
          this._pushBlock(bq);
        }
        // If lineQuoteDepth <= existingQuoteDepth, this marker is a continuation of an
        // already-open blockquote at this depth — no structural change needed.

        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;

      } else if (kind === Tokens.TablePipe) {
        // Close any open cell first, trimming trailing whitespace
        if (activeBlock.type === NodeTypes.TableCell) {
          this._trimCellTrailingWhitespace(activeBlock);
          this.blockStack.pop();
          activeBlock = this._getActiveBlock();
        }

        if (activeBlock.type === NodeTypes.TableRow) {
          // Between-cell or trailing pipe — content will open the next cell
          lineHasPipe = true;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        if (activeBlock.type === NodeTypes.Table) {
          // Leading pipe of a new data row — push a TableRow
          const row = new TableRowNode(this.context, pos);
          this._pushBlock(row);
          lineHasPipe = true;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        // Not yet in a table — check if the next line is a delimiter row
        if (!lineHasPipe) {
          let curLineEndTIdx = tIdx + 1;
          let curLineEndPos = nextPos;
          while (curLineEndTIdx < tokens.length && getTokenKind(tokens[curLineEndTIdx]) !== Tokens.NewLine) {
            curLineEndPos += getTokenLength(tokens[curLineEndTIdx]);
            curLineEndTIdx++;
          }
          const nextLineTIdx = curLineEndTIdx + 1;
          const nextLinePos = curLineEndPos + (curLineEndTIdx < tokens.length ? getTokenLength(tokens[curLineEndTIdx]) : 0);
          if (nextLineTIdx < tokens.length && this._isDelimiterLine(tokens, nextLineTIdx, nextLinePos)) {
            if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
            const tableNode = new TableNode(this.context, pos);
            this._pushBlock(tableNode);
            const headerRow = new TableRowNode(this.context, pos);
            headerRow.isHeader = true;
            this._pushBlock(headerRow);
            inTableHeader = true;
            lineHasPipe = true;
            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
          }
        }

        // Not a table pipe in a structural sense — treat as inline text
        {
          const curAb = this._getActiveBlock();
          if (curAb.type === NodeTypes.Document || curAb.type === NodeTypes.Blockquote) {
            this._pushBlock(new ParagraphNode(this.context, pos));
          }
          const parent = this._getActiveParent();
          if (parent.children && parent.children.length > 0) {
            const last = parent.children[parent.children.length - 1];
            if (last.type === NodeTypes.Text) { last.end = nextPos; }
            else { const t = new TextNode(this.context, pos); t.end = nextPos; this._append(t); }
          } else {
            const t = new TextNode(this.context, pos); t.end = nextPos; this._append(t);
          }
        }
        lineHasPipe = true;
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;

      } else if (kind === Tokens.ATXHeadingOpen) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        const depth = getHeadingDepth(token);
        this._pushBlock(new HeadingNode(this.context, pos, depth));
        activeBlock = this._getActiveBlock();

        // The single space/tab following ATX heading hashes is purely structural.
        // It's emitted directly as a Whitespace token by scanATXHeading. Skip it so it isn't parsed as Text.
        const peekTIdx = tIdx + 1;
        if (peekTIdx < tokens.length && getTokenKind(tokens[peekTIdx]) === Tokens.Whitespace) {
          nextPos += getTokenLength(tokens[peekTIdx]);
          tIdx = peekTIdx;
        }

        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      } else if (kind === Tokens.FencedOpen) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        this._pushBlock(new FencedCodeBlockNode(this.context, pos));
        activeBlock = this._getActiveBlock();
      } else if (kind !== Tokens.NewLine && (activeBlock.type === NodeTypes.Document || activeBlock.type === NodeTypes.Blockquote || (activeBlock.type === NodeTypes.Table && kind !== Tokens.Whitespace))) {
        if (activeBlock.type === NodeTypes.Table) {
          // No-leading-pipe data row: start a new TableRow
          const row = new TableRowNode(this.context, pos);
          this._pushBlock(row);
        } else if (this._currentLineIsTableHeader(tokens, tIdx, pos)) {
          // No-leading-pipe table header: line contains pipes and next line is a delimiter row
          const tableNode = new TableNode(this.context, pos);
          this._pushBlock(tableNode);
          const headerRow = new TableRowNode(this.context, pos);
          headerRow.isHeader = true;
          this._pushBlock(headerRow);
          inTableHeader = true;
        } else {
          // Need paragraph if currently at Document or inside a Blockquote with no open paragraph.
          this._pushBlock(new ParagraphNode(this.context, pos));
        }
        activeBlock = this._getActiveBlock();
      }

      // Fenced Code simply consumes all tokens as text until close
      if (this._getActiveBlock().type === NodeTypes.FencedCodeBlock) {
        if (kind === Tokens.FencedClose) {
          this.blockStack.pop(); // exit code block
        } else {
          const codeBlock = this._getActiveBlock();
          // Naive info string grab: the tokens right after FencedOpen usually make up the language
          if (codeBlock.infoEnd === 0 && (kind === Tokens.InlineText || kind === Tokens.Whitespace)) {
            if (codeBlock.children && codeBlock.children.length === 0) { // Still on the first line
              if (codeBlock.infoStart === 0) codeBlock.infoStart = pos;
              codeBlock.infoEnd = nextPos;
            }
          } else {
            // Inside content: do not parse inlines
            const t = new TextNode(this.context, pos);
            t.end = nextPos;
            this._append(t);
          }
        }
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      }

      // Frontmatter Block Logic
      if (this._getActiveBlock().type === NodeTypes.Frontmatter) {
        if (kind === Tokens.FrontmatterClose) {
          this.blockStack.pop();
        } else {
          // Frontmatter just consumes text
          const t = new TextNode(this.context, pos);
          t.end = nextPos;
          this._append(t);
        }
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      }

      // Special Block Initiation Tokens
      if (kind === Tokens.FrontmatterOpen) {
        this._pushBlock(new FrontmatterNode(this.context, pos));
        activeBlock = this._getActiveBlock();
        // We consume the opening marker but the content is inside
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      } else if (kind === Tokens.FormulaOpen) {
        this._pushBlock(new FormulaBlockNode(this.context, pos));
        // Formula uses fenced-like content rules usually? Or inline?
        // Assuming block formula for now similar to fenced code
        activeBlock = this._getActiveBlock();
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      }

      // Formula Block Content
      if (this._getActiveBlock().type === NodeTypes.FormulaBlock) {
        if (kind === Tokens.FormulaClose) {
          this.blockStack.pop();
        } else {
          const t = new TextNode(this.context, pos);
          t.end = nextPos;
          this._append(t);
        }
        this._extendAncestors(nextPos);
        pos = nextPos;
        continue;
      }

      // Inside a TableRow: skip inter-cell whitespace; open a TableCell on first content
      {
        const curAb = this._getActiveBlock();
        if (curAb.type === NodeTypes.TableRow) {
          if (kind === Tokens.Whitespace) {
            // Leading/trailing cell padding — skip
            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
          } else if (kind !== Tokens.NewLine && kind !== Tokens.TablePipe) {
            // First content token after a pipe — open a new TableCell
            const cell = new TableCellNode(this.context, pos);
            this._pushBlock(cell);
            // Fall through to switch for actual content handling
          }
        }
      }

      if (kind !== Tokens.Whitespace && kind !== Tokens.NewLine) flushPendingWs(pos);

      switch (kind) {
        case Tokens.EmphasisOpen: {
          const em = new EmphasisNode(this.context, pos);
          this._append(em);
          this.inlineStack.push(em);
          break;
        }
        case Tokens.EmphasisClose: {
          if (this.inlineStack.length > 0) {
            const top = this.inlineStack.pop();
            if (top) top.end = nextPos;
          }
          break;
        }
        case Tokens.StrongOpen: {
          const strong = new StrongNode(this.context, pos);
          this._append(strong);
          this.inlineStack.push(strong);
          break;
        }
        case Tokens.StrongClose: {
          if (this.inlineStack.length > 0) {
            const top = this.inlineStack.pop();
            if (top) top.end = nextPos;
          }
          break;
        }
        case Tokens.StrikethroughOpen: {
          const strike = new StrikethroughNode(this.context, pos);
          this._append(strike);
          this.inlineStack.push(strike);
          break;
        }
        case Tokens.StrikethroughClose: {
          if (this.inlineStack.length > 0) {
            const top = this.inlineStack.pop();
            if (top) top.end = nextPos;
          }
          break;
        }
        case Tokens.AngleLinkOpen: {
          const start = pos;
          let idx = tIdx + 1;
          let currentPos = pos + len;
          let url = "";

          while (idx < tokens.length) {
            const tk = tokens[idx];
            const k = getTokenKind(tk);
            const l = getTokenLength(tk);

            if (k === Tokens.AngleLinkClose) {
              currentPos += l;
              idx++;
              break;
            } else if (k === Tokens.AngleLinkURL || k === Tokens.AngleLinkEmail) {
              url += this.context.sourceText.substring(currentPos, currentPos + l);
            }
            currentPos += l;
            idx++;
          }

          const autoLink = new AutolinkNode(this.context, start);
          autoLink.end = currentPos;
          // Hacky manual url setting for now, ideally AutolinkNode would parse from children or source
          // But AutolinkNode in nodes.js has destStart/destEnd logic.
          // We can just set a text child.
          const textNode = new TextNode(this.context, start + 1); // skip <
          textNode.end = currentPos - 1; // skip >
          autoLink.children = [textNode];

          this._append(autoLink);

          tIdx = idx - 1;
          nextPos = currentPos;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        case Tokens.ImageMarker: {
          const img = new ImageNode(this.context, pos);
          this._append(img);
          this.inlineStack.push(img);
          break;
        }
        case Tokens.LinkOpen: {
          const link = new LinkNode(this.context, pos);
          this._append(link);
          this.inlineStack.push(link);
          break;
        }
        case Tokens.LinkClose: {
          const top = this._getActiveParent();
          if (top.type === NodeTypes.Link || top.type === NodeTypes.Image) {
            // ... (waiting for destination part)
          }
          break;
        }
        case Tokens.LinkDestOpen: {
          // Assume the top is a Link or Image
          const top = this._getActiveParent();
          if (top.type === NodeTypes.Link || top.type === NodeTypes.Image) {
            top.destStart = nextPos; // Start collecting URL
          }
          break;
        }
        case Tokens.LinkDestClose: {
          const top = this.inlineStack.pop();
          if (top && (top.type === NodeTypes.Link || top.type === NodeTypes.Image)) {
            top.destEnd = pos;
            top.end = nextPos; // finalize link bounds
          }
          break;
        }
        case Tokens.RawURL: {
          const autoLink = new AutolinkNode(this.context, pos);
          autoLink.end = nextPos;
          autoLink.destStart = pos;
          autoLink.destEnd = nextPos;
          this._append(autoLink);
          break;
        }
        case Tokens.EmailAutolink: {
          const autoLink = new AutolinkNode(this.context, pos);
          autoLink.end = nextPos;
          autoLink.destStart = pos;
          autoLink.destEnd = nextPos;
          this._append(autoLink);
          break;
        }

        case Tokens.InlineCode: {
          const code = new InlineCodeNode(this.context, pos);
          code.end = nextPos;
          this._append(code);
          break;
        }
        case Tokens.Whitespace:
        case Tokens.NewLine: {
          // Between blocks whitespace is structural noise; inside inline content
          // it is buffered and only committed once real content follows.
          const parent = this._getActiveParent();
          if (parent.type === NodeTypes.Document || parent.type === NodeTypes.Blockquote) break;
          if (pendingWsStart === -1) pendingWsStart = pos;
          break;
        }
        case Tokens.InlineText:
        case Tokens.EntityNamed:
        case Tokens.EntityDecimal:
        case Tokens.EntityHex: {
          const parent = this._getActiveParent();
          if (parent.children && parent.children.length > 0) {
            const last = parent.children[parent.children.length - 1];
            if (last.type === NodeTypes.Text) {
              last.end = nextPos;
              break;
            }
          }
          const t = new TextNode(this.context, pos);
          t.end = nextPos;
          this._append(t);
          break;
        }
        case Tokens.HTMLCommentOpen: {
          const node = new HtmlCommentNode(this.context, pos);
          tIdx = this._consumeUntil(tokens, tIdx, pos, Tokens.HTMLCommentClose, node) - 1;
          nextPos = node.end;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        case Tokens.HTMLCDataOpen: {
          const node = new HtmlCDataNode(this.context, pos);
          tIdx = this._consumeUntil(tokens, tIdx, pos, Tokens.HTMLCDataClose, node) - 1;
          nextPos = node.end;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        case Tokens.HTMLDocTypeOpen: {
          const node = new HtmlDocTypeNode(this.context, pos);
          tIdx = this._consumeUntil(tokens, tIdx, pos, Tokens.HTMLDocTypeClose, node) - 1;
          nextPos = node.end;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        case Tokens.XMLProcessingInstructionOpen: {
          const node = new XmlProcessingInstructionNode(this.context, pos);
          tIdx = this._consumeUntil(tokens, tIdx, pos, Tokens.XMLProcessingInstructionClose, node) - 1;
          nextPos = node.end;
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }

        case Tokens.HTMLTagOpen: {
          const openLen = len;
          // Length 2 means '</', i.e. a closing tag
          const isClosingTag = openLen === 2;

          // State for parsing the tag
          let tagName = "";
          let tagNameStart = 0;
          let tagNameLen = 0;
          let selfClosing = false;
          let tagEndPos = -1;
          /** @type {{name: string, value: (string | null)}[]} */
          const attributes = [];

          let currentAttributeName = "";

          // Consume tag internals loop
          let idx = tIdx + 1;
          let currentPos = pos + openLen;

          while (idx < tokens.length) {
            const tk = tokens[idx];
            const k = getTokenKind(tk);
            const l = getTokenLength(tk);

            if (k === Tokens.HTMLTagName) {
              tagNameStart = currentPos;
              tagNameLen = l;
              // Extract tagName for node property
              tagName = this.context.sourceText.substring(currentPos, currentPos + l).toLowerCase();
            } else if (k === Tokens.HTMLTagClose) {
              currentPos += l;
              tagEndPos = currentPos;
              idx++;
              break;
            } else if (k === Tokens.HTMLTagSelfClosing) {
              selfClosing = true;
              currentPos += l;
              tagEndPos = currentPos;
              idx++;
              break;
            } else if (k === Tokens.HTMLAttributeName) {
              currentAttributeName = this.context.sourceText.substring(currentPos, currentPos + l);
              attributes.push({ name: currentAttributeName, value: null });
            } else if (k === Tokens.HTMLAttributeValue) {
              if (attributes.length > 0) {
                attributes[attributes.length - 1].value = this.context.sourceText.substring(currentPos, currentPos + l);
              }
            } else if (k === Tokens.HTMLAttributeQuote || k === Tokens.HTMLAttributeEquals) {
              // If we see a quote or equals, it implicates at least an empty value
              if (attributes.length > 0 && attributes[attributes.length - 1].value === null) {
                attributes[attributes.length - 1].value = "";
              }
            }

            currentPos += l;
            idx++;
          }

          // If we ran out of tokens without closing, treat what we found as valid end
          if (tagEndPos === -1) tagEndPos = currentPos;

          if (isClosingTag) {
            // "Pop-Until-Match" Logic
            let matchIndex = -1;
            // Iterate backwards from top of stack
            for (let i = this.blockStack.length - 1; i >= 0; i--) {
              const node = this.blockStack[i];
              // Stop at root
              if (node.type === NodeTypes.Document) break;

              if (node.type === NodeTypes.HtmlElement &&
                  /** @type {HtmlElementNode} */(node).tagName === tagName) {
                matchIndex = i;
                break;
              }
            }

            if (matchIndex !== -1) {
              // Close everything down to matchIndex (inclusive of the matched element)
              while (this.blockStack.length > matchIndex) {
                const popped = this.blockStack.pop();
                if (popped) popped.end = tagEndPos;
              }
            } else {
              // Orphaned closing tag: treat as text (but we don't really know start pos of close)
              // The original pos was the start of `</`
              const t = new TextNode(this.context, pos);
              t.end = tagEndPos;
              this._append(t);
            }
          } else {
            // Opening tag
            const el = new HtmlElementNode(this.context, pos);
            el.tagName = tagName;
            el.attributes = attributes;
            el.end = tagEndPos;

            this._append(el);

            // Check void element using the zero-allocation scanner utility
            const isVoid = tagNameLen > 0 && isVoidElement(this.context.sourceText, tagNameStart, tagNameLen);

            if (!selfClosing && !isVoid) {
              // Push to block stack to contain content
              // NOTE: Because we push to blockStack, children will be processed normally.
              // Including inline elements which will be appended to this block.
              this.blockStack.push(el);
            }
          }

          // Advance the main loop
          // tIdx will be incremented by loop, so set to idx - 1
          tIdx = idx - 1;
          nextPos = tagEndPos;

          // Continue forces next iteration with updated pos
          this._extendAncestors(nextPos);
          pos = nextPos;
          continue;
        }
        case Tokens.HTMLTagClose:
        case Tokens.HTMLTagSelfClosing: {
          // Orphaned parts outside of an open tag loop
          const t = new TextNode(this.context, pos);
          t.end = nextPos;
          this._append(t);
          break;
        }
      }

      this._extendAncestors(nextPos);
      pos = nextPos;
    }

    // End of Chunk Cleanup
    while (this.inlineStack.length > 0) {
      const leftover = this.inlineStack.pop();
      if (leftover) leftover.end = pos;
    }
  }

  /**
   * Completes the document and returns the root.
   * @returns {DocumentNode}
   */
  finish() {
    this.root.end = this.root.children && this.root.children.length > 0
      ? Math.max(0, this.root.children[this.root.children.length - 1].end)
      : 0;
    return this.root;
  }
}
