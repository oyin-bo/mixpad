// @ts-check

import { BlockquoteMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan blockquote marker: >
 *
 * Rules:
 * - `>` must be the first non-whitespace character on the line
 * - At most 3 spaces of indentation before `>`; 4+ spaces = code block, not blockquote
 * - If `>` is followed by a space, consumed length is 2 (marker + space); token length is 2
 * - Otherwise consumed and token length are both 1 (CommonMark allows `>text`)
 *
 * @param {string} input - The input text
 * @param {number} start - Start index (position of `>`)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a blockquote marker
 */
export function scanBlockquote(input, start, end, output) {
  if (start >= end) return 0;

  if (input.charCodeAt(start) !== 62 /* > */) return 0;

  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;

  // Marker must be first non-whitespace character on line
  if (lineStart + lineIndent !== start) return 0;

  // Consume a single space following the > if present
  if (start + 1 < end && input.charCodeAt(start + 1) === 32 /* space */) {
    output.push(2 | BlockquoteMarker);
    return 2;
  }

  output.push(1 | BlockquoteMarker);
  return 1;
}
