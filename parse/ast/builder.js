// @ts-check

import { getTokenKind, getTokenLength, getHeadingDepth } from '../scan-core.js';
import * as Tokens from '../scan-tokens.js';
import { isVoidElement } from '../scan-html-tag.js';
import { ParseContext } from './parser.js';
import {
  DocumentNode, ParagraphNode, HeadingNode, BlockquoteNode,
  ListNode, ListItemNode, FencedCodeBlockNode, ThematicBreakNode,
  TableNode, TableRowNode, TableCellNode, FrontmatterNode, FormulaBlockNode,
  TextNode, EmphasisNode, StrongNode, StrikethroughNode, LinkNode, ImageNode,
  InlineCodeNode, AutolinkNode, HtmlCommentNode, HtmlCDataNode,
  HtmlDocTypeNode, XmlProcessingInstructionNode, InlineFormulaNode, HtmlElementNode
} from './nodes.js';
import * as NodeTypes from './node-types.js';

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
   * Closes blocks down to a certain index. Updates their `end` tracking.
   * @param {number} downToIndex
   * @param {number} pos
   */
  _severBlocks(downToIndex, pos) {
    while (this.blockStack.length > downToIndex) {
      const popped = this.blockStack.pop();
      if (popped) popped.end = pos; // Typically they update continuous bounds themselves, but hard-sever closes it out.
    }
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
   * Processes a chunk of semantic tokens (typically one line/paragraph)
   * 
   * @param {ProvisionalToken[]} tokens 
   * @param {number} startOffset 
   */
  consumeChunk(tokens, startOffset) {
    if (tokens.length === 0) return;

    let pos = startOffset;
    let tIdx = 0;

    // Phase 1 & 2: Prefix Context Matching & Severance
    let firstTokKind = getTokenKind(tokens[0]);
    let activeBlock = this._getActiveBlock();

    // Phase 3 & 4: Inner Container Initiation and Resolution
    // (Deferred mostly to Inline Stream looping as we scan multiple kinds of blocks within single chunk stream)

    // Phase 5: Inline Stream Processing
    for (; tIdx < tokens.length; tIdx++) {
      const token = tokens[tIdx];
      const kind = getTokenKind(token);
      const len = getTokenLength(token);
      let nextPos = pos + len;

      let activeBlock = this._getActiveBlock();

      // Structural Break Introspection inside Stream
      if (kind === Tokens.NewLine) {
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
             // @ts-ignore
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
                         // @ts-ignore
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

             // @ts-ignore
             if (activeBlock.indent !== currentIndent) {
                  // Mismatch indent but didn't pop earlier? logic gap or simply start new list?
                  // If we are here, it means indent > active (nested?) or we failed to pop.
                  // If indent > active, we should have handled it in "Indent" block above IF we were in an item.
                  // If we are at a List directly (no open item?), then we just add item?
                  // NOTE: A List without open Item is rare unless just created.

                  // Simple fallback: If list type mismatch, pop and new.
             }

             // @ts-ignore
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
        if (activeBlock.type === NodeTypes.Paragraph) {
             // If we are in a paragraph, we might be interrupting it with a blockquote (?)
             // Classic CommonMark: blockquote continuation line vs new blockquote.
             // If we are already in a blockquote, this marker continues it.
             // Simpler approach for now: if we see a marker, ensure we are in a blockquote or start one.
        }
        
        // This structural handling is tricky because markers appear on every line.
        // We will need a Phase 3 mechanism ("Container Initiation") to align markers with stack depth.
        // For this prototype, we'll assume a marker simply means "Add a blockquote if not present"
        // But for nested ones (>>), we need to match levels.
        
        // STUB: Treat as simple text for now to avoid breaking build until proper container matching is implemented
        // const t = new TextNode(this.context, pos);
        // t.end = nextPos;
        // this._append(t);

      } else if (kind === Tokens.ATXHeadingOpen) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        const depth = getHeadingDepth(token);
        this._pushBlock(new HeadingNode(this.context, pos, depth));
        activeBlock = this._getActiveBlock();
      } else if (kind === Tokens.FencedOpen) {
        if (activeBlock.type === NodeTypes.Paragraph) this.blockStack.pop();
        this._pushBlock(new FencedCodeBlockNode(this.context, pos));
        activeBlock = this._getActiveBlock();
      } else if (kind !== Tokens.NewLine && activeBlock.type === NodeTypes.Document) {
        // Need paragraph if currently matching Document
        this._pushBlock(new ParagraphNode(this.context, pos));
        activeBlock = this._getActiveBlock();
      }

      // Fenced Code simply consumes all tokens as text until close
      if (this._getActiveBlock().type === NodeTypes.FencedCodeBlock) {
        if (kind === Tokens.FencedClose) {
          this.blockStack.pop(); // exit code block
        } else {
          /** @type {FencedCodeBlockNode} */
          // @ts-ignore
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

            while(idx < tokens.length) {
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
            // @ts-ignore
            top.destStart = nextPos; // Start collecting URL
          }
          break;
        }
        case Tokens.LinkDestClose: {
          const top = this.inlineStack.pop();
          if (top && (top.type === NodeTypes.Link || top.type === NodeTypes.Image)) {
            // @ts-ignore
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
        case Tokens.InlineText:
        case Tokens.Whitespace:
        case Tokens.NewLine:
        case Tokens.EntityNamed:
        case Tokens.EntityDecimal:
        case Tokens.EntityHex: {
          // Leaf processing
          const parent = this._getActiveParent();
          // Coalesce continuous text
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
        case Tokens.HtmlCommentOpen: {
            const openLen = len;
            let idx = tIdx + 1;
            let currentPos = pos + openLen;
            const startPos = pos;

            while(idx < tokens.length) {
              const tk = tokens[idx];
              const k = getTokenKind(tk);
              const l = getTokenLength(tk);

              if (k === Tokens.HTMLCommentClose) {
                currentPos += l;
                idx++;
                break;
              }
              currentPos += l;
              idx++;
            }

            const comment = new HtmlCommentNode(this.context, startPos);
            comment.end = currentPos;
            this._append(comment);

            tIdx = idx - 1; 
            nextPos = currentPos;
            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
        }

        case Tokens.HTMLCDataOpen: {
            const startPos = pos;
            let idx = tIdx + 1;
            let currentPos = pos + len;

            while(idx < tokens.length) {
              const tk = tokens[idx];
              const k = getTokenKind(tk);
              const l = getTokenLength(tk);
              if (k === Tokens.HTMLCDataClose) {
                currentPos += l;
                idx++;
                break;
              }
              currentPos += l;
              idx++;
            }
            const cdata = new HtmlCDataNode(this.context, startPos);
            cdata.end = currentPos;
            this._append(cdata);
            tIdx = idx - 1;
            nextPos = currentPos;
            this._extendAncestors(nextPos);
            pos = nextPos;
            continue;
        }

        case Tokens.HTMLDocTypeOpen: {
            const startPos = pos;
            let idx = tIdx + 1;
            let currentPos = pos + len;
            while(idx < tokens.length) {
              const tk = tokens[idx];
              const k = getTokenKind(tk);
              const l = getTokenLength(tk);
              if (k === Tokens.HTMLDocTypeClose) {
                currentPos += l;
                idx++;
                 break;
              }
              currentPos += l;
              idx++;
            }
             const doctype = new HtmlDocTypeNode(this.context, startPos);
             doctype.end = currentPos;
             this._append(doctype);
             tIdx = idx - 1;
             nextPos = currentPos;
             this._extendAncestors(nextPos);
             pos = nextPos;
             continue;
        }

        case Tokens.XMLProcessingInstructionOpen: {
            const startPos = pos;
            let idx = tIdx + 1;
            let currentPos = pos + len;
             while(idx < tokens.length) {
              const tk = tokens[idx];
              const k = getTokenKind(tk);
              const l = getTokenLength(tk);
              if (k === Tokens.XMLProcessingInstructionClose) {
                currentPos += l;
                idx++;
                 break;
              }
              currentPos += l;
              idx++;
            }
            const pi = new XmlProcessingInstructionNode(this.context, startPos);
            pi.end = currentPos;
            this._append(pi);
             tIdx = idx - 1;
             nextPos = currentPos;
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
          /** @type {Array<{name: string, value: string}>} */
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
        case Tokens.HtmlTagClose:
        case Tokens.HtmlTagSelfClosing: {
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
