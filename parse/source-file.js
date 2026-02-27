// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';
import { semantic } from './semantic.js';
import {
  InlineText, Whitespace, NewLine,
  EntityNamed, EntityDecimal, EntityHex, Escaped,
  BacktickBoundary, InlineCode,
  FencedOpen, FencedContent, FencedClose,
  HTMLTagOpen, HTMLTagClose, HTMLTagName, HTMLTagSelfClosing,
  HTMLAttributeName, HTMLAttributeColon, HTMLAttributeEquals,
  HTMLAttributeQuote, HTMLAttributeValue, PercentEncoding,
  HTMLCommentOpen, HTMLCommentContent, HTMLCommentClose,
  HTMLCDataOpen, HTMLCDataContent, HTMLCDataClose,
  HTMLDocTypeOpen, HTMLDocTypeContent, HTMLDocTypeClose,
  XMLProcessingInstructionOpen, XMLProcessingInstructionTarget,
  XMLProcessingInstructionContent, XMLProcessingInstructionClose,
  HTMLRawText,
  BulletListMarker, OrderedListMarker, TaskListMarker,
  ATXHeadingOpen, ATXHeadingClose, SetextHeadingUnderline,
  AngleLinkOpen, AngleLinkURL, AngleLinkEmail, AngleLinkClose,
  RawURL, WWWAutolink, EmailAutolink,
  FormulaOpen, FormulaContent, FormulaClose,
  TablePipe, TableDelimiterRowMarker,
  FrontmatterOpen, FrontmatterContent, FrontmatterClose,
  BlockquoteMarker,
  ThematicBreak,
  LinkOpen, LinkClose, ImageMarker,
  LinkDestOpen, LinkDestClose, LinkTitleQuote,
  EmphasisOpen, EmphasisClose, StrongOpen, StrongClose,
  StrikethroughOpen, StrikethroughClose,
  LinkLabel, LinkDestination, LinkTitle, TableDelimiterCell
} from './scan-tokens.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

// ── Arena layout constants ────────────────────────────────────────────────────

/** Number of array slots per node in the Green Arena. */
export const NODE_STRIDE = 6;

/** Slot offset: packed ProvisionalToken (kind | length | flags). */
export const NODE_HEADER = 0;

/** Slot offset: arena index of first child (0 = none). */
export const NODE_FIRST_CHILD = 1;

/** Slot offset: arena index of next sibling (0 = none). */
export const NODE_NEXT_SIBLING = 2;

/** Slot offset: arena index of parent node (0 = none/root). */
export const NODE_PARENT = 3;

/** Slot offset: arena index of previous sibling (0 = none). */
export const NODE_PREV_SIBLING = 4;

/**
 * Slot offset: materialized payload.
 * For container nodes: stores the opening-marker width (number).
 * For leaf nodes: null or specialized value.
 */
export const NODE_MATERIALIZED = 5;

// ── Red Facade classes ────────────────────────────────────────────────────────

/**
 * BaseNode: persistent façade over a single Green Arena node.
 */
export class BaseNode {
  /**
   * @param {SourceFile} sourceFile
   * @param {number} arenaIndex
   */
  constructor(sourceFile, arenaIndex) {
    /** @type {SourceFile} @readonly */
    this.sourceFile = sourceFile;
    /** @type {number} @readonly */
    this.arenaIndex = arenaIndex;
  }

  /** Raw header (ProvisionalToken). */
  get header() { return this.sourceFile.getArenaHeader(this.arenaIndex); }
  /** @returns {import('./scan-core.js').TokenKind} */
  get kind() { return getTokenKind(this.header); }
  /** Width in source characters. */
  get width() { return getTokenLength(this.header); }
  /** Token flags. */
  get flags() { return getTokenFlags(this.header); }
  /** Materialized payload. */
  get data() { return this.sourceFile.getArenaMaterialized(this.arenaIndex); }
  /** Absolute source offset of this node. */
  get offset() { return this.sourceFile._getNodePos(this.arenaIndex); }
  /** Source text covered by this node. */
  get text() {
    const p = this.offset;
    return this.sourceFile.text.substring(p, p + this.width);
  }

  /** @returns {BaseNode | null} */
  get firstChild() {
    const idx = this.sourceFile.getArenaFirstChild(this.arenaIndex);
    return idx !== 0 ? this.sourceFile.getBaseNode(idx) : null;
  }
  /** @returns {BaseNode | null} */
  get nextSibling() {
    const idx = this.sourceFile.getArenaNextSibling(this.arenaIndex);
    return idx !== 0 ? this.sourceFile.getBaseNode(idx) : null;
  }
  /** @returns {BaseNode | null} */
  get previousSibling() {
    const idx = this.sourceFile.getArenaPrevSibling(this.arenaIndex);
    return idx !== 0 ? this.sourceFile.getBaseNode(idx) : null;
  }
  /** @returns {BaseNode | null} */
  get parent() {
    const idx = this.sourceFile.getArenaParent(this.arenaIndex);
    return idx !== 0 ? this.sourceFile.getBaseNode(idx) : null;
  }

  /** @returns {Generator<BaseNode>} */
  *ancestors() {
    let p = this.parent;
    while (p) { yield p; p = p.parent; }
  }

  /** @returns {BaseNode[]} */
  getChildren() {
    /** @type {BaseNode[]} */
    const children = [];
    let child = this.firstChild;
    while (child) {
      if (child._isTextLike()) {
        const startIdx = child.arenaIndex;
        let lastIdx = startIdx;
        let width = child.width;
        let next = child.nextSibling;
        while (next && next._isTextLike()) {
          width += next.width;
          lastIdx = next.arenaIndex;
          next = next.nextSibling;
        }
        children.push(new TextNode(this.sourceFile, startIdx, width, lastIdx));
        child = next;
      } else {
        children.push(child);
        child = child.nextSibling;
      }
    }
    return children;
  }

  /** @returns {BaseNode[]} */
  getSiblingsAndSelf() {
    /** @type {BaseNode[]} */
    const nodes = [];
    let curr = (/** @type {BaseNode} */ (this));
    let prev = curr.previousSibling;
    while (prev) {
      curr = prev;
      prev = curr.previousSibling;
    }
    while (curr) {
      if (curr._isTextLike()) {
        const startIdx = curr.arenaIndex;
        let lastIdx = startIdx;
        let width = curr.width;
        let next = curr.nextSibling;
        while (next && next._isTextLike()) {
          width += next.width;
          lastIdx = next.arenaIndex;
          next = next.nextSibling;
        }
        nodes.push(new TextNode(this.sourceFile, startIdx, width, lastIdx));
        curr = next;
      } else {
        nodes.push(curr);
        curr = curr.nextSibling;
      }
    }
    return nodes;
  }

  /** @protected */
  _isTextLike() {
    const k = this.kind;
    return k === InlineText || k === Whitespace || k === NewLine;
  }
}

/** Root node of the document. */
export class DocumentNode extends BaseNode {}

/** Coalesced text node for InlineText, Whitespace, and NewLine. */
export class TextNode extends BaseNode {
  /**
   * @param {SourceFile} sourceFile
   * @param {number} arenaIndex
   * @param {number} [width]
   * @param {number} [lastArenaIndex]
   */
  constructor(sourceFile, arenaIndex, width, lastArenaIndex) {
    super(sourceFile, arenaIndex);
    this._width = width;
    this._lastIdx = lastArenaIndex ?? arenaIndex;
  }
  get width() { return this._width ?? super.width; }
}

/** Base class for headings. */
export class HeadingNode extends BaseNode {}

/** ATX Heading (# Title). */
export class AtxHeadingNode extends HeadingNode {
  getLevel() {
    const t = this.text;
    let i = 0;
    while (i < 6 && t[i] === '#') i++;
    return i;
  }
}

/** Setext Heading (Title\n===). */
export class SetextHeadingNode extends HeadingNode {
  getLevel() {
    return this.text.includes('=') ? 1 : 2;
  }
}

export class ParagraphNode extends BaseNode {}
export class BlockquoteNode extends BaseNode {}
export class BulletListNode extends BaseNode {}
export class OrderedListNode extends BaseNode {}

export class ListItemNode extends BaseNode {
  isChecked() {
    const t = this.text;
    return /\[[xX]\]/.test(t);
  }
}

/** Base class for code blocks. */
export class CodeBlockNode extends BaseNode {
  /** @returns {string} */
  getFenceChar() {
    return this.sourceFile.text[this.offset] || '';
  }
}

export class FencedCodeBlockNode extends CodeBlockNode {
  getLanguage() {
    const firstLine = this.text.split('\n')[0];
    return firstLine.replace(/^[`~]+/, '').trim();
  }
}

export class TableNode extends BaseNode {}
export class ThematicBreakNode extends BaseNode {}
export class FrontmatterNode extends BaseNode {}
export class FormulaBlockNode extends BaseNode {}

export class EmphasisNode extends BaseNode {}
export class StrongNode extends BaseNode {}
export class StrikethroughNode extends BaseNode {}

export class LinkNode extends BaseNode {
  getDestination() {
    const d = this.getChildren().find(c => c.kind === LinkDestination);
    return d ? d.text : '';
  }
  getTitle() {
    const t = this.getChildren().find(c => c.kind === LinkTitle);
    return t ? t.text : '';
  }
}

export class ImageNode extends LinkNode {}
export class InlineCodeNode extends BaseNode {}

export class EntityNode extends BaseNode {
  getValue() { return this.text; } // Decodes eventually
}

export class EscapedNode extends BaseNode {}

export class AutolinkNode extends BaseNode {
  getURL() { return this.text.replace(/^[<]|[>]$/g, ''); }
}

export class InlineFormulaNode extends BaseNode {}

/** HTML Tag (<br/>, <div>, </div>). */
export class HTMLTagNode extends BaseNode {
  getTagName() {
    const m = this.text.match(/^<\/?([A-Za-z0-9-]+)/);
    return m ? m[1] : '';
  }
  isClosing() { return this.text.startsWith('</'); }
  isSelfClosing() { return this.text.endsWith('/>'); }
}

export class HTMLCommentNode extends BaseNode {}
export class HTMLCDataNode extends BaseNode {}
export class HTMLDocTypeNode extends BaseNode {}
export class HTMLRawTextNode extends BaseNode {}
export class XmlPINode extends BaseNode {}

// ── SourceFile ────────────────────────────────────────────────────────────────

/**
 * SourceFile: root manager for the source text, the Green Arena, and the
 * Paragraph Index.
 *
 * ### Green Arena layout (NODE_STRIDE = 6 slots per node)
 * ```
 *   arena[i + NODE_HEADER]      — ProvisionalToken (kind | length | flags)
 *   arena[i + NODE_FIRST_CHILD] — arena index of first child, or 0
 *   arena[i + NODE_NEXT_SIBLING]— arena index of next sibling, or 0
 *   arena[i + NODE_PARENT]      — arena index of parent node
 *   arena[i + NODE_PREV_SIBLING]— arena index of previous sibling
 *   arena[i + NODE_MATERIALIZED]— opening-marker width (containers) or custom data
 * ```
 * Index 0 is the null sentinel.
 */
export class SourceFile {
  /** @param {string} text */
  constructor(text) {
    /** @type {string} */
    this.text = text;

    /**
     * Green Arena: flat native JavaScript Array.
     * @type {(number | any)[]}
     */
    this.arena = [0, 0, 0, 0, 0, null]; // Index 0 is the null sentinel

    /** @type {number[]} */
    this.paragraphIndex = [];

    /** @type {number[]} */
    this.paragraphArenaIndices = [];

    /** @type {Map<number, BaseNode>} */
    this._redCache = new Map();

    this._build();
  }

  // ── Arena Accessors ───────────────────────────────────────────────────────

  /** @param {number} idx */
  getArenaHeader(idx)      { return (/** @type {number} */(this.arena[idx + NODE_HEADER])); }
  /** @param {number} idx */
  getArenaFirstChild(idx)  { return (/** @type {number} */(this.arena[idx + NODE_FIRST_CHILD])); }
  /** @param {number} idx */
  getArenaNextSibling(idx) { return (/** @type {number} */(this.arena[idx + NODE_NEXT_SIBLING])); }
  /** @param {number} idx */
  getArenaParent(idx)      { return (/** @type {number} */(this.arena[idx + NODE_PARENT])); }
  /** @param {number} idx */
  getArenaPrevSibling(idx) { return (/** @type {number} */(this.arena[idx + NODE_PREV_SIBLING])); }
  /** @param {number} idx */
  getArenaMaterialized(idx){ return this.arena[idx + NODE_MATERIALIZED]; }

  /** @returns {BaseNode[]} */
  getChildren() {
    const firstChild = this.getArenaFirstChild(0);
    if (firstChild === 0) return [];
    return this.getBaseNode(firstChild).getSiblingsAndSelf();
  }

  // ── Internal build ──────────────────────────────────────────────────────────

  /** @private */
  _build() {
    this.arena.length = 0;
    this.paragraphIndex.length = 0;
    this.paragraphArenaIndices.length = 0;
    this._redCache.clear();

    // Index 0 is the null sentinel. Dummy root node at stride 0.
    // [HEADER, FIRST_CHILD, NEXT_SIBLING, PARENT, PREV_SIBLING, MATERIALIZED]
    this.arena.push(0, 0, 0, 0, 0, null);

    if (!this.text.length) return;

    const tokens = /** @type {import('./scan0.js').ProvisionalToken[]} */ ([]);
    semantic({ input: this.text, startOffset: 0, endOffset: this.text.length })(tokens);

    // Root context: parent arenaIndex 0.
    const rootState = { arenaIndex: 0, lastChildIdx: 0, startPos: 0 };
    const stack = [rootState];
    let pos = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const kind = getTokenKind(token);
        const len = getTokenLength(token);
        const flags = getTokenFlags(token);

        if (len === 0) continue;

        if ((flags & IsSafeReparsePoint) || (pos === 0)) {
            this.paragraphIndex.push(pos);
            this.paragraphArenaIndices.push(this.arena.length);
        }

        const parentState = stack[stack.length - 1];

        if (this._isOpenToken(kind)) {
            const idx = this._pushNode(token, parentState);
            this.arena[idx + NODE_MATERIALIZED] = len; // Marker width
            stack.push({ arenaIndex: idx, startPos: pos, lastChildIdx: 0 });
        } else if (this._isCloseToken(kind)) {
            this._pushNode(token, parentState);
            const top = stack.length > 1 ? stack.pop() : null;
            if (top && top.arenaIndex !== 0) {
                const totalWidth = (pos + len) - top.startPos;
                this._updateNodeWidth(top.arenaIndex, totalWidth);
            }
        } else {
            // Special case: ATXHeading ends at NewLine if not closed by ATXHeadingClose.
            if (kind === NewLine && stack.length > 1) {
                const top = stack[stack.length - 1];
                const topHeader = this.getArenaHeader(top.arenaIndex);
                if (getTokenKind(topHeader) === ATXHeadingOpen) {
                    stack.pop();
                    this._updateNodeWidth(top.arenaIndex, pos - top.startPos);
                    this._pushNode(token, stack[stack.length - 1]);
                    pos += len;
                    continue;
                }
            }
            this._pushNode(token, stack[stack.length - 1]);
        }
        pos += len;
    }

    // Close any remaining open nodes
    while (stack.length > 1) {
        const top = stack.pop();
        if (top && top.arenaIndex !== 0) {
            this._updateNodeWidth(top.arenaIndex, pos - top.startPos);
        }
    }

    if (this.arena.length > NODE_STRIDE) {
        if (this.paragraphIndex.length === 0 || this.paragraphIndex[0] !== 0) {
            this.paragraphIndex.unshift(0);
            this.paragraphArenaIndices.unshift(NODE_STRIDE);
        }
    }
  }

  /**
   * @param {number} token
   * @param {{ arenaIndex: number, lastChildIdx: number }} parent
   * @returns {number}
   * @private
   */
  _pushNode(token, parent) {
    const idx = this.arena.length;
    // [HEADER, FIRST_CHILD, NEXT_SIBLING, PARENT, PREV_SIBLING, MATERIALIZED]
    this.arena.push(token, 0, 0, parent.arenaIndex, parent.lastChildIdx, null);
    
    if (parent.lastChildIdx !== 0) {
      this.arena[parent.lastChildIdx + NODE_NEXT_SIBLING] = idx;
    } else {
      this.arena[parent.arenaIndex + NODE_FIRST_CHILD] = idx;
    }
    parent.lastChildIdx = idx;
    return idx;
  }

  /**
   * @param {number} arenaIndex
   * @param {number} newWidth
   * @private
   */
  _updateNodeWidth(arenaIndex, newWidth) {
    this.arena[arenaIndex + NODE_HEADER] =
      (this.getArenaHeader(arenaIndex) & ~0xFFFF) | (newWidth & 0xFFFF);
  }

  _isOpenToken(kind) {
    return kind === EmphasisOpen || kind === StrongOpen || kind === StrikethroughOpen ||
      kind === ATXHeadingOpen || kind === FencedOpen ||
      kind === FormulaOpen || kind === FrontmatterOpen ||
      kind === LinkOpen || kind === BlockquoteMarker ||
      kind === BulletListMarker || kind === OrderedListMarker || kind === TaskListMarker;
  }

  /** @param {number} kind @returns {boolean} @private */
  _isCloseToken(kind) {
    return kind === EmphasisClose || kind === StrongClose || kind === StrikethroughClose ||
      kind === ATXHeadingClose || kind === FencedClose ||
      kind === FormulaClose || kind === FrontmatterClose ||
      kind === LinkClose;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Return the BaseNode covering `offset`.
   * @param {number} offset
   * @returns {BaseNode | null}
   */
  getNodeAt(offset) {
    if (offset < 0 || offset >= this.text.length) return null;

    if (!this.paragraphIndex.length) {
      return this._findNodeAt(NODE_STRIDE, 0, offset);
    }

    let lo = 0;
    let hi = this.paragraphIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.paragraphIndex[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }

    // Start search from the reparse point node
    return this._findNodeAt(
      this.paragraphArenaIndices[lo],
      this.paragraphIndex[lo],
      offset
    );
  }

  /**
   * @param {number} arenaIndex
   * @returns {BaseNode}
   */
  getBaseNode(arenaIndex) {
    return this._getOrCreateBaseNode(arenaIndex);
  }

  /**
   * @param {string} newText
   * @param {{ start: number, end?: number, oldEnd?: number, newEnd?: number }} changeSpan
   */
  update(newText, changeSpan) {
    this.text = newText;
    this._build();
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Depth-first search for the innermost node covering `targetOffset`.
   * @param {number} startIdx
   * @param {number} startPos
   * @param {number} targetOffset
   * @returns {BaseNode | null}
   * @private
   */
  _findNodeAt(startIdx, startPos, targetOffset) {
    let idx = startIdx;
    let pos = startPos;
    while (idx !== 0) {
      const header = this.getArenaHeader(idx);
      const width = getTokenLength(header);
      
      if (targetOffset >= pos && targetOffset < pos + width) {
        // Special case: if this is a BaseNode (leaf) but contains children,
        // it means we are at the marker of a container.
        const childIdx = this.getArenaFirstChild(idx);
        if (childIdx !== 0) {
          const markerWidth = (/** @type {number} */(this.getArenaMaterialized(idx))) || 0;
          // If we are EXACTLY at the marker, we should return the container itself.
          // If we are AFTER the marker, we dive.
          if (targetOffset >= pos + markerWidth) {
            const found = this._findNodeAt(childIdx, pos + markerWidth, targetOffset);
            if (found) return found;
          }
        }
        return this.getBaseNode(idx);
      }
      pos += width;
      idx = this.getArenaNextSibling(idx);
    }
    return null;
  }

  /**
   * @param {number} startIdx
   * @param {number} startPos
   * @param {number} targetIdx
   * @returns {number | null}
   * @private
   */
  _findPos(startIdx, startPos, targetIdx) {
    let idx = startIdx;
    let pos = startPos;
    if (targetIdx === 0) return 0; // Root is at pos 0
    
    while (idx !== 0) {
      if (idx === targetIdx) return pos;
      const childIdx = this.getArenaFirstChild(idx);
      if (childIdx !== 0) {
        const markerWidth = (/** @type {number} */(this.getArenaMaterialized(idx))) || 0;
        const found = this._findPos(childIdx, pos + markerWidth, targetIdx);
        if (found !== null) return found;
      }
      const header = this.getArenaHeader(idx);
      pos += getTokenLength(header);
      idx = this.getArenaNextSibling(idx);
    }
    return null;
  }

  /**
   * @param {number} arenaIndex
   * @returns {number}
   * @private
   */
  _getNodePos(arenaIndex) {
    if (!this.paragraphArenaIndices.length) return 0;

    let lo = 0;
    let hi = this.paragraphArenaIndices.length - 1;
    let pIdx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.paragraphArenaIndices[mid] <= arenaIndex) {
        pIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return this._findPos(
      this.paragraphArenaIndices[pIdx],
      this.paragraphIndex[pIdx],
      arenaIndex
    ) ?? 0;
  }

  /**
   * @param {number} arenaIndex
   * @returns {BaseNode}
   * @private
   */
  _getOrCreateBaseNode(arenaIndex) {
    let node = this._redCache.get(arenaIndex);
    if (!node) {
      const kind = getTokenKind(this.getArenaHeader(arenaIndex));
      node = this._createSemanticNode(arenaIndex, kind);
      this._redCache.set(arenaIndex, node);
    }
    return node;
  }

  /**
   * @param {number} arenaIndex
   * @param {number} kind
   * @private
   */
  _createSemanticNode(arenaIndex, kind) {
    switch (kind) {
      case ATXHeadingOpen: return new AtxHeadingNode(this, arenaIndex);
      case SetextHeadingUnderline: return new SetextHeadingNode(this, arenaIndex);
      case LinkOpen: return new LinkNode(this, arenaIndex);
      case ImageMarker: return new ImageNode(this, arenaIndex);
      case FencedOpen: return new FencedCodeBlockNode(this, arenaIndex);
      case EmphasisOpen: return new EmphasisNode(this, arenaIndex);
      case StrongOpen: return new StrongNode(this, arenaIndex);
      case StrikethroughOpen: return new StrikethroughNode(this, arenaIndex);
      case HTMLTagOpen: return new HTMLTagNode(this, arenaIndex);
      case HTMLCommentOpen: return new HTMLCommentNode(this, arenaIndex);
      case HTMLCDataOpen: return new HTMLCDataNode(this, arenaIndex);
      case HTMLDocTypeOpen: return new HTMLDocTypeNode(this, arenaIndex);
      case HTMLRawText: return new HTMLRawTextNode(this, arenaIndex);
      case XMLProcessingInstructionOpen: return new XmlPINode(this, arenaIndex);
      case FormulaOpen: return new FormulaBlockNode(this, arenaIndex);
      case FrontmatterOpen: return new FrontmatterNode(this, arenaIndex);
      case EntityNamed:
      case EntityDecimal:
      case EntityHex: return new EntityNode(this, arenaIndex);
      case Escaped: return new EscapedNode(this, arenaIndex);
      case AngleLinkOpen:
      case RawURL:
      case WWWAutolink:
      case EmailAutolink: return new AutolinkNode(this, arenaIndex);
      case InlineCode:
      case BacktickBoundary: return new InlineCodeNode(this, arenaIndex);
      case BulletListMarker:
      case OrderedListMarker:
      case TaskListMarker: return new ListItemNode(this, arenaIndex);
      case BlockquoteMarker: return new BlockquoteNode(this, arenaIndex);
      case ThematicBreak: return new ThematicBreakNode(this, arenaIndex);
      case InlineText:
      case Whitespace:
      case NewLine: return new TextNode(this, arenaIndex);
      default: return new BaseNode(this, arenaIndex);
    }
  }
}
