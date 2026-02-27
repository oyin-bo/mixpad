// @ts-check

import { getTokenFlags, getTokenLength } from './scan-core.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';
import { semantic } from './semantic.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

/** Number of array slots occupied by each node in the Green Arena. */
export const NODE_STRIDE = 4;

/** Slot offset within a node: packed ProvisionalToken header (kind | length | flags). */
export const NODE_HEADER = 0;

/** Slot offset within a node: arena index of the first child node (0 = none). */
export const NODE_FIRST_CHILD = 1;

/** Slot offset within a node: arena index of the next sibling node (0 = none). */
export const NODE_NEXT_SIBLING = 2;

/** Slot offset within a node: materialized payload — a string, object, or null when absent. */
export const NODE_MATERIALIZED = 3;

/**
 * SourceFile: root manager for the source text, the Green Arena, and the Paragraph Index.
 *
 * The arena and paragraphIndex are **native JavaScript Arrays** — never TypedArrays — so they
 * grow without reallocation, support `splice()` for incremental re-parsing, and can hold both
 * integer node headers and nullable materialized payloads in a single structure.
 *
 * ### Node Layout
 * Each node occupies exactly NODE_STRIDE (4) consecutive slots:
 * ```
 *   arena[i + NODE_HEADER]      — ProvisionalToken (kind | length | flags)
 *   arena[i + NODE_FIRST_CHILD] — arena index of first child, or 0
 *   arena[i + NODE_NEXT_SIBLING]— arena index of next sibling, or 0
 *   arena[i + NODE_MATERIALIZED]— materialized string/object, or null
 * ```
 * Index 0 is the null sentinel: all "no child / no sibling" references use 0.
 *
 * ### Paragraph Index
 * `paragraphIndex[p]` holds the absolute source offset where paragraph `p` begins.
 * Coordinate calculation for a node: start from `paragraphIndex[p]`, then sum
 * the widths of preceding siblings within that paragraph.
 */
export class SourceFile {
  /** @param {string} text */
  constructor(text) {
    /** @type {string} The raw source text. */
    this.text = text;

    /**
     * Green Arena: flat native JavaScript Array of node slots.
     * @type {(number | null)[]}
     */
    this.arena = [];

    /**
     * Paragraph Index: absolute source offset where each paragraph begins.
     * @type {number[]}
     */
    this.paragraphIndex = [];

    /** @type {number[]} */
    this._paragraphNodes = [];

    this._build();
  }

  /** Build the arena and paragraph index from scratch using the current `text`. */
  _build() {
    this.arena.length = 0;
    this.paragraphIndex.length = 0;
    this._paragraphNodes.length = 0;

    // Slot 0 is the null sentinel. All "no child / no sibling" slots reference 0.
    this.arena.push(0, 0, 0, null);

    if (!this.text.length) return;

    /** @type {number[]} */
    const tokens = [];
    semantic({ input: this.text, startOffset: 0, endOffset: this.text.length })(tokens);

    let sourceOffset = 0;
    let paraStartOffset = 0;
    let paraFirstNodeIdx = -1;
    let prevSiblingIdx = -1;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const flags = getTokenFlags(tok);
      const len = getTokenLength(tok);

      // A token with IsSafeReparsePoint at any position beyond the document start
      // marks the beginning of a new paragraph.
      if ((flags & IsSafeReparsePoint) && sourceOffset > 0) {
        if (paraFirstNodeIdx >= 0) {
          this.paragraphIndex.push(paraStartOffset);
          this._paragraphNodes.push(paraFirstNodeIdx);
        }
        paraStartOffset = sourceOffset;
        paraFirstNodeIdx = -1;
        prevSiblingIdx = -1;
      }

      const nodeIdx = this.arena.length;
      this.arena.push(tok, 0, 0, null);

      if (paraFirstNodeIdx < 0) {
        paraFirstNodeIdx = nodeIdx;
      } else {
        this.arena[prevSiblingIdx + NODE_NEXT_SIBLING] = nodeIdx;
      }
      prevSiblingIdx = nodeIdx;
      sourceOffset += len;
    }

    if (paraFirstNodeIdx >= 0) {
      this.paragraphIndex.push(paraStartOffset);
      this._paragraphNodes.push(paraFirstNodeIdx);
    }
  }

  /**
   * Return the arena index of the node covering the given source offset.
   * Uses a binary search over the paragraph index, then a sibling-chain walk.
   * @param {number} offset  Absolute source offset.
   * @returns {number}  Arena index, or 0 if the file is empty.
   */
  getNodeAt(offset) {
    if (!this.paragraphIndex.length) return 0;

    // Binary search: find the rightmost paragraph whose start ≤ offset.
    let lo = 0;
    let hi = this.paragraphIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.paragraphIndex[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }

    // Walk the sibling chain of paragraph lo, accumulating source positions.
    let pos = this.paragraphIndex[lo];
    let nodeIdx = this._paragraphNodes[lo];
    while (nodeIdx) {
      const len = getTokenLength(/** @type {number} */ (this.arena[nodeIdx + NODE_HEADER]));
      if (pos <= offset && offset < pos + len) return nodeIdx;
      pos += len;
      nodeIdx = /** @type {number} */ (this.arena[nodeIdx + NODE_NEXT_SIBLING]);
    }

    return this._paragraphNodes[lo];
  }

  /**
   * Apply a text edit and patch the arena and paragraph index incrementally.
   *
   * Identifies the earliest affected paragraph, re-scans the new text from that
   * paragraph's base offset to the end, then uses `Array.prototype.splice()` to
   * replace the stale arena slots in-place and updates the paragraph index.
   *
   * @param {string} newText  The complete new source text after the edit.
   * @param {{ start: number, end: number }} changeSpan  Changed range in the old text.
   */
  update(newText, changeSpan) {
    this.text = newText;

    if (!this.paragraphIndex.length) {
      this._build();
      return;
    }

    const startPara = this._findParagraph(changeSpan.start);
    const baseOffset = this.paragraphIndex[startPara];
    const arenaStart = this._paragraphNodes[startPara];

    /** @type {number[]} */
    const tokens = [];
    semantic({ input: newText, startOffset: baseOffset, endOffset: newText.length })(tokens);

    /** @type {(number | null)[]} */
    const relSlots = [];
    /** @type {number[]} */
    const newParaOffsets = [];
    /** @type {number[]} */
    const newParaRelNodes = [];

    let sourceOffset = baseOffset;
    let paraStartOffset = baseOffset;
    let paraFirstRelIdx = -1;
    let prevRelSiblingIdx = -1;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const flags = getTokenFlags(tok);
      const len = getTokenLength(tok);

      if ((flags & IsSafeReparsePoint) && sourceOffset > 0) {
        if (paraFirstRelIdx >= 0) {
          newParaOffsets.push(paraStartOffset);
          newParaRelNodes.push(paraFirstRelIdx);
        }
        paraStartOffset = sourceOffset;
        paraFirstRelIdx = -1;
        prevRelSiblingIdx = -1;
      }

      const relIdx = relSlots.length;
      relSlots.push(tok, 0, 0, null);

      if (paraFirstRelIdx < 0) {
        paraFirstRelIdx = relIdx;
      } else {
        relSlots[prevRelSiblingIdx + NODE_NEXT_SIBLING] = relIdx;
      }
      prevRelSiblingIdx = relIdx;
      sourceOffset += len;
    }

    if (paraFirstRelIdx >= 0) {
      newParaOffsets.push(paraStartOffset);
      newParaRelNodes.push(paraFirstRelIdx);
    }

    // Adjust relative arena indices to absolute by adding arenaStart.
    for (let i = 0; i < relSlots.length; i++) {
      const slotOffset = i % NODE_STRIDE;
      if (slotOffset === NODE_FIRST_CHILD || slotOffset === NODE_NEXT_SIBLING) {
        if (relSlots[i] !== 0) relSlots[i] = /** @type {number} */ (relSlots[i]) + arenaStart;
      }
    }

    const newParaAbsNodes = newParaRelNodes.map(ri => ri + arenaStart);

    // Patch the arena in-place using splice().
    this.arena.splice(arenaStart, this.arena.length - arenaStart, ...relSlots);

    // Patch the paragraph tables.
    this.paragraphIndex.splice(startPara, this.paragraphIndex.length - startPara, ...newParaOffsets);
    this._paragraphNodes.splice(startPara, this._paragraphNodes.length - startPara, ...newParaAbsNodes);
  }

  /**
   * Binary search: return the index of the rightmost paragraph whose base offset ≤ `offset`.
   * @param {number} offset
   * @returns {number}
   */
  _findParagraph(offset) {
    let lo = 0;
    let hi = this.paragraphIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.paragraphIndex[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
