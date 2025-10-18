// @ts-check

import { ErrorUnbalancedToken } from './scan-token-flags.js';
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
function scanBacktickOpen(input, start, end) {
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
function scanInlineCode(input, start, end, openN) {

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

  return InlineCode | ErrorUnbalancedToken | fallbackCodeLength;
}


/**
 * scanBacktickInline: integrated orchestration that encapsulates the
 * sequence of calls (scanBacktickOpen -> scanInlineCode -> scanBacktickClose)
 * and emits the appropriate provisional tokens into `output`.
 *
 * This mirrors the logic previously embedded in `scan0` but centralized
 * here so `scan0` only needs to delegate when it sees a backtick.
 *
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset  index where input[startOffset] === '`'
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
export function scanBacktickInline(input, startOffset, endOffset, output) {
  // call scanBacktickOpen at the startOffset
  const openBacktickTok = scanBacktickOpen(input, startOffset, endOffset);
  if (!openBacktickTok) {
    // nothing recognized; let caller fall back to inline text
    return 0;
  }

  const { /* using helpers from scan-core via callers */ } = {};

  const openLen = openBacktickTok & 0xFFFF; // lower 16 bits encode length

  // attempt to parse inline code following the opening run. The scanInlineCode
  // in this module expects the `start` parameter to be the index immediately
  // after the opening run. In the previous `scan0` call site this was
  // `offset + openLen - 1` because `offset` held the post-incremented index.
  const inlineTok = scanInlineCode(input, startOffset + openLen, endOffset, openLen);

  // If inlineTok carries ErrorUnbalancedToken, we must perform the
  // fallback/unbalanced handling: check whether there exists a closing run
  // after the inlineTok's fallback length.
  if (inlineTok && (inlineTok & 0xF0000) & ErrorUnbalancedToken) {
    // compute position where a closing backtick run might be found. The
    // original calculation used: offset - 1 + getTokenLength(openBacktickTok) + getTokenLength(inlineTok)
    // Here offset corresponds to startOffset + 1 in the original flow; simplifying:
    const openTokLen = openLen;
    const inlineLen = inlineTok & 0xFFFF;

    const closingTryStart = startOffset + openTokLen + inlineLen;

    const closingBacktickTok = scanBacktickOpen(input, closingTryStart, endOffset);

    if (closingBacktickTok) {
      // found a closing run but it's unbalanced: emit open(with flag), inline, closing(with flag)
      output.push(openBacktickTok | ErrorUnbalancedToken);
      output.push(inlineTok);
      output.push(closingBacktickTok | ErrorUnbalancedToken);
      const closingLen = closingBacktickTok & 0xFFFF;
      return openLen + inlineLen + closingLen;
    } else {
      // emit open(with flag) and inline
      output.push(openBacktickTok | ErrorUnbalancedToken);
      output.push(inlineTok);
      return openLen + inlineLen;
    }
  }

  // balanced case: emit open, inline, and closing BacktickBoundary with same length
  output.push(openBacktickTok);
  output.push(inlineTok);
  output.push(BacktickBoundary | openLen);
  const inlineLen = inlineTok & 0xFFFF;
  return openLen + inlineLen + openLen;
}
