// @ts-check

import { getTokenKind, getTokenLength, isPunctuation, isWhitespace } from './scan-core.js';
import { scan0 } from './scan0.js';
import {
  AsteriskDelimiter, EmphasisClose, EmphasisOpen,
  InlineText, StrikethroughClose, StrikethroughOpen, StrongClose, StrongOpen,
  TildeDelimiter, UnderscoreDelimiter
} from './scan-tokens.js';

/**
 * @typedef {number} SemanticToken
 */

/**
 * Returns true if a delimiter run is left-flanking (can act as opener).
 * @param {number} delimChar - character code of the delimiter
 * @param {number} beforeChar - character code immediately before the run (0 = start of input)
 * @param {number} afterChar - character code immediately after the run (0 = end of input)
 * @returns {boolean}
 */
function isLeftFlanking(delimChar, beforeChar, afterChar) {
  if (isWhitespace(afterChar)) return false;
  if (!isPunctuation(afterChar)) return true;
  return isWhitespace(beforeChar) || isPunctuation(beforeChar);
}

/**
 * Returns true if a delimiter run is right-flanking (can act as closer).
 * @param {number} delimChar - character code of the delimiter
 * @param {number} beforeChar - character code immediately before the run (0 = start of input)
 * @param {number} afterChar - character code immediately after the run (0 = end of input)
 * @returns {boolean}
 */
function isRightFlanking(delimChar, beforeChar, afterChar) {
  if (isWhitespace(beforeChar)) return false;
  if (!isPunctuation(beforeChar)) return true;
  return isWhitespace(afterChar) || isPunctuation(afterChar);
}

/**
 * Returns true if a delimiter run can open emphasis.
 * Applies the additional underscore restriction from CommonMark.
 * @param {number} delimChar
 * @param {number} beforeChar
 * @param {number} afterChar
 * @returns {boolean}
 */
function canDelimOpen(delimChar, beforeChar, afterChar) {
  if (!isLeftFlanking(delimChar, beforeChar, afterChar)) return false;
  if (delimChar === 95 /* _ */) {
    return !isRightFlanking(delimChar, beforeChar, afterChar) || isPunctuation(beforeChar);
  }
  return true;
}

/**
 * Returns true if a delimiter run can close emphasis.
 * Applies the additional underscore restriction from CommonMark.
 * @param {number} delimChar
 * @param {number} beforeChar
 * @param {number} afterChar
 * @returns {boolean}
 */
function canDelimClose(delimChar, beforeChar, afterChar) {
  if (!isRightFlanking(delimChar, beforeChar, afterChar)) return false;
  if (delimChar === 95 /* _ */) {
    return !isLeftFlanking(delimChar, beforeChar, afterChar) || isPunctuation(afterChar);
  }
  return true;
}

/**
 * Create a semantic scanner for the given input range.
 * Collects provisional tokens from `scan0`, resolves emphasis delimiter pairing
 * (asterisk, underscore, tilde) using a stack-based algorithm, coalesces adjacent
 * InlineText tokens, and passes all other token types through unchanged.
 * Operates with zero heap allocation per token: the delimiter stack and
 * intermediate buffer are flat numeric arrays.
 * @param {{
 *  input: string,
 *  startOffset: number,
 *  endOffset: number
 * }} _
 * @returns {(output: number[]) => void} scan function that appends semantic tokens to output
 */
export function semantic({ input, startOffset, endOffset }) {

  return scan;

  /** @param {SemanticToken[]} output */
  function scan(output) {
    // ── Step 1: collect all provisional tokens from scan0 ──────────────────────
    /** @type {number[]} */
    const provisional = [];
    let pos = startOffset;
    while (pos < endOffset) {
      const before = provisional.length;
      scan0({ input, startOffset: pos, endOffset, output: provisional });
      if (provisional.length === before) break;
      for (let i = before; i < provisional.length; i++) {
        pos += getTokenLength(provisional[i]);
      }
    }

    // ── Step 2: compute the input offset of each provisional token ──────────────
    /** @type {number[]} */
    const tokenOffsets = new Array(provisional.length);
    let cur = startOffset;
    for (let i = 0; i < provisional.length; i++) {
      tokenOffsets[i] = cur;
      cur += getTokenLength(provisional[i]);
    }

    // ── Step 3: resolve emphasis using a stack ──────────────────────────────────
    // Intermediate buffer for back-patching opener tokens.
    /** @type {number[]} */
    const buf = [];

    // Flat delimiter stack; each entry occupies 3 consecutive slots:
    //   [0] index of the placeholder token in buf
    //   [1] delimiter character code (42=*, 95=_, 126=~)
    //   [2] run length in characters
    /** @type {number[]} */
    const stack = [];
    let stackLen = 0;

    for (let i = 0; i < provisional.length; i++) {
      const tok = provisional[i];
      const kind = getTokenKind(tok);
      const len = getTokenLength(tok);
      const off = tokenOffsets[i];

      if (kind === AsteriskDelimiter || kind === UnderscoreDelimiter || kind === TildeDelimiter) {
        const delimChar =
          kind === AsteriskDelimiter ? 42 :
          kind === UnderscoreDelimiter ? 95 : 126;
        const beforeCh = off > 0 ? input.charCodeAt(off - 1) : 0;
        const afterCh = off + len < input.length ? input.charCodeAt(off + len) : 0;

        const openable = canDelimOpen(delimChar, beforeCh, afterCh);
        const closeable = canDelimClose(delimChar, beforeCh, afterCh);

        if (closeable) {
          // Search the stack backwards for a matching opener of the same character.
          let found = -1;
          for (let j = stackLen - 1; j >= 0; j--) {
            if (stack[j * 3 + 1] === delimChar) {
              found = j;
              break;
            }
          }

          if (found >= 0) {
            const opBufIdx = stack[found * 3];
            const opRunLen = stack[found * 3 + 2];
            // Pop the stack back to just before the matched entry.
            stackLen = found;

            // Determine how many characters form the matched pair.
            // Use 2 for strong when both sides have >= 2; otherwise 1 for emphasis.
            const matchLen = opRunLen >= 2 && len >= 2 ? 2 : 1;
            const isStrong = matchLen === 2;
            const isTilde = delimChar === 126;

            // Back-patch the opener placeholder in buf.
            if (isTilde) {
              buf[opBufIdx] = matchLen | StrikethroughOpen;
            } else {
              buf[opBufIdx] = matchLen | (isStrong ? StrongOpen : EmphasisOpen);
            }

            // Emit the closer.
            const closerKind = isTilde ? StrikethroughClose : (isStrong ? StrongClose : EmphasisClose);
            buf.push(matchLen | closerKind);
            continue;
          }
        }

        if (openable) {
          // Record the placeholder position and push onto the delimiter stack.
          stack[stackLen * 3] = buf.length;
          stack[stackLen * 3 + 1] = delimChar;
          stack[stackLen * 3 + 2] = len;
          stackLen++;
          buf.push(tok); // placeholder, to be back-patched if paired
        } else {
          // Not openable and no matching opener found: demote to InlineText.
          if (buf.length > 0 && getTokenKind(buf[buf.length - 1]) === InlineText) {
            buf[buf.length - 1] += len;
          } else {
            buf.push(len | InlineText);
          }
        }

      } else if (kind === InlineText) {
        // Coalesce adjacent InlineText tokens in buf.
        if (buf.length > 0 && getTokenKind(buf[buf.length - 1]) === InlineText) {
          buf[buf.length - 1] += len;
        } else {
          buf.push(tok);
        }
      } else {
        buf.push(tok);
      }
    }

    // ── Step 4: flush unmatched openers as InlineText ───────────────────────────
    for (let j = 0; j < stackLen; j++) {
      const idx = stack[j * 3];
      const origLen = stack[j * 3 + 2];
      buf[idx] = origLen | InlineText;
    }

    // ── Step 5: push buf to output, coalescing adjacent InlineText ───────────────
    for (let i = 0; i < buf.length; i++) {
      const tok = buf[i];
      if (getTokenKind(tok) === InlineText &&
          output.length > 0 &&
          getTokenKind(output[output.length - 1]) === InlineText) {
        output[output.length - 1] += getTokenLength(tok);
      } else {
        output.push(tok);
      }
    }
  }
}
