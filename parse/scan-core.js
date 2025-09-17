// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';

/** @param {number} ch */
export function isAsciiAlphaNum(ch) {
  return (
    (ch >= 65 /* A */ && ch <= 90 /* Z */) ||
    (ch >= 97 /* a */ && ch <= 122 /* z */) ||
    (ch >= 48 /* 0 */ && ch <= 57 /* 9 */)
  );
}

/** @param {number} ch */
export function isAsciiAlpha(ch) {
  return (
    (ch >= 65 /* A */ && ch <= 90 /* Z */) ||
    (ch >= 97 /* a */ && ch <= 122 /* z */)
  );
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenLength(token) {
  return token & 0xFFFF; // lower 16 bits
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenKind(token) {
  return /** @type {import('./scan-tokens.js')[keyof import('./scan-tokens.js')]} */(
    token & 0x7FF00000
  ); // upper 11 bits
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenFlags(token) {
  return /** @type {import('./scan-token-flags.js')[keyof import('./scan-token-flags.js')]} */(
    token & 0xF0000
  ); // 4 bits that are above the lower 16 bits
}