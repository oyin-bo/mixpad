// @ts-check

import { BlockquoteMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan blockquote marker: `>` at the beginning of a line
 *
 * Rules:
 * - Must be the first non-whitespace character on the line
 * - Indentation preceding `>` must be ≤ 3 spaces (4+ = indented code block)
 * - The trailing space after `>` (if present) is left for scan0's normal whitespace handling
 *
 * Token: BlockquoteMarker, length 1 (the `>` character). Consumed: always 1.
 *
 * @param {string} input - The input text
 * @param {number} start - Start index (position of `>`)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} 1 if a blockquote marker was recognized, 0 otherwise
 */
export function scanBlockquote(input, start, end, output) {
  if (start >= end) return 0;

  if (input.charCodeAt(start) !== 62 /* > */) return 0;

  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;

  // `>` must be the first non-whitespace character on the line
  if (lineStart + lineIndent !== start) return 0;

  output.push(1 | BlockquoteMarker);
  return 1;
}
