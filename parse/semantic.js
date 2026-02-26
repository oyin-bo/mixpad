// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength, isPunctuation, isWhitespace } from './scan-core.js';
import { scan0 } from './scan0.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';
import {
  AsteriskDelimiter,
  EmphasisClose, EmphasisOpen,
  InlineText,
  StrikethroughClose, StrikethroughOpen,
  StrongClose, StrongOpen,
  TildeDelimiter,
  UnderscoreDelimiter
} from './scan-tokens.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

/**
 * Module-level growing buffer for provisional tokens — zero-allocation reuse.
 * @type {ProvisionalToken[]}
 */
const provisionalBuf = [];

/**
 * Module-level growing buffer for the opener stack.
 * Each stack entry occupies STACK_ENTRY_SIZE consecutive slots:
 *   [i*3+0]: outputIndex  — where the opener was written in the output array
 *   [i*3+1]: delimKind    — AsteriskDelimiter | UnderscoreDelimiter | TildeDelimiter
 *   [i*3+2]: delimLength  — run length in characters
 * @type {number[]}
 */
const openerStackBuf = [];

/** Number of numeric slots per entry in openerStackBuf. */
const STACK_ENTRY_SIZE = 3;

/**
 * Semantic scanner: processes provisional tokens from `scan0` into resolved semantic tokens.
 *
 * Responsibilities:
 *  - Text coalescing: adjacent InlineText tokens are merged.
 *  - Emphasis pairing: AsteriskDelimiter / UnderscoreDelimiter / TildeDelimiter are
 *    paired into EmphasisOpen/Close, StrongOpen/Close, StrikethroughOpen/Close.
 *  - Pass-through: all other provisional tokens are forwarded unchanged.
 *
 * Zero-allocation: uses module-level growing buffers; no string materialization.
 *
 * @param {{
 *  input: string,
 *  startOffset: number,
 *  endOffset: number
 * }} _
 * @returns {(output: ProvisionalToken[]) => void}
 */
export function semantic({ input, startOffset, endOffset }) {

  return scan;

  /** @param {ProvisionalToken[]} output */
  function scan(output) {
    // === Step 1: collect all provisional tokens ===
    provisionalBuf.length = 0;
    let pos = startOffset;
    while (pos < endOffset) {
      const prevLen = provisionalBuf.length;
      const count = scan0({ input, startOffset: pos, endOffset, output: provisionalBuf });
      if (count === 0) break;
      for (let i = prevLen; i < prevLen + count; i++) {
        pos += getTokenLength(provisionalBuf[i]);
      }
    }

    // === Step 2: resolve tokens into semantic output ===
    resolveTokens(provisionalBuf, output, input, startOffset);
  }
}

/**
 * Resolve a provisional token stream into semantic tokens.
 * Pairs emphasis delimiters and coalesces adjacent InlineText tokens.
 *
 * @param {ProvisionalToken[]} provisional
 * @param {ProvisionalToken[]} output
 * @param {string} input
 * @param {number} baseOffset
 */
function resolveTokens(provisional, output, input, baseOffset) {
  openerStackBuf.length = 0;
  let openerCount = 0;
  let inputPos = baseOffset;

  for (let i = 0; i < provisional.length; i++) {
    const token = provisional[i];
    const kind = getTokenKind(token);
    const len = getTokenLength(token);
    const flags = getTokenFlags(token);

    if (kind === AsteriskDelimiter || kind === UnderscoreDelimiter || kind === TildeDelimiter) {
      const beforeChar = inputPos > 0 ? input.charCodeAt(inputPos - 1) : 0;
      const afterChar = (inputPos + len) < input.length ? input.charCodeAt(inputPos + len) : 0;

      const left = canOpenDelim(kind, beforeChar, afterChar);
      const right = canCloseDelim(kind, beforeChar, afterChar);

      if (right) {
        const matchEntry = findOpener(openerStackBuf, openerCount, kind);
        if (matchEntry >= 0) {
          const openerOutputIdx = openerStackBuf[matchEntry];
          const openerLen = openerStackBuf[matchEntry + 2];
          const openerToken = output[openerOutputIdx];
          const openerFlags = getTokenFlags(openerToken);

          // Determine emphasis vs strong vs strikethrough
          const isTilde = kind === TildeDelimiter;
          const usedLen = isTilde ? 2 : (openerLen >= 2 && len >= 2 ? 2 : 1);
          let openKind, closeKind;
          if (isTilde) {
            openKind = StrikethroughOpen;
            closeKind = StrikethroughClose;
          } else if (usedLen === 2) {
            openKind = StrongOpen;
            closeKind = StrongClose;
          } else {
            openKind = EmphasisOpen;
            closeKind = EmphasisClose;
          }

          // Rewrite opener token in-place
          output[openerOutputIdx] = openKind | usedLen | openerFlags;

          // If opener had extra chars beyond usedLen, insert InlineText before the opener
          if (openerLen > usedLen) {
            const extra = openerLen - usedLen;
            // Shift tokens after opener one position to make room
            output.length++;
            for (let j = output.length - 1; j > openerOutputIdx; j--) {
              output[j] = output[j - 1];
            }
            output[openerOutputIdx] = InlineText | extra | openerFlags;
            // The new open token does not inherit IsSafeReparsePoint: that flag
            // belongs to the very first character of the original run, which is
            // now the leading InlineText, not the open marker.
            output[openerOutputIdx + 1] = openKind | usedLen | (openerFlags & ~IsSafeReparsePoint);
            // Adjust opener indices of later stack entries
            for (let j = matchEntry + STACK_ENTRY_SIZE; j < openerCount * STACK_ENTRY_SIZE; j += STACK_ENTRY_SIZE) {
              if (openerStackBuf[j] > openerOutputIdx) openerStackBuf[j]++;
            }
          }

          // Remove matched opener from stack (compact remaining entries)
          openerCount--;
          for (let j = matchEntry; j < openerCount * STACK_ENTRY_SIZE; j++) {
            openerStackBuf[j] = openerStackBuf[j + STACK_ENTRY_SIZE];
          }

          // Push closer (remainder of closer chars become InlineText)
          output.push(closeKind | usedLen | (flags & IsSafeReparsePoint));
          if (len > usedLen) {
            pushInlineText(output, len - usedLen, 0);
          }
          inputPos += len;
          continue;
        }
      }

      // No match as closer, or not right-flanking
      if (left) {
        // Push as potential opener, tentatively in output
        const outIdx = output.length;
        output.push(kind | len | (flags & IsSafeReparsePoint));
        const e = openerCount * STACK_ENTRY_SIZE;
        openerStackBuf[e] = outIdx;
        openerStackBuf[e + 1] = kind;
        openerStackBuf[e + 2] = len;
        openerCount++;
      } else {
        // Demote to inline text
        pushInlineText(output, len, flags);
      }
    } else if (kind === InlineText) {
      pushInlineText(output, len, flags);
    } else {
      output.push(token);
    }

    inputPos += len;
  }

  // Demote unmatched openers to InlineText
  for (let i = 0; i < openerCount; i++) {
    const e = i * STACK_ENTRY_SIZE;
    const outIdx = openerStackBuf[e];
    const opLen = openerStackBuf[e + 2];
    const opFlags = getTokenFlags(output[outIdx]);
    output[outIdx] = InlineText | opLen | opFlags;
  }

  // Final coalescing pass: merge any adjacent InlineText tokens
  let w = 0;
  for (let r = 0; r < output.length; r++) {
    if (w > 0 && getTokenKind(output[r]) === InlineText && getTokenKind(output[w - 1]) === InlineText) {
      output[w - 1] += getTokenLength(output[r]);
    } else {
      output[w++] = output[r];
    }
  }
  output.length = w;
}

/**
 * Push an InlineText token, coalescing with the previous token if it is also InlineText.
 *
 * @param {ProvisionalToken[]} output
 * @param {number} len
 * @param {number} flags
 */
function pushInlineText(output, len, flags) {
  if (output.length > 0 && getTokenKind(output[output.length - 1]) === InlineText) {
    output[output.length - 1] += len;
  } else {
    output.push(InlineText | len | (flags & IsSafeReparsePoint));
  }
}

/**
 * Find the most recent compatible opener for a closing delimiter.
 * Returns the base index in openerStackBuf (i*STACK_ENTRY_SIZE), or -1 if none found.
 *
 * @param {number[]} stack
 * @param {number} count
 * @param {number} kind
 * @returns {number}
 */
function findOpener(stack, count, kind) {
  for (let i = count - 1; i >= 0; i--) {
    if (stack[i * STACK_ENTRY_SIZE + 1] === kind) return i * STACK_ENTRY_SIZE;
  }
  return -1;
}

/**
 * Determine whether a delimiter run can open emphasis.
 * Implements CommonMark left-flanking rules, with extra underscore restriction.
 *
 * @param {number} kind
 * @param {number} before - char code before the run (0 = start/boundary)
 * @param {number} after  - char code after the run (0 = end/boundary)
 * @returns {boolean}
 */
function canOpenDelim(kind, before, after) {
  if (!isLeftFlanking(before, after)) return false;
  if (kind !== UnderscoreDelimiter) return true;
  // Underscore: must not be right-flanking, or preceded by punctuation
  return !isRightFlanking(before, after) || isPunctuation(before);
}

/**
 * Determine whether a delimiter run can close emphasis.
 * Implements CommonMark right-flanking rules, with extra underscore restriction.
 *
 * @param {number} kind
 * @param {number} before - char code before the run (0 = start/boundary)
 * @param {number} after  - char code after the run (0 = end/boundary)
 * @returns {boolean}
 */
function canCloseDelim(kind, before, after) {
  if (!isRightFlanking(before, after)) return false;
  if (kind !== UnderscoreDelimiter) return true;
  // Underscore: must not be left-flanking, or followed by punctuation
  return !isLeftFlanking(before, after) || isPunctuation(after);
}

/**
 * CommonMark left-flanking delimiter run rule.
 * Not followed by Unicode whitespace AND
 * (not followed by punctuation OR preceded by whitespace/punctuation).
 *
 * @param {number} before
 * @param {number} after
 * @returns {boolean}
 */
function isLeftFlanking(before, after) {
  if (isWhitespace(after) || after === 0) return false;
  if (!isPunctuation(after)) return true;
  return isWhitespace(before) || before === 0 || isPunctuation(before);
}

/**
 * CommonMark right-flanking delimiter run rule.
 * Not preceded by Unicode whitespace AND
 * (not preceded by punctuation OR followed by whitespace/punctuation).
 *
 * @param {number} before
 * @param {number} after
 * @returns {boolean}
 */
function isRightFlanking(before, after) {
  if (isWhitespace(before) || before === 0) return false;
  if (!isPunctuation(before)) return true;
  return isWhitespace(after) || after === 0 || isPunctuation(after);
}