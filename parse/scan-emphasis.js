// @ts-check

import { isAsciiAlphaNum } from './scan-core.js';
import { AsteriskDelimiter, UnderscoreDelimiter, TildeDelimiter } from './scan-tokens.js';
import { CanOpen, CanClose } from './scan-token-flags.js';

/**
 * Scan emphasis delimiters (*, _, ~) starting at `start`.
 * Implements flanking rules as described in docs/6-line-emphasis.md.
 * 
 * @param {string} input
 * @param {number} start - Index of the first delimiter character
 * @param {number} end - Exclusive end index
 * @returns {number} provisional token (length | kind | flags) or 0
 */
export function scanEmphasis(input, start, end) {
  if (start < 0 || start >= end) return 0;
  
  const firstChar = input.charCodeAt(start);
  if (firstChar !== 42 /* * */ && firstChar !== 95 /* _ */ && firstChar !== 126 /* ~ */) {
    return 0;
  }

  // Find the run length (consecutive identical delimiter characters)
  let runLength = 1;
  while (start + runLength < end && input.charCodeAt(start + runLength) === firstChar) {
    runLength++;
  }

  // For tildes, runs less than 2 are plain text
  if (firstChar === 126 /* ~ */ && runLength < 2) {
    return 0;
  }

  // Get characters before and after the delimiter run for flanking analysis
  const beforeChar = start > 0 ? input.charCodeAt(start - 1) : 0;
  const afterChar = start + runLength < end ? input.charCodeAt(start + runLength) : 0;

  // Check flanking conditions. Use a bitmask to avoid allocating an object.
  // bit 1 => left-flanking, bit 2 => right-flanking
  const flanking = checkFlanking(beforeChar, afterChar);
  const isLeftFlanking = !!(flanking & 1);
  const isRightFlanking = !!(flanking & 2);

  // Determine CanOpen/CanClose flags based on delimiter type and flanking
  let flags = 0;
  
  if (firstChar === 42 /* * */ || firstChar === 126 /* ~ */) {
    // * and ~: Can open if left-flanking, can close if right-flanking
    if (isLeftFlanking) flags |= CanOpen;
    if (isRightFlanking) flags |= CanClose;
  } else if (firstChar === 95 /* _ */) {
    // _: More restrictive rules for intraword emphasis
    if (isLeftFlanking && (!isRightFlanking || isPunctuation(beforeChar))) {
      flags |= CanOpen;
    }
    if (isRightFlanking && (!isLeftFlanking || isPunctuation(afterChar))) {
      flags |= CanClose;
    }
  }

  // If neither CanOpen nor CanClose, this becomes plain text
  if (flags === 0) return 0;

  // Determine token kind
  let tokenKind;
  if (firstChar === 42 /* * */) {
    tokenKind = AsteriskDelimiter;
  } else if (firstChar === 95 /* _ */) {
    tokenKind = UnderscoreDelimiter;
  } else { // firstChar === 126 /* ~ */
    tokenKind = TildeDelimiter;
  }

  return runLength | tokenKind | flags;
}

/**
 * Check if a delimiter run is left-flanking or right-flanking.
 * 
 * @param {number} beforeChar - Character code before the run (0 if at start)
 * @param {number} afterChar - Character code after the run (0 if at end)
 * @returns {number} bitmask: bit 1 => isLeftFlanking, bit 2 => isRightFlanking
 */
function checkFlanking(beforeChar, afterChar) {
  const beforeIsWhitespace = isWhitespace(beforeChar);
  const afterIsWhitespace = isWhitespace(afterChar);
  const beforeIsPunctuation = isPunctuation(beforeChar);
  const afterIsPunctuation = isPunctuation(afterChar);

  // Left-flanking: not followed by whitespace AND 
  // (not followed by punctuation OR followed by punctuation and preceded by whitespace or punctuation)
  const isLeftFlanking = !afterIsWhitespace &&
    (!afterIsPunctuation || (afterIsPunctuation && (beforeIsWhitespace || beforeIsPunctuation)));

  // Right-flanking: not preceded by whitespace AND
  // (not preceded by punctuation OR preceded by punctuation and followed by whitespace or punctuation)
  const isRightFlanking = !beforeIsWhitespace &&
    (!beforeIsPunctuation || (beforeIsPunctuation && (afterIsWhitespace || afterIsPunctuation)));

  // bit 1 = left, bit 2 = right
  return (isLeftFlanking ? 1 : 0) | (isRightFlanking ? 2 : 0);
}

/**
 * Check if a character is whitespace.
 * @param {number} ch - Character code (0 if at boundary)
 * @returns {boolean}
 */
function isWhitespace(ch) {
  if (ch === 0) return true; // Treat boundaries as whitespace for flanking
  return ch === 32 /* space */ || ch === 9 /* tab */ || ch === 10 /* \n */ || ch === 13 /* \r */;
}

/**
 * Check if a character is punctuation (Unicode P category - simplified implementation).
 * @param {number} ch - Character code (0 if at boundary)
 * @returns {boolean}
 */
function isPunctuation(ch) {
  if (ch === 0) return false; // Boundaries are not punctuation
  
  // ASCII punctuation characters
  return (ch >= 33 && ch <= 47) ||   // ! " # $ % & ' ( ) * + , - . /
         (ch >= 58 && ch <= 64) ||   // : ; < = > ? @
         (ch >= 91 && ch <= 96) ||   // [ \ ] ^ _ `
         (ch >= 123 && ch <= 126);   // { | } ~
}