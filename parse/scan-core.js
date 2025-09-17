// @ts-check

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
  return token & 0x7FFF0000; // upper 15 bits
}
