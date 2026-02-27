// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { HeadingDepthMask, HeadingDepthShift } from './scan-token-flags.js';
import {
  getHeader, getFirstChild, getNextSibling, getMaterialized, NODE_STRIDE
} from './green-arena.js';
import {
  findParagraph, getParagraphOffset, getArenaIndex
} from './paragraph-index.js';

/**
 * RedNode: a persistent facade wrapping a Green Arena node.
 * Provides a developer-friendly API for accessing node data
 * and computing absolute positions lazily from the Paragraph Index.
 *
 * Nodes never store their parent pointer, allowing Green nodes to be
 * reused even if their parent changes after an edit.
 */
export class RedNode {
  /** @type {import('./green-arena.js').GreenArena} */
  _arena;

  /** @type {import('./paragraph-index.js').ParagraphIndex} */
  _paragraphIndex;

  /** @type {number} */
  _index;

  /**
   * @param {import('./green-arena.js').GreenArena} arena
   * @param {import('./paragraph-index.js').ParagraphIndex} paragraphIndex
   * @param {number} index - Arena index of the wrapped node
   */
  constructor(arena, paragraphIndex, index) {
    this._arena = arena;
    this._paragraphIndex = paragraphIndex;
    this._index = index;
  }

  /** Arena index of this node. */
  get index() {
    return this._index;
  }

  /** The raw header (ProvisionalToken). */
  get header() {
    return getHeader(this._arena, this._index);
  }

  /** @returns {import('./scan-core.js').TokenKind} */
  get kind() {
    return getTokenKind(this.header);
  }

  /** Width in characters (from the header's lower 16 bits). */
  get width() {
    return getTokenLength(this.header);
  }

  /** Flags (bits 29-30 of the header). */
  get flags() {
    return getTokenFlags(this.header);
  }

  /** Heading depth (bits 26-28), 0 if not a heading. */
  get headingDepth() {
    return (this.header & HeadingDepthMask) >>> HeadingDepthShift;
  }

  /** Arena index of the first child (0 = no children). */
  get firstChildIndex() {
    return getFirstChild(this._arena, this._index);
  }

  /** Arena index of the next sibling (0 = last sibling). */
  get nextSiblingIndex() {
    return getNextSibling(this._arena, this._index);
  }

  /** Materialized data (null if not materialized). */
  get materialized() {
    return getMaterialized(this._arena, this._index);
  }

  /**
   * Compute the absolute position of this node in the source text.
   * Uses the Paragraph Index to find the base offset, then sums
   * sibling widths from the paragraph's first node up to this one.
   * @returns {number} Absolute character offset in the source text, or -1 if the
   *   node cannot be located in any paragraph (indicates a corrupted or stale reference)
   */
  getAbsolutePosition() {
    const paragraphIdx = findParagraphForArenaIndex(
      this._paragraphIndex, this._index
    );
    if (paragraphIdx < 0) return -1;

    const baseOffset = getParagraphOffset(this._paragraphIndex, paragraphIdx);
    const firstNode = getArenaIndex(this._paragraphIndex, paragraphIdx);

    let offset = baseOffset;
    let current = firstNode;

    while (current > 0 && current !== this._index) {
      offset += getTokenLength(getHeader(this._arena, current));
      current = getNextSibling(this._arena, current);
    }

    return offset;
  }

  /**
   * Return a RedNode for the first child, or null if none.
   * @returns {RedNode | null}
   */
  firstChild() {
    const idx = this.firstChildIndex;
    if (idx === 0) return null;
    return new RedNode(this._arena, this._paragraphIndex, idx);
  }

  /**
   * Return a RedNode for the next sibling, or null if none.
   * @returns {RedNode | null}
   */
  nextSibling() {
    const idx = this.nextSiblingIndex;
    if (idx === 0) return null;
    return new RedNode(this._arena, this._paragraphIndex, idx);
  }
}

/**
 * Find which paragraph an arena index belongs to by scanning the
 * paragraph arenaIndices. The node belongs to the last paragraph
 * whose arenaIndex is <= the given index.
 * @param {import('./paragraph-index.js').ParagraphIndex} paragraphIndex
 * @param {number} arenaIdx
 * @returns {number} Paragraph index, or -1 if not found
 */
function findParagraphForArenaIndex(paragraphIndex, arenaIdx) {
  const indices = paragraphIndex.arenaIndices;
  if (indices.length === 0) return -1;

  let lo = 0;
  let hi = indices.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (indices[mid] <= arenaIdx) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}
