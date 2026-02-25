// @ts-check

import { BlockquoteMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan blockquote marker: `>`
 *
 * A blockquote marker is a `>` character at the start of a line,
 * preceded by 0–3 spaces of indentation. Multiple `>` characters on
 * the same line (with optional spaces between them) represent nested
 * blockquotes; each is emitted as its own BlockquoteMarker token.
 *
 * Rules:
 * - The `>` must be at position lineStart + indent (0–3 spaces), or
 *   immediately follow other `>` characters on the same line.
 * - `>` preceded by any non-space, non-`>` character on the same line
 *   is not a blockquote marker (e.g. `a > b`).
 * - 4+ spaces of leading indentation classify as a code block, not a
 *   blockquote.
 * - If `>` is followed by a single space, that space is consumed as
 *   part of the marker (token length 2); otherwise length is 1.
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

  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;

  // All characters between (lineStart + lineIndent) and start must be `>` or spaces.
  // This allows `>> text` and `> > text` while rejecting mid-line `a > b`.
  let i = lineStart + lineIndent;
  while (i < start) {
    const ch = input.charCodeAt(i);
    if (ch !== 62 /* > */ && ch !== 32 /* space */) return 0;
    i++;
  }

  const hasSpace = start + 1 < end && input.charCodeAt(start + 1) === 32 /* space */;
  const length = hasSpace ? 2 : 1;
  output.push(length | BlockquoteMarker);
  return length;
}
