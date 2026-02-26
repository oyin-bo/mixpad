// @ts-check

import { getTokenKind, getTokenLength, isPunctuation, isWhitespace } from './scan-core.js';
import { scan0 } from './scan0.js';
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

// ── Module-level growing buffers for zero-allocation emphasis resolution ────
// These typed arrays grow on demand but are reused across calls to semantic().

/** @type {ProvisionalToken[]} Provisional tokens collected from scan0 */
const _provBuf = [];

/** @type {Int32Array} Provisional token index in _provBuf for each collected delimiter */
let _delimProvIdx = new Int32Array(64);
/** @type {Uint8Array} 1 if delimiter can open emphasis */
let _delimCanOpen = new Uint8Array(64);
/** @type {Uint8Array} 1 if delimiter can close emphasis */
let _delimCanClose = new Uint8Array(64);
/** @type {Int32Array} Remaining unmatched chars for each delimiter */
let _delimRemaining = new Int32Array(64);
let _delimCount = 0;

/** @type {Int32Array} Opener stack: delimiter indices into _delimXxx arrays */
let _openerStack = new Int32Array(32);
let _openerTop = 0;

/** @type {Int32Array} Match events: opener delimiter index */
let _matchOpener = new Int32Array(32);
/** @type {Int32Array} Match events: closer delimiter index */
let _matchCloser = new Int32Array(32);
/** @type {Int32Array} Match events: chars used (1=emphasis, 2=strong/strikethrough) */
let _matchUseLen = new Int32Array(32);
let _matchCount = 0;

/** @param {number} needed */
function _growDelim(needed) {
  const size = Math.max(needed, _delimProvIdx.length * 2);
  const pi = new Int32Array(size); pi.set(_delimProvIdx); _delimProvIdx = pi;
  const co = new Uint8Array(size); co.set(_delimCanOpen); _delimCanOpen = co;
  const cc = new Uint8Array(size); cc.set(_delimCanClose); _delimCanClose = cc;
  const re = new Int32Array(size); re.set(_delimRemaining); _delimRemaining = re;
}

/** @param {number} needed */
function _growStack(needed) {
  const size = Math.max(needed, _openerStack.length * 2);
  const s = new Int32Array(size); s.set(_openerStack); _openerStack = s;
}

/** @param {number} needed */
function _growMatch(needed) {
  const size = Math.max(needed, _matchOpener.length * 2);
  const mo = new Int32Array(size); mo.set(_matchOpener); _matchOpener = mo;
  const mc = new Int32Array(size); mc.set(_matchCloser); _matchCloser = mc;
  const mu = new Int32Array(size); mu.set(_matchUseLen); _matchUseLen = mu;
}

/**
 * Compute left/right-flanking bitmask for a delimiter run.
 * Returns bit 0 = left-flanking (can open), bit 1 = right-flanking (can close).
 * Boundaries (char code 0) are treated as whitespace by isWhitespace().
 *
 * @param {number} beforeChar character code immediately before the run
 * @param {number} afterChar  character code immediately after the run
 * @returns {number}
 */
function _flanking(beforeChar, afterChar) {
  const bWS = isWhitespace(beforeChar);
  const aWS = isWhitespace(afterChar);
  const bPunct = isPunctuation(beforeChar);
  const aPunct = isPunctuation(afterChar);
  const left = !aWS && (!aPunct || bWS || bPunct);
  const right = !bWS && (!bPunct || aWS || aPunct);
  return (left ? 1 : 0) | (right ? 2 : 0);
}

/**
 * Emit an InlineText token, coalescing with the preceding token if it is also InlineText.
 *
 * @param {ProvisionalToken[]} output
 * @param {number} len
 */
function _emitText(output, len) {
  if (len <= 0) return;
  if (output.length > 0 && getTokenKind(output[output.length - 1]) === InlineText) {
    output[output.length - 1] += len;
  } else {
    output.push(InlineText | len);
  }
}

/**
 * Semantic scanner: processes provisional tokens from `scan0` into resolved semantic tokens.
 *
 * Responsibilities:
 *  - Text coalescing: adjacent InlineText tokens are merged.
 *  - Emphasis pairing: AsteriskDelimiter / UnderscoreDelimiter / TildeDelimiter are
 *    paired into EmphasisOpen/Close, StrongOpen/Close, StrikethroughOpen/Close.
 *  - Pass-through: all other provisional tokens are forwarded unchanged.
 *
 * Algorithm: three-phase — (1) collect delimiter tokens and compute flanking properties,
 * (2) stack-based matching with CommonMark mod-3 rule and multi-match per delimiter run,
 * (3) emit the resolved token stream with inner-first close / outer-first open ordering.
 *
 * Zero-allocation: uses module-level typed arrays that grow on demand; reused each call.
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
    // Step 1: collect all provisional tokens from scan0
    _provBuf.length = 0;
    let pos = startOffset;
    while (pos < endOffset) {
      const prevLen = _provBuf.length;
      const count = scan0({ input, startOffset: pos, endOffset, output: _provBuf });
      if (count === 0) break;
      for (let i = prevLen; i < prevLen + count; i++) {
        pos += getTokenLength(_provBuf[i]);
      }
    }

    // Step 2: resolve using three-phase algorithm
    _resolveTokens(_provBuf, input, startOffset, output);
  }
}

/**
 * Resolve a provisional token stream into semantic tokens using a three-phase algorithm.
 *
 * @param {ProvisionalToken[]} provisional
 * @param {string} input
 * @param {number} startOffset
 * @param {ProvisionalToken[]} output
 */
function _resolveTokens(provisional, input, startOffset, output) {
  const n = provisional.length;
  if (!n) return;

  // ── Phase 1: collect delimiter tokens and compute flanking properties ──────
  _delimCount = 0;
  let pos = startOffset;

  for (let i = 0; i < n; i++) {
    const tok = provisional[i];
    const kind = getTokenKind(tok);
    const len = getTokenLength(tok);

    if (kind === AsteriskDelimiter || kind === UnderscoreDelimiter || kind === TildeDelimiter) {
      const beforeChar = pos > 0 ? input.charCodeAt(pos - 1) : 0;
      const afterChar = pos + len < input.length ? input.charCodeAt(pos + len) : 0;
      const fl = _flanking(beforeChar, afterChar);
      const leftFl = (fl & 1) !== 0;
      const rightFl = (fl & 2) !== 0;

      let canOpen = leftFl;
      let canClose = rightFl;

      // CommonMark underscore restriction (Rules 14 & 15):
      // _ can open only if left-flanking and (not right-flanking or preceded by Unicode punctuation).
      // _ can close only if right-flanking and (not left-flanking or followed by Unicode punctuation).
      if (kind === UnderscoreDelimiter) {
        canOpen = leftFl && (!rightFl || isPunctuation(beforeChar));
        canClose = rightFl && (!leftFl || isPunctuation(afterChar));
      }

      if (_delimCount >= _delimProvIdx.length) _growDelim(_delimCount + 1);
      _delimProvIdx[_delimCount] = i;
      _delimCanOpen[_delimCount] = canOpen ? 1 : 0;
      _delimCanClose[_delimCount] = canClose ? 1 : 0;
      _delimRemaining[_delimCount] = len;
      _delimCount++;
    }

    pos += len;
  }

  // ── Phase 2: stack-based matching ─────────────────────────────────────────
  _openerTop = 0;
  _matchCount = 0;

  for (let di = 0; di < _delimCount; di++) {
    const provIdx = _delimProvIdx[di];
    const kind = getTokenKind(provisional[provIdx]);

    if (_delimCanClose[di]) {
      let remaining = getTokenLength(provisional[provIdx]);

      // Search opener stack from top; after each match restart from new top
      // to allow one delimiter run to pair with multiple openers.
      let si = _openerTop - 1;
      while (si >= 0 && remaining > 0) {
        const opDi = _openerStack[si];
        const opProvIdx = _delimProvIdx[opDi];

        // Must match same delimiter character
        if (getTokenKind(provisional[opProvIdx]) !== kind || !_delimCanOpen[opDi]) {
          si--;
          continue;
        }

        // CommonMark mod-3 rule (Rule 9):
        // If either delimiter can both open AND close emphasis, the sum of the original
        // run lengths must not be a multiple of 3 unless both lengths are multiples of 3.
        const opLen = getTokenLength(provisional[opProvIdx]);
        const clLen = getTokenLength(provisional[provIdx]);
        const opCanBoth = _delimCanOpen[opDi] !== 0 && _delimCanClose[opDi] !== 0;
        const clCanBoth = _delimCanOpen[di] !== 0 && _delimCanClose[di] !== 0;
        if ((opCanBoth || clCanBoth) &&
            (opLen + clLen) % 3 === 0 &&
            opLen % 3 !== 0 && clLen % 3 !== 0) {
          si--;
          continue;
        }

        // Consume 2 chars (strong/strikethrough) when both sides have ≥2, otherwise 1 (emphasis)
        const useLen = (_delimRemaining[opDi] >= 2 && remaining >= 2) ? 2 : 1;
        _delimRemaining[opDi] -= useLen;
        remaining -= useLen;

        if (_matchCount >= _matchOpener.length) _growMatch(_matchCount + 1);
        _matchOpener[_matchCount] = opDi;
        _matchCloser[_matchCount] = di;
        _matchUseLen[_matchCount] = useLen;
        _matchCount++;

        if (_delimRemaining[opDi] === 0) {
          // Remove exhausted opener from stack
          for (let k = si; k < _openerTop - 1; k++) _openerStack[k] = _openerStack[k + 1];
          _openerTop--;
        }

        // Restart from new stack top to allow further matches
        si = _openerTop - 1;
      }

      _delimRemaining[di] = remaining;
    }

    // Push as potential opener if it can open and still has chars remaining
    if (_delimCanOpen[di] && _delimRemaining[di] > 0) {
      if (_openerTop >= _openerStack.length) _growStack(_openerTop + 1);
      _openerStack[_openerTop++] = di;
    }
  }

  // ── Phase 3: emit resolved token stream ───────────────────────────────────
  // Walk provisional tokens in order. Delimiter tokens are emitted as a
  // combination of open/close tokens and InlineText (for unmatched chars).
  // Closers are emitted inner-first (forward match-event order).
  // Openers are emitted outer-first (reverse match-event order).
  // All other tokens pass through; adjacent InlineText tokens are coalesced.

  let delimIdx = 0;
  let curDelimProvIdx = _delimCount > 0 ? _delimProvIdx[0] : n;

  for (let i = 0; i < n; i++) {
    const tok = provisional[i];
    const kind = getTokenKind(tok);
    const len = getTokenLength(tok);

    if (i === curDelimProvIdx) {
      const di = delimIdx;
      delimIdx++;
      curDelimProvIdx = delimIdx < _delimCount ? _delimProvIdx[delimIdx] : n;

      // Tally chars used as opener and as closer in recorded match events
      let openUsed = 0;
      let closeUsed = 0;
      for (let mi = 0; mi < _matchCount; mi++) {
        if (_matchOpener[mi] === di) openUsed += _matchUseLen[mi];
        if (_matchCloser[mi] === di) closeUsed += _matchUseLen[mi];
      }
      const unmatchedLen = len - openUsed - closeUsed;

      if (openUsed === 0 && closeUsed === 0) {
        // Entirely unmatched — demote to InlineText
        _emitText(output, len);
        continue;
      }

      // Close events: inner-first (forward match-event order)
      for (let mi = 0; mi < _matchCount; mi++) {
        if (_matchCloser[mi] !== di) continue;
        const ul = _matchUseLen[mi];
        output.push(kind === TildeDelimiter
          ? StrikethroughClose | ul
          : (ul >= 2 ? StrongClose : EmphasisClose) | ul);
      }

      // Unmatched chars in the middle (between close and open roles)
      if (unmatchedLen > 0) _emitText(output, unmatchedLen);

      // Open events: outer-first (reverse match-event order)
      for (let mi = _matchCount - 1; mi >= 0; mi--) {
        if (_matchOpener[mi] !== di) continue;
        const ul = _matchUseLen[mi];
        output.push(kind === TildeDelimiter
          ? StrikethroughOpen | ul
          : (ul >= 2 ? StrongOpen : EmphasisOpen) | ul);
      }

      continue;
    }

    if (kind === InlineText) {
      _emitText(output, len);
      continue;
    }

    // All other token kinds pass through unchanged
    output.push(tok);
  }
}