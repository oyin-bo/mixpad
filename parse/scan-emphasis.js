// @ts-check

import { CanOpen, CanClose } from './scan-token-flags.js';
import { AsteriskDelimiter, UnderscoreDelimiter, TildeDelimiter } from './scan-tokens.js';

/**
 * Check if character is Unicode punctuation (category P)
 * This is a simplified implementation covering common cases
 * @param {number} ch 
 * @returns {boolean}
 */
function isPunctuation(ch) {
  return (
    // ASCII punctuation
    (ch >= 33 && ch <= 47) || // ! " # $ % & ' ( ) * + , - . /
    (ch >= 58 && ch <= 64) || // : ; < = > ? @
    (ch >= 91 && ch <= 96) || // [ \ ] ^ _ `
    (ch >= 123 && ch <= 126)  // { | } ~
  );
}

/**
 * Check if character is whitespace
 * @param {number} ch 
 * @returns {boolean}
 */
function isWhitespace(ch) {
  return ch === 32 /* space */ || ch === 9 /* tab */ || ch === 10 /* \n */ || ch === 13 /* \r */;
}

/**
 * Get character before position, or 0 if at start
 * @param {string} input 
 * @param {number} pos 
 * @returns {number}
 */
function getCharBefore(input, pos) {
  return pos > 0 ? input.charCodeAt(pos - 1) : 0;
}

/**
 * Get character after position, or 0 if at end
 * @param {string} input 
 * @param {number} pos 
 * @param {number} end 
 * @returns {number}
 */
function getCharAfter(input, pos, end) {
  return pos < end ? input.charCodeAt(pos) : 0;
}

/**
 * Compute flanking flags for delimiter run according to CommonMark rules
 * @param {string} input
 * @param {number} runStart - start of delimiter run
 * @param {number} runEnd - end of delimiter run (exclusive)
 * @param {number} end - end of input
 * @param {number} delimiterChar - the delimiter character code (*, _, or ~)
 * @returns {{ leftFlanking: boolean, rightFlanking: boolean }}
 */
function computeFlankingFlags(input, runStart, runEnd, end, delimiterChar) {
  const charBefore = getCharBefore(input, runStart);
  const charAfter = getCharAfter(input, runEnd, end);

  const beforeIsWhitespace = isWhitespace(charBefore);
  const afterIsWhitespace = isWhitespace(charAfter);
  const beforeIsPunctuation = isPunctuation(charBefore);
  const afterIsPunctuation = isPunctuation(charAfter);

  // A delimiter run is left-flanking if:
  // - It is not followed by whitespace
  // - AND either not followed by punctuation, OR followed by punctuation and preceded by whitespace or punctuation
  const leftFlanking = !afterIsWhitespace && 
    (!afterIsPunctuation || (afterIsPunctuation && (beforeIsWhitespace || beforeIsPunctuation)));

  // A delimiter run is right-flanking if:
  // - It is not preceded by whitespace
  // - AND either not preceded by punctuation, OR preceded by punctuation and followed by whitespace or punctuation
  const rightFlanking = !beforeIsWhitespace && 
    (!beforeIsPunctuation || (beforeIsPunctuation && (afterIsWhitespace || afterIsPunctuation)));

  return { leftFlanking, rightFlanking };
}

/**
 * Scan asterisk delimiter run
 * @param {string} input
 * @param {number} start - position of first asterisk
 * @param {number} end
 * @returns {number} AsteriskDelimiter token with appropriate flags, or 0 if none
 */
function scanAsteriskRun(input, start, end) {
  if (start >= end || input.charCodeAt(start) !== 42 /* * */) return 0;

  // Find run length
  let runEnd = start + 1;
  while (runEnd < end && input.charCodeAt(runEnd) === 42 /* * */) {
    runEnd++;
  }
  const runLength = runEnd - start;

  // Compute flanking
  const { leftFlanking, rightFlanking } = computeFlankingFlags(input, start, runEnd, end, 42);

  // For asterisk: can open if left-flanking, can close if right-flanking
  let flags = 0;
  if (leftFlanking) flags |= CanOpen;
  if (rightFlanking) flags |= CanClose;

  // If neither can open nor close, treat as plain text (return 0)
  if (!flags) return 0;

  return AsteriskDelimiter | flags | runLength;
}

/**
 * Scan underscore delimiter run
 * @param {string} input
 * @param {number} start - position of first underscore
 * @param {number} end
 * @returns {number} UnderscoreDelimiter token with appropriate flags, or 0 if none
 */
function scanUnderscoreRun(input, start, end) {
  if (start >= end || input.charCodeAt(start) !== 95 /* _ */) return 0;

  // Find run length
  let runEnd = start + 1;
  while (runEnd < end && input.charCodeAt(runEnd) === 95 /* _ */) {
    runEnd++;
  }
  const runLength = runEnd - start;

  // Compute flanking
  const { leftFlanking, rightFlanking } = computeFlankingFlags(input, start, runEnd, end, 95);
  
  const charBefore = getCharBefore(input, start);
  const charAfter = getCharAfter(input, runEnd, end);
  const beforeIsPunctuation = isPunctuation(charBefore);
  const afterIsPunctuation = isPunctuation(charAfter);

  // For underscore: special intraword rules
  // Can open if left-flanking AND (not right-flanking OR preceded by punctuation)
  // Can close if right-flanking AND (not left-flanking OR followed by punctuation)
  let flags = 0;
  if (leftFlanking && (!rightFlanking || beforeIsPunctuation)) flags |= CanOpen;
  if (rightFlanking && (!leftFlanking || afterIsPunctuation)) flags |= CanClose;

  // If neither can open nor close, treat as plain text (return 0)
  if (!flags) return 0;

  return UnderscoreDelimiter | flags | runLength;
}

/**
 * Scan tilde delimiter run  
 * @param {string} input
 * @param {number} start - position of first tilde
 * @param {number} end
 * @returns {number} TildeDelimiter token with appropriate flags, or 0 if none
 */
function scanTildeRun(input, start, end) {
  if (start >= end || input.charCodeAt(start) !== 126 /* ~ */) return 0;

  // Find run length
  let runEnd = start + 1;
  while (runEnd < end && input.charCodeAt(runEnd) === 126 /* ~ */) {
    runEnd++;
  }
  const runLength = runEnd - start;

  // Tilde runs less than 2 are plain text
  if (runLength < 2) return 0;

  // Compute flanking
  const { leftFlanking, rightFlanking } = computeFlankingFlags(input, start, runEnd, end, 126);

  // For tilde: can open if left-flanking, can close if right-flanking
  let flags = 0;
  if (leftFlanking) flags |= CanOpen;
  if (rightFlanking) flags |= CanClose;

  // If neither can open nor close, treat as plain text (return 0)
  if (!flags) return 0;

  return TildeDelimiter | flags | runLength;
}

/**
 * Scan emphasis delimiter (*, _, or ~) starting at position
 * @param {string} input
 * @param {number} start - position of delimiter character
 * @param {number} end
 * @returns {number} appropriate delimiter token with flags, or 0 if should be plain text
 */
export function scanEmphasisDelimiter(input, start, end) {
  if (start >= end) return 0;

  const ch = input.charCodeAt(start);
  switch (ch) {
    case 42 /* * */: return scanAsteriskRun(input, start, end);
    case 95 /* _ */: return scanUnderscoreRun(input, start, end);
    case 126 /* ~ */: return scanTildeRun(input, start, end);
    default: return 0;
  }
}