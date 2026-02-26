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
 * Module-level growing buffers ÔÇö zero-allocation reuse.
 * Set of Arrays (SoA) for delimiters and match events.
 */

// Delimiter catalog
/** @type {number[]} */
const delimsData = [];         // kind | flags | canOpen | canClose
/** @type {number[]} */
const delimsProvIdx = [];      // Index in provisionalBuf
/** @type {number[]} */
const delimsRemaining = [];    // number of chars left to match

const DelimCanOpen = 0x01;
const DelimCanClose = 0x02;
const DelimKindMask = 0x03FF0000;

// Match event records
/** @type {number[]} */
const matchOpenerDi = [];      // index in delims* arrays
/** @type {number[]} */
const matchCloserDi = [];      // index in delims* arrays
/** @type {number[]} */
const matchUsedLen = [];       // 1 or 2

// Opener stack for matching
/** @type {number[]} */
const openerStackDi = [];      // index in delims* arrays

// Buffer for provisional tokens
/** @type {ProvisionalToken[]} */
const provisionalBuf = [];

/**
 * Semantic scanner: processes provisional tokens from `scan0` into resolved semantic tokens.
 *
 * Zero-allocation: uses module-level growing buffers; no string materialization.
 * Implements CommonMark emphasis matching with SoA architecture.
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
    // Phase 0: Collect all provisional tokens
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

    // Phase 1: Identify delimiters and compute flanking
    delimsData.length = 0;
    delimsProvIdx.length = 0;
    delimsRemaining.length = 0;

    let inputPos = startOffset;
    for (let i = 0; i < provisionalBuf.length; i++) {
      const tok = provisionalBuf[i];
      const kind = getTokenKind(tok);
      const len = getTokenLength(tok);
      const originalFlags = getTokenFlags(tok);

      if (kind === AsteriskDelimiter || kind === UnderscoreDelimiter || kind === TildeDelimiter) {
        const beforeChar = inputPos > 0 ? input.charCodeAt(inputPos - 1) : 0;
        const afterChar = (inputPos + len) < input.length ? input.charCodeAt(inputPos + len) : 0;

        let canOpen = isLeftFlanking(beforeChar, afterChar);
        let canClose = isRightFlanking(beforeChar, afterChar);

        if (kind === UnderscoreDelimiter) {
          if (canOpen && canClose) {
            canOpen = isPunctuation(beforeChar) || beforeChar === 0;
            canClose = isPunctuation(afterChar) || afterChar === 0;
          }
        }

        const di = delimsData.length;
        delimsProvIdx[di] = i;
        delimsRemaining[di] = len;
        delimsData[di] = kind | originalFlags |
          (canOpen ? DelimCanOpen : 0) |
          (canClose ? DelimCanClose : 0);
      }
      inputPos += len;
    }

    // Phase 2: Stack-based matching (mod-3 rule)
    matchOpenerDi.length = 0;
    matchCloserDi.length = 0;
    matchUsedLen.length = 0;
    openerStackDi.length = 0;

    for (let di = 0; di < delimsData.length; di++) {
      const data = delimsData[di];
      if (data & DelimCanClose) {
        const kind = data & DelimKindMask;
        let si = openerStackDi.length - 1;
        while (si >= 0 && delimsRemaining[di] > 0) {
          const odi = openerStackDi[si];
          const odata = delimsData[odi];
          if ((odata & DelimKindMask) === kind && (odata & DelimCanOpen)) {
            // CommonMark mod-3 rule
            const opLen = getTokenLength(provisionalBuf[delimsProvIdx[odi]]);
            const clLen = getTokenLength(provisionalBuf[delimsProvIdx[di]]);
            if ((opLen + clLen) % 3 === 0 && opLen % 3 !== 0 && clLen % 3 !== 0) {
              si--;
              continue;
            }

            const useLen = (delimsRemaining[odi] >= 2 && delimsRemaining[di] >= 2) ? 2 : 1;
            
            const mi = matchOpenerDi.length;
            matchOpenerDi[mi] = odi;
            matchCloserDi[mi] = di;
            matchUsedLen[mi] = useLen;
            
            delimsRemaining[odi] -= useLen;
            delimsRemaining[di] -= useLen;

            if (delimsRemaining[odi] === 0) {
              openerStackDi.splice(si, 1);
            }
            // If we found a match, we might have more chars to match for this closer,
            // but the stack has changed. CM says to keep looking with the same closer.
            si = openerStackDi.length - 1;
          } else {
            si--;
          }
        }
      }
      if ((delimsData[di] & DelimCanOpen) && delimsRemaining[di] > 0) {
        openerStackDi.push(di);
      }
    }

    // Phase 3: Emission
    let nextDiIdx = 0;
    for (let i = 0; i < provisionalBuf.length; i++) {
      const tok = provisionalBuf[i];
      if (nextDiIdx < delimsProvIdx.length && delimsProvIdx[nextDiIdx] === i) {
        const di = nextDiIdx++;
        emitDelimiterTokens(di, output);
      } else {
        const kind = getTokenKind(tok);
        const len = getTokenLength(tok);
        const flags = getTokenFlags(tok);
        if (kind === InlineText) {
          pushInlineText(output, len, flags);
        } else {
          output.push(tok);
        }
      }
    }
  }
}

/** @type {number[]} */
const openerIndicesBuf = [];

/**
 * @param {number} di
 * @param {number[]} output
 */
function emitDelimiterTokens(di, output) {
  const data = delimsData[di];
  const kind = data & DelimKindMask;
  let currentFlags = data;

  // 1. Close events (inner-first, chronological)
  for (let mi = 0; mi < matchOpenerDi.length; mi++) {
    if (matchCloserDi[mi] === di) {
      const ul = matchUsedLen[mi];
      const closeKind = (kind === TildeDelimiter) ? StrikethroughClose : (ul === 2 ? StrongClose : EmphasisClose);
      output.push(closeKind | ul | (currentFlags & IsSafeReparsePoint));
      currentFlags &= ~IsSafeReparsePoint;
    }
  }

  // 2. Middle text
  if (delimsRemaining[di] > 0) {
    pushInlineText(output, delimsRemaining[di], currentFlags);
    currentFlags &= ~IsSafeReparsePoint;
  }

  // 3. Open events (outer-first, reverse chronological)
  openerIndicesBuf.length = 0;
  for (let mi = 0; mi < matchOpenerDi.length; mi++) {
    if (matchOpenerDi[mi] === di) openerIndicesBuf.push(mi);
  }
  for (let i = openerIndicesBuf.length - 1; i >= 0; i--) {
    const mi = openerIndicesBuf[i];
    const ul = matchUsedLen[mi];
    const openKind = (kind === TildeDelimiter) ? StrikethroughOpen : (ul === 2 ? StrongOpen : EmphasisOpen);
    output.push(openKind | ul | (currentFlags & IsSafeReparsePoint));
    currentFlags &= ~IsSafeReparsePoint;
  }
}

/**
 * @param {number[]} output
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
 * @param {number} before
 * @param {number} after
 */
function isLeftFlanking(before, after) {
  if (isWhitespace(after) || after === 0) return false;
  if (!isPunctuation(after)) return true;
  return isWhitespace(before) || before === 0 || isPunctuation(before);
}

/**
 * @param {number} before
 * @param {number} after
 */
function isRightFlanking(before, after) {
  if (isWhitespace(before) || before === 0) return false;
  if (!isPunctuation(before)) return true;
  return isWhitespace(after) || after === 0 || isPunctuation(after);
}
