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
  UnderscoreDelimiter,
  NewLine, FencedOpen, ThematicBreak,
  LinkOpen, LinkClose, LinkDestOpen, LinkDestClose, ImageMarker,
  EntityNamed, EntityDecimal, EntityHex, Whitespace
} from './scan-tokens.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

/**
 * Module-level growing buffers � zero-allocation reuse.
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

// Link and Image matching
/** @type {number[]} */
const linkOpenerStack = [];
/** @type {number[]} */
const linkMatchesObjStr = []; // Stores 4 integers per match: start(open), end(close), destOpen, destClose
/** @type {boolean[]} */
const isMatchedLinkToken = [];

// Buffer for provisional tokens
/** @type {ProvisionalToken[]} */
const provisionalBuf = [];

/**
 * Semantic scanner: processes provisional tokens from scan0 into resolved semantic tokens.
 *
 * Zero-allocation: uses module-level growing buffers; no string materialization.
 * Implements CommonMark emphasis matching and chunk-level invalidation.
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
    let pos = startOffset;
    
    while (pos < endOffset) {
      provisionalBuf.length = 0;
      let chunkEndFound = false;
      const chunkStartOffset = pos;

      // Phase 0: Collect a single chunk (paragraph, fence, etc)
      while (pos < endOffset) {
        const prevLen = provisionalBuf.length;
        const count = scan0({ input, startOffset: pos, endOffset, output: provisionalBuf });
        
        if (count === 0) {
          pos++;
          continue;
        }

        let addedLen = 0;
        for (let i = prevLen; i < provisionalBuf.length; i++) {
          const tok = provisionalBuf[i];
          const kind = getTokenKind(tok);
          addedLen += getTokenLength(tok);

          if (kind === NewLine && i > 0 && getTokenKind(provisionalBuf[i-1]) === NewLine) {
             chunkEndFound = true;
          } else if (kind === FencedOpen || kind === ThematicBreak) {
             chunkEndFound = true;
          }
        }
        
        pos += addedLen;
        if (addedLen === 0) pos++; // failsafe

        if (chunkEndFound) {
          break;
        }
      }

      if (provisionalBuf.length > 0) {
        processChunk(output, chunkStartOffset);
      }
    }
  }

  /**
   * @param {number[]} output
   * @param {number} chunkStartOffset
   */
  function processChunk(output, chunkStartOffset) {
    // Phase 1: Identify delimiters and compute flanking for emphasis
    delimsData.length = 0;
    delimsProvIdx.length = 0;
    delimsRemaining.length = 0;

    let inputPos = chunkStartOffset;
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

    // Phase 2: Stack-based matching for emphasis (mod-3 rule)
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

    // Phase 2.5: Link and Image pairing
    linkOpenerStack.length = 0;
    linkMatchesObjStr.length = 0;
    isMatchedLinkToken.length = provisionalBuf.length;
    isMatchedLinkToken.fill(false);

    for (let i = 0; i < provisionalBuf.length; i++) {
      const kind = getTokenKind(provisionalBuf[i]);
      if (kind === LinkOpen) {
        linkOpenerStack.push(i);
      } else if (kind === LinkClose) {
        if (linkOpenerStack.length > 0) {
          const openIdx = linkOpenerStack.pop();
          
          let hasDest = false;
          let destOpenIdx = -1;
          let destCloseIdx = -1;
          
          if (i + 1 < provisionalBuf.length && getTokenKind(provisionalBuf[i+1]) === LinkDestOpen) {
            destOpenIdx = i + 1;
            for(let j = destOpenIdx + 1; j < provisionalBuf.length; j++) {
              if (getTokenKind(provisionalBuf[j]) === LinkDestClose) {
                destCloseIdx = j;
                hasDest = true;
                break;
              } else if (getTokenKind(provisionalBuf[j]) === NewLine) {
                break;
              }
            }
          }

          if (hasDest) {
            linkMatchesObjStr.push(openIdx, i, destOpenIdx, destCloseIdx);
          }
        }
      }
    }

    // Process link matches. Outermost first.
    /** @type {boolean[]} */
    const isContained = new Array(linkMatchesObjStr.length / 4).fill(false);
    for (let m1 = 0; m1 < linkMatchesObjStr.length; m1 += 4) {
      const start1 = linkMatchesObjStr[m1];
      const end1 = linkMatchesObjStr[m1 + 3];
      for (let m2 = 0; m2 < linkMatchesObjStr.length; m2 += 4) {
        if (m1 !== m2) {
          const start2 = linkMatchesObjStr[m2];
          const end2 = linkMatchesObjStr[m2 + 3];
          if (start1 <= start2 && end1 >= end2) {
            isContained[m2 / 4] = true;
          }
        }
      }
    }

    // Mark valid tokens
    for (let m = 0; m < linkMatchesObjStr.length; m += 4) {
      if (!isContained[m / 4]) {
        const startIdx = linkMatchesObjStr[m];
        const closeIdx = linkMatchesObjStr[m+1];
        const destOpenIdx = linkMatchesObjStr[m+2];
        const destCloseIdx = linkMatchesObjStr[m+3];
        isMatchedLinkToken[startIdx] = true;
        isMatchedLinkToken[closeIdx] = true;
        isMatchedLinkToken[destOpenIdx] = true;
        isMatchedLinkToken[destCloseIdx] = true;
        if (startIdx > 0 && getTokenKind(provisionalBuf[startIdx - 1]) === ImageMarker) {
          isMatchedLinkToken[startIdx - 1] = true;
        }
      }
    }

    // Phase 3: Emission and Coalescing
    let nextDiIdx = 0;
    for (let i = 0; i < provisionalBuf.length; i++) {
      const tok = provisionalBuf[i];
      const kind = getTokenKind(tok);
      const len = getTokenLength(tok);
      const flags = getTokenFlags(tok);

      if (nextDiIdx < delimsProvIdx.length && delimsProvIdx[nextDiIdx] === i) {
        const di = nextDiIdx++;
        emitDelimiterTokens(di, output);
      } else {
        const isDemotedLinkToken = (
          (kind === LinkOpen || kind === LinkClose || kind === LinkDestOpen || kind === LinkDestClose || kind === ImageMarker) 
          && !isMatchedLinkToken[i]
        );

        if (kind === InlineText || isDemotedLinkToken) {
          // Retroactive merging of single whitespace, matching scan0 logic in scan-inline-text.js
          if (output.length > 1 && kind === InlineText && len === 1) {
            const last = output[output.length - 1];
            const lastKind = getTokenKind(last);
            const lastLen = getTokenLength(last);
            const prev = output[output.length - 2];
            const prevKind = getTokenKind(prev);
            
            if (lastKind === Whitespace && prevKind === InlineText && lastLen === 1) {
              output[output.length - 2] += 2; // Increment length of InlineText
              output.pop(); // Remove Whitespace
              // Existing pushInlineText will then append to this merged InlineText
            }
          }
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

  // 1. Close events
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

  // 3. Open events
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
