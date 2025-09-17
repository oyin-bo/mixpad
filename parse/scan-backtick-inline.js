// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
import { InlineCode, BacktickBoundary } from './scan-tokens.js';

/**
 * scanBacktickOpen: called when a backtick is encountered at `start`.
 * Scans the run of consecutive backticks and returns either 0 (rare EOF case)
 * or a provisional token encoding the BacktickBoundary with its length.
 *
 * @param {string} input
 * @param {number} start  index where input[start] === '`'
 * @param {number} end
 * @returns {number} BacktickBoundary|0
 */
export function scanBacktickOpen(input, start, end) {
  if (start < 0 || start >= end) return 0;
  if (input.charCodeAt(start) !== 96 /* ` */) return 0;

  let offset = start + 1;
  while (offset < end && input.charCodeAt(offset) === 96 /* ` */) offset++;
  const runLength = offset - start;

  // If the run reaches EOF (offset === end) we still return a BacktickBoundary
  // with its length; caller may decide how to proceed. Return 0 only if start is at EOF.
  return BacktickBoundary | runLength;
}


/**
 * scanInlineCode: attempt to find a closing run of exactly `openN` backticks
 * starting after `openEnd` (the index immediately after the opening run).
 * If a closer is found, return an InlineCode provisional token whose length is
 * the total consumed characters (from opening run start through closing run end).
 * If no closer is found, return 0 to indicate failure.
 *
 * This function follows a streaming, allocation-sparing approach: it only
 * advances integer indices and slices no strings until a close is confirmed.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @param {number} openN  length of opening run
 * @returns {number} InlineCode token (length | InlineCode) or 0 on failure
 */
export function scanInlineCode(input, start, end, openN) {

  // carry collected backtick run length to avoid scanning ahead
  let currentBacktickRunLength = 0;

  // if closing run not found, fallbackCodeLength is the length of code
  let fallbackCodeLength = -1;

  for (let pos = start; pos < end; pos++) {
    const ch = input.charCodeAt(pos);
    if (ch === 96 /* ` */) {
      if (fallbackCodeLength < 0) fallbackCodeLength = pos - start;

      currentBacktickRunLength++;
      if (currentBacktickRunLength === openN) {
        // Found closing run. total length from start to the start of the closing run
        const totalLen = pos + 1 - openN - start;
        return InlineCode | totalLen;
      }
    } else {
      currentBacktickRunLength = 0;

      if (ch === 10 /* \n */ || ch === 13 /* \r */) {
        if (fallbackCodeLength < 0) {
          fallbackCodeLength = pos;
        }
      }
    }
  }

  if (fallbackCodeLength < 0) fallbackCodeLength = 0;

  return InlineCode | ErrorUnbalancedTokenFallback | fallbackCodeLength;
}


/**
 * scanBacktickClose: produce a BacktickBoundary token representing the closing
 * run. This mirrors scanBacktickOpen and simply encodes the run length as a token.
 *
 * @param {number} runLength
 * @returns {number}
 */
export function scanBacktickClose(runLength) {
  return BacktickBoundary | runLength;
}
