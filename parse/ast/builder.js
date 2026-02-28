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
            // Inside content
            const t = new TextNode(this.context, pos);
            t.end = nextPos;
            this._append(t);
          }
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
        case Tokens.LinkOpen: {
          const link = new LinkNode(this.context, pos);
          this._append(link);
          this.inlineStack.push(link);
          break;
        }
        case Tokens.LinkClose: {
          // Link is structurally closed contextually, but might be waiting for dest
          // We keep it on the stack if we suspect a destination to follow, or pop if it's a bare reference.
          // Standard inline exit:
          if (this.inlineStack.length > 0 && this.inlineStack[this.inlineStack.length - 1].type === NodeTypes.Link) {
            // Temporarily keep it. The Semantic scanner maps it exactly. We'll pop it when we see the end of the dest.
          }
          break;
        }
        case Tokens.LinkDestOpen: {
          // Assume the top is a Link
          const top = this._getActiveParent();
          if (top.type === NodeTypes.Link) {
            // @ts-ignore
            top.destStart = nextPos; // Start collecting URL
          }
          break;
        }
        case Tokens.LinkDestClose: {
          const top = this.inlineStack.pop();
          if (top && top.type === NodeTypes.Link) {
            // @ts-ignore
            top.destEnd = pos;
            top.end = nextPos; // finalize link bounds
          }
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
