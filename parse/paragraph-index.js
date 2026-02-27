// @ts-check

/**
 * The Paragraph Index: a pair of parallel arrays storing absolute text offsets
 * and corresponding arena indices for each paragraph boundary.
 * Used as the coordinate bridge between absolute file positions and the
 * relative-only Green Arena.
 * @typedef {{
 *   offsets: number[],
 *   arenaIndices: number[]
 * }} ParagraphIndex
 */

/**
 * Create a new empty paragraph index.
 * @returns {ParagraphIndex}
 */
export function createParagraphIndex() {
  return { offsets: [], arenaIndices: [] };
}

/**
 * Record a paragraph boundary.
 * @param {ParagraphIndex} index
 * @param {number} offset - Absolute text offset where the paragraph starts
 * @param {number} arenaIndex - Arena index of the first node in this paragraph
 */
export function addParagraph(index, offset, arenaIndex) {
  index.offsets.push(offset);
  index.arenaIndices.push(arenaIndex);
}

/**
 * Find which paragraph contains the given absolute offset.
 * Uses binary search for O(log n) lookup.
 * @param {ParagraphIndex} index
 * @param {number} offset
 * @returns {number} 0-based paragraph index, or -1 if the index is empty
 */
export function findParagraph(index, offset) {
  const offsets = index.offsets;
  if (offsets.length === 0) return -1;

  let lo = 0;
  let hi = offsets.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (offsets[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

/**
 * Get the absolute text offset of a paragraph.
 * @param {ParagraphIndex} index
 * @param {number} paragraphIdx
 * @returns {number}
 */
export function getParagraphOffset(index, paragraphIdx) {
  return index.offsets[paragraphIdx];
}

/**
 * Get the arena index of the first node in a paragraph.
 * @param {ParagraphIndex} index
 * @param {number} paragraphIdx
 * @returns {number}
 */
export function getArenaIndex(index, paragraphIdx) {
  return index.arenaIndices[paragraphIdx];
}

/**
 * Shift all paragraph offsets from `fromParagraph` onwards by `delta`.
 * Used after an edit to adjust downstream paragraph positions.
 * @param {ParagraphIndex} index
 * @param {number} fromParagraph - First paragraph to shift (inclusive)
 * @param {number} delta - Characters to add (negative for deletions)
 */
export function shiftFrom(index, fromParagraph, delta) {
  for (let i = fromParagraph; i < index.offsets.length; i++) {
    index.offsets[i] += delta;
  }
}

/**
 * Splice paragraphs: remove a range and optionally insert new entries.
 * @param {ParagraphIndex} index
 * @param {number} start - First paragraph to remove
 * @param {number} deleteCount - Number of paragraphs to remove
 * @param {number[]} [newOffsets] - New paragraph text offsets to insert
 * @param {number[]} [newArenaIndices] - Corresponding arena indices
 */
export function spliceParagraphs(index, start, deleteCount, newOffsets, newArenaIndices) {
  if (newOffsets && newOffsets.length > 0) {
    index.offsets.splice(start, deleteCount, ...newOffsets);
    index.arenaIndices.splice(start, deleteCount, ...(newArenaIndices || []));
  } else {
    index.offsets.splice(start, deleteCount);
    index.arenaIndices.splice(start, deleteCount);
  }
}
