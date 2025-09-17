// @ts-check

import { Escaped } from './scan-tokens.js';

/**
 * Parsing an escape sequence starting at `start` (where input[start] === "\\").
 * If an escape is present, return a provisional token value (length | Escaped),
 * otherwise return 0.
 *
 * Conservative behavior:
 *  - If backslash is at EOF, consume it as a single-character Escaped token (length 1)
 *  - If backslash is followed by any character, consume both (length 2)
 *  - Never allocate; only return numeric token encoding
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} provisional token (length | InlineText) or 0
 */
export function scanEscaped(input, start, end) {
  if (start < 0 || start >= end) return 0;
  if (input.charCodeAt(start) !== 92 /* \ */) return 0;

  // Minimum consumption is the backslash itself
  if (start + 1 >= end) {
    // backslash at end -> length 1
    return Escaped | 1;
  }

  // backslash + following char -> length 2
  return Escaped | 2;
}
