// @ts-check

/**
 * @typedef {import('./scan-tokens.js')[keyof import('./scan-tokens.js')]} TokenKind
 * @typedef {import('./scan-token-flags.js')[keyof import('./scan-token-flags.js')]} TokenFlags
 */

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
  return /** @type {TokenKind} */(
    token & 0x00F00000
  ); // token kind lives in bits 20-23 (mask 0x00F00000)
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenFlags(token) {
  return /** @type {TokenFlags} */(
    token & 0xF0000
  ); // 4 bits that are above the lower 16 bits
}