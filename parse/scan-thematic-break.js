// @ts-check

import { countIndentation, findLineStart } from './scan-core.js';
import { ThematicBreak } from './scan-tokens.js';

/**
 * Scan a thematic break (horizontal rule).
 *
 * A thematic break consists of 3 or more of the same delimiter character
 * (*, -, or _) optionally separated by spaces, with up to 3 spaces of
 * leading indentation and no other content on the line.
 *
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - position of the first delimiter character
 * @param {number} end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed, or 0 if not a thematic break
 */
export function scanThematicBreak(input, start, end, output) {
  if (start >= end) return 0;

  const firstChar = input.charCodeAt(start);
  if (firstChar !== 42 /* * */ && firstChar !== 45 /* - */ && firstChar !== 95 /* _ */) return 0;

  // Must be at the first non-whitespace position on the line (at most 3 spaces indent)
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
      return 0;
    }
  }

  if (count < 3) return 0;

  output.push((offset - start) | ThematicBreak);
  return offset - start;
}
