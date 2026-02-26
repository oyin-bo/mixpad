// @ts-check

import { BlockquoteMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan blockquote marker: `>`
 *
 * Rules:
 * - `>` must be at position `lineStart + indent` (0–3 spaces), or
 *   immediately follow other `>` or space characters on the same line.
 * - `>` preceded by any non-space, non-`>` character (e.g. `a > b`) is not a marker.
 * - 4+ spaces of leading indentation classify as a code block, not a blockquote.
 *
 * Token length is always 1 (the `>` character only).
 * The optional trailing space is left for scan0's whitespace handler.
 *
 * @param {string} input - The input text
 * @param {number} start - Start index (position of `>`)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} 1 if a blockquote marker was emitted, 0 otherwise
 */
export function scanBlockquote(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 62 /* > */) return 0;

  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;

  // All characters between (lineStart + lineIndent) and start must be `>` or space.
  // When start === lineStart + lineIndent (the common first-`>` case), the loop body
  // never executes and the `>` is accepted immediately. For subsequent `>` characters
  // on the same line (nested blockquotes), the loop verifies that every preceding
  // character is also `>` or space, rejecting mid-line cases like `a > b`.
  let i = lineStart + lineIndent;
  while (i < start) {
    const ch = input.charCodeAt(i);
    if (ch !== 62 /* > */ && ch !== 32 /* space */) return 0;
    i++;
  }

  output.push(1 | BlockquoteMarker);
  return 1;
}
