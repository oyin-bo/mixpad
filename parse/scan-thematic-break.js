// @ts-check

import { countIndentation, findLineStart } from './scan-core.js';
import { ThematicBreak } from './scan-tokens.js';

/**
 * Scan a thematic break line.
 *
 * Rules:
 * - Three or more of the same delimiter: *, -, or _
 * - Spaces/tabs may appear between delimiter characters
 * - Up to 3 spaces of leading indentation
 * - Must be the first non-whitespace on its line
 * - No other non-whitespace characters on the line
 *
 * @param {string} input - The input text
 * @param {number} start - Position of the first *, -, or _
 * @param {number} end - End offset (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed from start, or 0 if not a thematic break
 */
export function scanThematicBreak(input, start, end, output) {
  if (start >= end) return 0;

  const firstChar = input.charCodeAt(start);
  if (firstChar !== 42 /* * */ && firstChar !== 45 /* - */ && firstChar !== 95 /* _ */) return 0;

  // Must be at the first non-whitespace position on the line
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;
  if (lineStart + lineIndent !== start) return 0;

  let offset = start;
  let count = 0;
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    if (ch === firstChar) {
      count++;
      offset++;
    } else if (ch === 32 /* space */ || ch === 9 /* tab */) {
      offset++;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */ || ch === 0) {
      break;
    } else {
      return 0; // Invalid character found on line
    }
  }

  if (count < 3) return 0;

  output.push((offset - start) | ThematicBreak);
  return offset - start;
}
