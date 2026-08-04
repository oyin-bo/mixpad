// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';
import { scan0 } from './scan0.js';
import {
  createArena, allocateNode, getHeader, getFirstChild,
  getNextSibling, setNextSibling, NODE_STRIDE, spliceNodes
} from './green-arena.js';
import {
  createParagraphIndex, addParagraph, findParagraph,
  getParagraphOffset, getArenaIndex, shiftFrom, spliceParagraphs
} from './paragraph-index.js';

/**
 * SourceFile: the root manager coordinating the source text,
 * the Green Arena, and the Paragraph Index.
 *
 * It exposes methods like `getNodeAt(offset)` and `update(newText, changeSpan)`.
 */
export class SourceFile {
  /** @type {string} */
  text;

  /** @type {import('./green-arena.js').GreenArena} */
  arena;

  /** @type {import('./paragraph-index.js').ParagraphIndex} */
  paragraphIndex;

  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
    this.arena = createArena();
    this.paragraphIndex = createParagraphIndex();
    this._buildTree(text, 0, text.length);
  }

  /**
   * Build the arena from scanned tokens for the given text range.
   * Tokens within each paragraph are linked as siblings via NextSibling.
   * Paragraph boundaries are detected via the IsSafeReparsePoint flag.
   * @param {string} text
   * @param {number} startOffset
   * @param {number} endOffset
   * @private
   */
  _buildTree(text, startOffset, endOffset) {
    /** @type {number[]} */
    const tokenBuf = [];
    let pos = startOffset;
    let prevSiblingNode = 0;
    let paragraphFirstNode = 0;
    let needNewParagraph = true;

    while (pos < endOffset) {
      tokenBuf.length = 0;
      const count = scan0({
        input: text,
        startOffset: pos,
        endOffset,
        output: tokenBuf
      });
      if (count === 0) break;

      for (let i = 0; i < count; i++) {
        const token = tokenBuf[i];
        const len = getTokenLength(token);

        if (needNewParagraph) {
          paragraphFirstNode = this.arena.length;
          addParagraph(this.paragraphIndex, pos, paragraphFirstNode);
          needNewParagraph = false;
        }

        const nodeIndex = allocateNode(this.arena, token);

        if (prevSiblingNode > 0) {
          setNextSibling(this.arena, prevSiblingNode, nodeIndex);
        }
        prevSiblingNode = nodeIndex;

        pos += len;

        if (token & IsSafeReparsePoint) {
          prevSiblingNode = 0;
          paragraphFirstNode = 0;
          if (pos < endOffset) {
            needNewParagraph = true;
          }
        }
      }
    }
  }

  /**
   * Find the arena node at an absolute text offset.
   * Uses the paragraph index for O(log P) paragraph lookup,
   * then walks siblings in O(N children) to find the exact node.
   * @param {number} offset
   * @returns {{ nodeIndex: number, nodeOffset: number } | null}
   */
  getNodeAt(offset) {
    if (offset < 0 || offset >= this.text.length) return null;

    const paragraphIdx = findParagraph(this.paragraphIndex, offset);
    if (paragraphIdx < 0) return null;

    const baseOffset = getParagraphOffset(this.paragraphIndex, paragraphIdx);
    const firstNodeIndex = getArenaIndex(this.paragraphIndex, paragraphIdx);

    let nodeOffset = baseOffset;
    let idx = firstNodeIndex;

    while (idx > 0 && idx < this.arena.length) {
      const header = getHeader(this.arena, idx);
      const width = getTokenLength(header);

      if (offset >= nodeOffset && offset < nodeOffset + width) {
        return { nodeIndex: idx, nodeOffset };
      }

      nodeOffset += width;
      idx = getNextSibling(this.arena, idx);
    }

    return null;
  }

  /**
   * Update the source text and incrementally re-parse the affected region.
   * @param {string} newText
   * @param {{ start: number, oldEnd: number, newEnd: number }} changeSpan
   */
  update(newText, changeSpan) {
    this.text = newText;

    // Full rebuild for now; incremental convergence-based patching is future work
    this.arena = createArena();
    this.paragraphIndex = createParagraphIndex();
    this._buildTree(newText, 0, newText.length);
  }
}
