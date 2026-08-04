// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';
import { semantic } from './semantic.js';
import {
  NewLine,
  ATXHeadingOpen, ATXHeadingClose,
  EmphasisOpen, EmphasisClose,
  StrongOpen, StrongClose,
  StrikethroughOpen, StrikethroughClose,
  FencedOpen, FencedClose,
  FormulaOpen, FormulaClose,
  FrontmatterOpen, FrontmatterClose,
  LinkOpen, LinkClose
} from './scan-tokens.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

// ── Arena layout constants ────────────────────────────────────────────────────

/** Number of array slots per node in the Green Arena. */
export const NODE_STRIDE = 4;

/** Slot offset: packed ProvisionalToken (kind | length | flags). */
export const NODE_HEADER = 0;

/** Slot offset: arena index of first child (0 = none). */
export const NODE_FIRST_CHILD = 1;

/** Slot offset: arena index of next sibling (0 = none). */
export const NODE_NEXT_SIBLING = 2;

/**
 * Slot offset: materialized payload.
 * For container nodes: stores the opening-marker width (number) so children's
 * positions can be resolved as `containerPos + markerWidth + siblingOffsets`.
 * For leaf nodes: null (or a string for lazily-materialized link destinations).
 */
export const NODE_MATERIALIZED = 3;

// ── Red Facade classes ────────────────────────────────────────────────────────

/**
 * RedNode: persistent façade over a single Green Arena node.
 *
 * Absolute positions are computed lazily by walking the tree from the paragraph
 * base offset — never stored on the node itself, so a parent change does not
 * invalidate the cached object.
 */
export class RedNode {
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
  get header() {
    return this.sourceFile.arena[this.arenaIndex + NODE_HEADER];
  }

  /** @returns {import('./scan-core.js').TokenKind} */
  get kind() {
    return getTokenKind(this.header);
  }

  /** Width in source characters (updated to span after container close). */
  get width() {
    return getTokenLength(this.header);
  }

  /** Token flags. */
  get flags() {
    return getTokenFlags(this.header);
  }

  /** Materialized payload (opening-marker width for containers, null for leaves). */
  get data() {
    return this.sourceFile.arena[this.arenaIndex + NODE_MATERIALIZED];
  }

  /**
   * Absolute source offset of this node, computed lazily.
   * O(N children) in the containing paragraph.
   * @returns {number}
   */
  get offset() {
    return this.sourceFile._getNodePos(this.arenaIndex);
  }

  /** Source text covered by this node (using lazy offset + width). */
  get text() {
    const p = this.offset;
    return this.sourceFile.text.substring(p, p + this.width);
  }

  /**
   * First child node, or null if this is a leaf.
   * @returns {RedNode | null}
   */
  get firstChild() {
    const idx = this.sourceFile.arena[this.arenaIndex + NODE_FIRST_CHILD];
    return idx !== 0 ? this.sourceFile._getOrCreateRedNode(idx) : null;
  }

  /**
   * Next sibling node, or null if this is the last sibling.
   * @returns {RedNode | null}
   */
  get nextSibling() {
    const idx = this.sourceFile.arena[this.arenaIndex + NODE_NEXT_SIBLING];
    return idx !== 0 ? this.sourceFile._getOrCreateRedNode(idx) : null;
  }

  /**
   * Collect all direct children into an array.
   * @returns {RedNode[]}
   */
  getChildren() {
    /** @type {RedNode[]} */
    const children = [];
    let child = this.firstChild;
    while (child) {
      children.push(child);
      child = child.nextSibling;
    }
    return children;
  }
}

/**
 * Entity-affinitive node for ATX headings.
 * `getLevel()` re-scans the source rather than storing depth, following the
 * "Re-Scan Principle" from the architecture spec.
 */
export class HeadingNode extends RedNode {
  /**
   * Count leading `#` characters to determine heading depth (1–6).
   * @returns {number}
   */
  getLevel() {
    const text = this.sourceFile.text;
    const pos = this.offset;
    let level = 0;
    while (level < 6 && text[pos + level] === '#') level++;
    return level;
  }
}

/**
 * Entity-affinitive node for links.
 * `getDestination()` returns the materialized destination if available,
 * otherwise returns an empty string (lazy extraction is left for future work).
 */
export class LinkNode extends RedNode {
  /**
   * @returns {string}
   */
  getDestination() {
    const d = this.data;
    return typeof d === 'string' ? d : '';
  }
}

/**
 * Entity-affinitive node for fenced code blocks.
 * `getFenceChar()` re-scans a single character from source (Re-Scan Principle).
 */
export class CodeBlockNode extends RedNode {
  /**
   * @returns {string}
   */
  getFenceChar() {
    return this.sourceFile.text[this.offset] || '';
  }
}

// ── SourceFile ────────────────────────────────────────────────────────────────

/**
 * SourceFile: root manager for the source text, the Green Arena, and the
 * Paragraph Index.
 *
 * ### Green Arena layout (NODE_STRIDE = 4 slots per node)
 * ```
 *   arena[i + NODE_HEADER]      — ProvisionalToken (kind | length | flags)
 *   arena[i + NODE_FIRST_CHILD] — arena index of first child, or 0
 *   arena[i + NODE_NEXT_SIBLING]— arena index of next sibling, or 0
 *   arena[i + NODE_MATERIALIZED]— opening-marker width (containers) or null (leaves)
 * ```
 * Index 0 is the null sentinel (all "no child / no sibling" pointers use 0).
 *
 * ### Paragraph Index
 * `paragraphIndex[p]` holds the absolute source offset where paragraph `p`
 * begins; `paragraphArenaIndices[p]` holds the arena index of its first node.
 * A paragraph boundary is detected by the `IsSafeReparsePoint` flag on the
 * first token of the new paragraph.
 *
 * ### Hierarchical tree
 * Container tokens (EmphasisOpen, StrongOpen, ATXHeadingOpen, FencedOpen,
 * LinkOpen, …) push a stack frame; their corresponding close tokens (or an
 * auto-close on NewLine for ATX headings) pop it and update the container
 * node's header width to the full span.  Children are linked into the
 * container's FIRST_CHILD / NEXT_SIBLING chain.
 */
export class SourceFile {
  /** @param {string} text */
  constructor(text) {
    /** @type {string} */
    this.text = text;

    /**
     * Green Arena: flat native JavaScript Array.
     * Never replaced (only mutated) so consumers can hold a reference across edits.
     * @type {(number | null)[]}
     */
    this.arena = [];

    /**
     * Paragraph Index: absolute source offset of each paragraph's first token.
     * @type {number[]}
     */
    this.paragraphIndex = [];

    /**
     * Parallel array: arena index of each paragraph's first node.
     * @type {number[]}
     */
    this.paragraphArenaIndices = [];

    /** @type {Map<number, RedNode>} */
    this._redCache = new Map();

    this._build();
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Overwrite the width field (bits 0–15) of a node's header.
   * @param {number} arenaIndex
   * @param {number} newWidth
   * @private
   */
  _updateNodeWidth(arenaIndex, newWidth) {
    this.arena[arenaIndex + NODE_HEADER] =
      (/** @type {number} */(this.arena[arenaIndex + NODE_HEADER]) & ~0xFFFF) | (newWidth & 0xFFFF);
  }

  // ── Internal build ──────────────────────────────────────────────────────────

  /**
   * Build (or rebuild) the arena and paragraph index from `this.text`.
   * Clears the arena and indices in-place (maintains array reference identity).
   * @private
   */
  _build() {
    this.arena.length = 0;
    this.paragraphIndex.length = 0;
    this.paragraphArenaIndices.length = 0;
    this._redCache.clear();

    // Index 0 is the null sentinel — all "no node" pointers use 0.
    this.arena.push(0, 0, 0, null);

    if (!this.text.length) return;

    const tokens = /** @type {ProvisionalToken[]} */ ([]);
    semantic({ input: this.text, startOffset: 0, endOffset: this.text.length })(tokens);

    /**
     * Stack of open container frames.
     * Each frame: { arenaIndex, startPos, lastChildIdx }
     * - arenaIndex: arena index of the open container node (0 = virtual root)
     * - startPos: source offset where the container opened
     * - lastChildIdx: arena index of the last child added (0 = none yet)
     */
    const stack = [{ arenaIndex: 0, startPos: 0, lastChildIdx: 0 }];

    let pos = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const kind = getTokenKind(token);
      const len = getTokenLength(token);
      const flags = getTokenFlags(token);

      // Paragraph boundary: record BEFORE pushing the current node so that
      // paragraphArenaIndices[p] equals the arena index of the about-to-be-
      // added first node of the new paragraph.
      if ((flags & IsSafeReparsePoint) && pos > 0) {
        this.paragraphIndex.push(pos);
        this.paragraphArenaIndices.push(this.arena.length);
      }

      if (this._isOpenToken(kind)) {
        // Open a new container: push the token as a node, then push a stack frame.
        const idx = this._pushNode(token, stack[stack.length - 1]);
        // Store the original opening-marker width in NODE_MATERIALIZED so that
        // _findPos can correctly offset into children after the header width is
        // updated to the full container span.
        this.arena[idx + NODE_MATERIALIZED] = len;
        stack.push({ arenaIndex: idx, startPos: pos, lastChildIdx: 0 });
      } else if (this._isCloseToken(kind)) {
        // Close token: pop the matching container and update its span.
        const top = stack.length > 1 ? stack.pop() : null;
        if (top && top.arenaIndex !== 0) {
          this._updateNodeWidth(top.arenaIndex, (pos + len) - top.startPos);
        }
        // The close token itself is absorbed into the container; not a separate node.
      } else {
        // Leaf token.  But first, check if we must auto-close an ATX heading on
        // this NewLine (ATX headings have no explicit close token unless a closing
        // `#` sequence is used, which emits ATXHeadingClose handled above).
        if (kind === NewLine && stack.length > 1) {
          const top = stack[stack.length - 1];
          if (top.arenaIndex !== 0) {
            const topKind = getTokenKind(/** @type {number} */(this.arena[top.arenaIndex + NODE_HEADER]));
            if (topKind === ATXHeadingOpen) {
              stack.pop();
              // Include this NewLine's length in the heading's total span so that
              // heading.text covers the full `# Heading\n` line.
              this._updateNodeWidth(top.arenaIndex, (pos + len) - top.startPos);
            }
          }
        }
        // Push the leaf token (or the NewLine after auto-close) into the current parent.
        this._pushNode(token, stack[stack.length - 1]);
      }

      pos += len;
    }

    // EOF: close any containers that were never explicitly closed (e.g., unclosed code fences).
    while (stack.length > 1) {
      const top = stack.pop();
      if (top && top.arenaIndex !== 0) {
        this._updateNodeWidth(top.arenaIndex, pos - top.startPos);
      }
    }

    // The first paragraph always starts at offset 0.  Because we skip recording
    // REPARSE tokens at pos === 0, we prepend it here after the loop.
    if (this.arena.length > NODE_STRIDE) {
      this.paragraphIndex.unshift(0);
      // The first real node is always pushed at arena index NODE_STRIDE (right
      // after the 4-slot null sentinel).
      this.paragraphArenaIndices.unshift(NODE_STRIDE);
    }
  }

  /**
   * Push a token as a new leaf/container node into `parent`'s child list.
   * Updates parent.lastChildIdx and returns the new node's arena index.
   * @param {ProvisionalToken} token
   * @param {{ arenaIndex: number, startPos: number, lastChildIdx: number }} parent
   * @returns {number} arena index of the new node
   * @private
   */
  _pushNode(token, parent) {
    const idx = this.arena.length;
    this.arena.push(token, 0, 0, null);
    if (parent.lastChildIdx !== 0) {
      // Link into sibling chain
      this.arena[parent.lastChildIdx + NODE_NEXT_SIBLING] = idx;
    } else {
      // First child of this parent
      this.arena[parent.arenaIndex + NODE_FIRST_CHILD] = idx;
    }
    parent.lastChildIdx = idx;
    return idx;
  }

  /** @param {number} kind @returns {boolean} @private */
  _isOpenToken(kind) {
    return kind === EmphasisOpen || kind === StrongOpen || kind === StrikethroughOpen ||
      kind === ATXHeadingOpen || kind === FencedOpen ||
      kind === FormulaOpen || kind === FrontmatterOpen ||
      kind === LinkOpen;
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
   * Return the RedNode covering `offset`, or null if the document is empty or
   * the offset is out of range.
   *
   * Performs a binary search over the paragraph index (O(log P)) then a
   * depth-first tree walk within the paragraph (O(N children)).
   *
   * @param {number} offset - Absolute source offset
   * @returns {RedNode | null}
   */
  getNodeAt(offset) {
    if (!this.paragraphIndex.length || offset < 0 || offset >= this.text.length) return null;

    // Find the rightmost paragraph whose base offset ≤ offset.
    let lo = 0;
    let hi = this.paragraphIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.paragraphIndex[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }

    return this._findNodeAt(
      this.paragraphArenaIndices[lo],
      this.paragraphIndex[lo],
      offset
    );
  }

  /**
   * Return (or create and cache) a RedNode for the given arena index.
   * Returns the correct entity-affinitive subclass (HeadingNode, etc.).
   * @param {number} arenaIndex
   * @returns {RedNode}
   */
  getRedNode(arenaIndex) {
    return this._getOrCreateRedNode(arenaIndex);
  }

  /**
   * Apply a text edit and rebuild the arena and paragraph index in-place.
   *
   * The arena array reference is preserved (only its contents change), so
   * consumers holding a reference to `sourceFile.arena` see the updated data.
   *
   * @param {string} newText - The complete new source text after the edit.
   * @param {{ start: number, end?: number, oldEnd?: number, newEnd?: number }} changeSpan
   */
  update(newText, changeSpan) {
    this.text = newText;
    this._build();
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Depth-first search for the innermost node covering `targetOffset`.
   * Tries children before falling back to the container itself, so the deepest
   * (most specific) node is returned.
   * @param {number} startIdx - Arena index of the first sibling to check
   * @param {number} startPos - Source offset of startIdx
   * @param {number} targetOffset
   * @returns {RedNode | null}
   * @private
   */
  _findNodeAt(startIdx, startPos, targetOffset) {
    let idx = startIdx;
    let pos = startPos;
    while (idx !== 0) {
      const width = getTokenLength(/** @type {number} */(this.arena[idx + NODE_HEADER]));
      if (targetOffset >= pos && targetOffset < pos + width) {
        // Offset is within this node's span — try to descend into children.
        const childIdx = /** @type {number} */(this.arena[idx + NODE_FIRST_CHILD]);
        if (childIdx !== 0) {
          // Children start after the opening-marker (stored in NODE_MATERIALIZED).
          const markerWidth = /** @type {number} */(this.arena[idx + NODE_MATERIALIZED]) || 0;
          const found = this._findNodeAt(childIdx, pos + markerWidth, targetOffset);
          if (found) return found;
        }
        return this._getOrCreateRedNode(idx);
      }
      pos += width;
      idx = /** @type {number} */(this.arena[idx + NODE_NEXT_SIBLING]);
    }
    return null;
  }

  /**
   * Recursive walk: return the absolute source offset of `targetIdx` by
   * traversing the tree from `startIdx` (the first sibling) at `startPos`.
   * @param {number} startIdx
   * @param {number} startPos
   * @param {number} targetIdx
   * @returns {number | null}
   * @private
   */
  _findPos(startIdx, startPos, targetIdx) {
    let idx = startIdx;
    let pos = startPos;
    while (idx !== 0) {
      if (idx === targetIdx) return pos;
      const childIdx = /** @type {number} */(this.arena[idx + NODE_FIRST_CHILD]);
      if (childIdx !== 0) {
        const markerWidth = /** @type {number} */(this.arena[idx + NODE_MATERIALIZED]) || 0;
        const found = this._findPos(childIdx, pos + markerWidth, targetIdx);
        if (found !== null) return found;
      }
      pos += getTokenLength(/** @type {number} */(this.arena[idx + NODE_HEADER]));
      idx = /** @type {number} */(this.arena[idx + NODE_NEXT_SIBLING]);
    }
    return null;
  }

  /**
   * Compute the absolute source offset of the node at `arenaIndex`.
   * Uses binary search to find its paragraph, then `_findPos` to walk the tree.
   * @param {number} arenaIndex
   * @returns {number}
   * @private
   */
  _getNodePos(arenaIndex) {
    if (!this.paragraphArenaIndices.length) return 0;

    // Find the rightmost paragraph whose first-node index ≤ arenaIndex.
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
   * Return (or create) the cached RedNode for `arenaIndex`.
   * Dispatches to the appropriate entity-affinitive subclass.
   * @param {number} arenaIndex
   * @returns {RedNode}
   * @private
   */
  _getOrCreateRedNode(arenaIndex) {
    let node = this._redCache.get(arenaIndex);
    if (!node) {
      const kind = getTokenKind(/** @type {number} */(this.arena[arenaIndex + NODE_HEADER]));
      if (kind === ATXHeadingOpen) {
        node = new HeadingNode(this, arenaIndex);
      } else if (kind === LinkOpen) {
        node = new LinkNode(this, arenaIndex);
      } else if (kind === FencedOpen) {
        node = new CodeBlockNode(this, arenaIndex);
      } else {
        node = new RedNode(this, arenaIndex);
      }
      this._redCache.set(arenaIndex, node);
    }
    return node;
  }
}
