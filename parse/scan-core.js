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

export const PARSE_TOKENS = {
  InlineText: 0x1000000,
  Whitespace: 0x2000000,
  NewLine: 0x1000000,
  EntityNamed: 0x3000000,
  EntityDecimal: 0x4000000,
  EntityHex: 0x5000000
};
