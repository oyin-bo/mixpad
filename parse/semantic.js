// @ts-check

import { getTokenKind, getTokenLength, isPunctuation, isWhitespace } from './scan-core.js';
import {
  AsteriskDelimiter, EmphasisClose, EmphasisOpen,
  InlineText, StrikethroughClose, StrikethroughOpen,
  StrongClose, StrongOpen, TildeDelimiter, UnderscoreDelimiter
} from './scan-tokens.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

// ── Module-level growing buffers for zero-allocation emphasis resolution ────
// These typed arrays grow on demand but are reused across calls to semantic().

/** @type {Int32Array} Provisional token index for each collected delimiter */
let _delimProvIdx = new Int32Array(64);
/** @type {Uint8Array} 1 if delimiter can open emphasis */
let _delimCanOpen = new Uint8Array(64);
/** @type {Uint8Array} 1 if delimiter can close emphasis */
let _delimCanClose = new Uint8Array(64);
/** @type {Int32Array} Remaining unmatched chars after stack processing */
let _delimRemaining = new Int32Array(64);
let _delimCount = 0;

/** @type {Int32Array} Opener stack: delimiter indices */
let _openerStack = new Int32Array(32);
let _openerTop = 0;

/** @type {Int32Array} Match events: opener delimiter index */
let _matchOpener = new Int32Array(32);
/** @type {Int32Array} Match events: closer delimiter index */
let _matchCloser = new Int32Array(32);
/** @type {Int32Array} Match events: chars used (1=emphasis, 2=strong/strikethrough) */
let _matchUseLen = new Int32Array(32);
let _matchCount = 0;

/**
 * @param {number} needed
 */
function _growDelim(needed) {
  const size = Math.max(needed, _delimProvIdx.length * 2);
  const pi = new Int32Array(size); pi.set(_delimProvIdx); _delimProvIdx = pi;
  const co = new Uint8Array(size); co.set(_delimCanOpen); _delimCanOpen = co;
  const cc = new Uint8Array(size); cc.set(_delimCanClose); _delimCanClose = cc;
  const re = new Int32Array(size); re.set(_delimRemaining); _delimRemaining = re;
}

/**
 * @param {number} needed
 */
function _growStack(needed) {
  const size = Math.max(needed, _openerStack.length * 2);
  const s = new Int32Array(size); s.set(_openerStack); _openerStack = s;
}

/**
 * @param {number} needed
 */
function _growMatch(needed) {
  const size = Math.max(needed, _matchOpener.length * 2);
  const mo = new Int32Array(size); mo.set(_matchOpener); _matchOpener = mo;
  const mc = new Int32Array(size); mc.set(_matchCloser); _matchCloser = mc;
  const mu = new Int32Array(size); mu.set(_matchUseLen); _matchUseLen = mu;
}

/**
 * Compute left- and right-flanking properties for a delimiter run.
 * Returns a bitmask: bit 0 = left-flanking (can open), bit 1 = right-flanking (can close).
 * @param {number} beforeChar character code immediately before the run (0 = start of input)
 * @param {number} afterChar character code immediately after the run (0 = end of input)
 * @returns {number}
 */
function _flanking(beforeChar, afterChar) {
  const bWS = isWhitespace(beforeChar);
  const aWS = isWhitespace(afterChar);
  const bPunct = isPunctuation(beforeChar);
  const aPunct = isPunctuation(afterChar);
  const left = !aWS && (!aPunct || (aPunct && (bWS || bPunct)));
  const right = !bWS && (!bPunct || (bPunct && (aWS || aPunct)));
  return (left ? 1 : 0) | (right ? 2 : 0);
}

/**
 * Emit an InlineText token into `output`, coalescing with the previous token
 * if it is also InlineText.
 * @param {number[]} output
 * @param {number} len
 */
function _emitText(output, len) {
  if (len <= 0) return;
  if (output.length > 0 && getTokenKind(output[output.length - 1]) === InlineText) {
    output[output.length - 1] = InlineText | ((output[output.length - 1] & 0xFFFF) + len);
  } else {
    output.push(InlineText | len);
  }
}

/**
 * Process provisional tokens from scan0 into resolved semantic tokens.
 *
 * Responsibilities:
 *  - **Text coalescing**: adjacent `InlineText` tokens (including demoted delimiters)
 *    are merged into a single token.
 *  - **Emphasis resolution**: `*`, `_`, and `~~` delimiter runs are paired into
 *    `EmphasisOpen`/`EmphasisClose`, `StrongOpen`/`StrongClose`, and
 *    `StrikethroughOpen`/`StrikethroughClose` using a stack-based algorithm
 *    that honours the CommonMark flanking and mod-3 rules.
 *  - **Pass-through**: all other token kinds are forwarded unchanged.
 *
 * Zero-allocation design: no heap objects are created per call; working state
 * lives in module-level typed arrays that grow on demand.
 *
 * @param {string} input - original input text
 * @param {ProvisionalToken[]} provisional - tokens emitted by scan0
 * @param {number} startOffset - character offset in `input` where the first token begins
 * @param {number[]} output - output array; new tokens are appended
 * @returns {number} count of tokens pushed into `output`
 */
export function semantic(input, provisional, startOffset, output) {
  const n = provisional.length;
  if (!n) return 0;
  const outStart = output.length;

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
      let canOpen = (fl & 1) !== 0;
      let canClose = (fl & 2) !== 0;

      // Underscore: when both flanking, apply stricter intraword rules
      if (kind === UnderscoreDelimiter && canOpen && canClose) {
        canOpen = isPunctuation(beforeChar) || beforeChar === 0;
        canClose = isPunctuation(afterChar) || afterChar === 0;
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

      // Search opener stack from top; restart from top after each match
      let si = _openerTop - 1;
      while (si >= 0 && remaining > 0) {
        const opDi = _openerStack[si];
        const opProvIdx = _delimProvIdx[opDi];
        if (getTokenKind(provisional[opProvIdx]) !== kind || !_delimCanOpen[opDi]) {
          si--;
          continue;
        }

        // CommonMark mod-3 rule: skip when sum is a multiple of 3 but neither alone is
        const opLen = getTokenLength(provisional[opProvIdx]);
        const clLen = getTokenLength(provisional[provIdx]);
        if ((opLen + clLen) % 3 === 0 && opLen % 3 !== 0 && clLen % 3 !== 0) {
          si--;
          continue;
        }

        // Consume 2 chars (strong) when both sides have >=2, else 1 (emphasis)
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

        // Restart search from new top after every match
        si = _openerTop - 1;
      }

      _delimRemaining[di] = remaining;
    }

    // Push potential opener (including partially-used closers with remaining chars)
    if (_delimCanOpen[di] && _delimRemaining[di] > 0) {
      if (_openerTop >= _openerStack.length) _growStack(_openerTop + 1);
      _openerStack[_openerTop++] = di;
    }
  }

  // ── Phase 3: emit resolved token stream ───────────────────────────────────
  // Walk provisional tokens in order. For delimiter tokens look up their
  // match events and emit the appropriate combination of open/close tokens
  // and InlineText (for unmatched chars). All other tokens pass through,
  // with adjacent InlineText tokens coalesced.

  let delimIdx = 0;
  let curDelimProvIdx = delimIdx < _delimCount ? _delimProvIdx[0] : n;

  for (let i = 0; i < n; i++) {
    const tok = provisional[i];
    const kind = getTokenKind(tok);
    const len = getTokenLength(tok);

    if (i === curDelimProvIdx) {
      const di = delimIdx;
      delimIdx++;
      curDelimProvIdx = delimIdx < _delimCount ? _delimProvIdx[delimIdx] : n;

      // Tally chars consumed by open and close events for this delimiter
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

      // Emit close events (inner-first = event-record order), unmatched middle, then
      // open events (outer-first = reverse of event-record order).

      // Close events
      for (let mi = 0; mi < _matchCount; mi++) {
        if (_matchCloser[mi] !== di) continue;
        const ul = _matchUseLen[mi];
        output.push(kind === TildeDelimiter
          ? StrikethroughClose | ul
          : (ul >= 2 ? StrongClose : EmphasisClose) | ul);
      }

      // Unmatched chars in the middle (between close and open roles)
      if (unmatchedLen > 0) _emitText(output, unmatchedLen);

      // Open events in reverse (outer opener emitted before inner)
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

  return output.length - outStart;
}