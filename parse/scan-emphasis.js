// @ts-check

import { getTokenKind, isAsciiAlphaNum, isPunctuation, isWhitespace } from './scan-core.js';
import { AsteriskDelimiter, InlineText, TildeDelimiter, UnderscoreDelimiter } from './scan-tokens.js';

/**
 * Scan emphasis delimiters (*, _, ~) starting at `start`.
 * Implements flanking rules as described in docs/6-line-emphasis.md.
 * 
 * @param {string} input
 * @param {number} start - Index of the first delimiter character
 * @param {number} end - Exclusive end index
 * @returns {number} provisional token (length | kind | flags) or 0
 */
/**
 * New API: scanEmphasis now mirrors scanFencedBlock: it may push one or more
 * provisional tokens into `output` and returns the number of tokens added.
 *
 * @param {string} input
 * @param {number} start - Index of the first delimiter character
 * @param {number} end - Exclusive end index
 * @param {number[]} output - optional array to push provisional tokens into
 * @returns {number} number of tokens pushed into output (0 when none)
 */
export function scanEmphasis(input, start, end, output) {
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
  // Pragmatic demotions that are provably non-delimiters based on raw
  // characters (these cannot be altered by entity/escape tokenization):
  // - space-flanked runs (whitespace before and after) can never act
  //   as emphasis delimiters, so treat them as plain text.
  // - underscore runs between ASCII alphanumerics are intraword and
  //   cannot act as delimiters.
  const beforeChar = start > 0 ? input.charCodeAt(start - 1) : 0;
  const afterChar = start + runLength < end ? input.charCodeAt(start + runLength) : 0;

  if (isWhitespace(beforeChar) && isWhitespace(afterChar)) {
    return 0;
  }

  if (firstChar === 95 /* _ */ && isAsciiAlphaNum(beforeChar) && isAsciiAlphaNum(afterChar)) {
    // only demote underscores if previous token is inline text
    if (output.length && getTokenKind(output[output.length - 1]) === InlineText) {
      return 0;
    }
  }

  // Determine token kind
  let tokenKind;
  if (firstChar === 42 /* * */) {
    tokenKind = AsteriskDelimiter;
  } else if (firstChar === 95 /* _ */) {
    tokenKind = UnderscoreDelimiter;
  } else { // firstChar === 126 /* ~ */
    tokenKind = TildeDelimiter;
  }

  output.push(runLength | tokenKind);
  return 1;
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
