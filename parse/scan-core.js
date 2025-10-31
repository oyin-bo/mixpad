// @ts-check
import { HeadingDepthMask, HeadingDepthShift } from './scan-token-flags.js';

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

/**
 * Check if a character is whitespace.
 * @param {number} ch - Character code (0 if at boundary)
 * @returns {boolean}
 */
export function isWhitespace(ch) {
  switch (ch) {
    case 0: // zero-character
    case 9: // tab
    case 10: // \n
    case 13: // \r
    case 32: // space

    // peculiar ASCII cases
    case 11: // vertical tab (U+000B)
    case 12: // form feed (U+000C)

    // valid Unicode whitespace
    case 0x85: // next line NEL (U+0085)
    case 0xA0: // no-break space (U+00A0)
    case 0x1680: // ogham space mark (U+1680)
    // historically considered whitespace, but now deprecated
    // case 0x180E: // Mongolian vowel separator (U+180E)
    case 0x2000: // en quad (U+2000)
    case 0x2001: // em quad (U+2001)
    case 0x2002: // en space (U+2002)
    case 0x2003: // em space (U+2003)
    case 0x2004: // three-per-em space (U+2004)
    case 0x2005: // four-per-em space (U+2005)
    case 0x2006: // six-per-em space (U+2006)
    case 0x2007: // figure space (U+2007)
    case 0x2008: // punctuation space (U+2008)
    case 0x2009: // thin space (U+2009)
    case 0x200A: // hair space (U+200A)
    // zero-width, NOT WHITESPACE
    // case 0x200B: // zero width space (U+200B)
    case 0x2028: // line separator (U+2028)
    case 0x2029: // paragraph separator (U+2029)
    case 0x202F: // narrow no-break space (U+202F)
    case 0x205F: // medium mathematical space (U+205F)
    case 0x3000: // ideographic space (U+3000)
      // zero-width, MAY be considered, but can be visually surprising
      // case 0xFEFF: // zero width no-break space / BOM (U+FEFF)
      return true;
  }

  return false;
}

/**
 * Check if a character is punctuation (Unicode P category - simplified implementation).
 * @param {number} ch - Character code (0 if at boundary)
 * @returns {boolean}
 */
export function isPunctuation(ch) {
  if (ch === 0) return false; // Boundaries are not punctuation

  // ASCII punctuation characters
  return (ch >= 33 && ch <= 47) ||   // ! " # $ % & ' ( ) * + , - . /
    (ch >= 58 && ch <= 64) ||   // : ; < = > ? @
    (ch >= 91 && ch <= 96) ||   // [ \ ] ^ _ `
    (ch >= 123 && ch <= 126);   // { | } ~
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenLength(token) {
  return token & 0xFFFF; // lower 16 bits
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenKind(token) {
  return /** @type {TokenKind} */(
    token & 0x03FF0000
  ); // token kind lives in bits 16-25 (mask 0x03FF0000 = 10 bits = 1024 token types)
}

/** @param {import('./scan0.js').ProvisionalToken} token */
export function getTokenFlags(token) {
  return /** @type {TokenFlags} */(
    token & 0x60000000
  ); // bits 29-30 (0x60000000)
}

/**
 * Extract heading depth (0-7) from token's dedicated field (bits 26–28).
 * 0 means not in heading; 1..6 typically represent heading levels.
 * @param {import('./scan0.js').ProvisionalToken} token
 * @returns {number}
 */
export function getHeadingDepth(token) {
  return (token & HeadingDepthMask) >>> HeadingDepthShift;
}

/**
 * Find the start of the current line (scan backwards to previous newline or start of input)
 * @param {string} input
 * @param {number} pos
 * @returns {number} position of line start
 */
export function findLineStart(input, pos) {
  while (pos > 0) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) return pos;
    pos--;
  }
  return 0;
}

/**
 * Count spaces and tabs from line start to given position
 * @param {string} input
 * @param {number} lineStart
 * @param {number} pos
 * @returns {number} number of space-equivalent characters (tabs count as moving to next multiple of 4)
 */
export function countIndentation(input, lineStart, pos) {
  let indent = 0;
  for (let i = lineStart; i < pos; i++) {
    const ch = input.charCodeAt(i);
    if (ch === 32) { // space
      indent++;
    } else if (ch === 9) { // tab
      // Tab moves to next multiple of 4
      indent = (indent + 4) & ~3;
    } else {
      break;
    }
  }
  return indent;
}