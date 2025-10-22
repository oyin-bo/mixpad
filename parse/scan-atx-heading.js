// @ts-check

import { ATXHeadingOpen, ATXHeadingClose } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan ATX-style heading opening marker (# prefix)
 * 
 * This scanner only emits the ATXHeadingOpen token for the # sequence.
 * The content and closing sequence (if present) will be scanned by the
 * main loop in scan0.js as regular inline tokens.
 * 
 * Pattern B: pushes tokens and returns consumed length.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first #)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not valid ATX heading
 */
export function scanATXHeading(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 35 /* # */) return 0;
  
  // Validate line-start context (up to 3 spaces indentation allowed)
  const lineStart = findLineStart(input, start);
  const indent = countIndentation(input, lineStart, start);
  if (indent > 3) return 0; // 4+ spaces = code block
  
  // Ensure we're immediately after the indentation (no other characters between line start and #)
  // countIndentation stops at first non-whitespace, so lineStart + indent should equal start
  if (lineStart + indent !== start) return 0; // There's a non-whitespace character before the #
  
  // Count consecutive # characters (must be 1-6)
  let pos = start;
  let hashCount = 0;
  while (pos < end && input.charCodeAt(pos) === 35 /* # */) {
    hashCount++;
    pos++;
  }
  
  // Must have 1-6 hashes (7+ is not a heading)
  if (hashCount < 1 || hashCount > 6) return 0;
  
  // Must have space or tab after # sequence, OR be at end of input/line
  if (pos < end) {
    const afterHash = input.charCodeAt(pos);
    if (afterHash !== 32 /* space */ && 
        afterHash !== 9 /* tab */ &&
        afterHash !== 10 /* \n */ &&
        afterHash !== 13 /* \r */) {
      return 0; // Not a valid heading
    }
  }
  
  // Emit ATXHeadingOpen token
  output.push(ATXHeadingOpen | hashCount);
  
  // Return length of just the opening sequence
  return hashCount;
}

/**
 * Extract heading depth from token (1-6 for ATX levels)
 * @param {number} token - ATXHeadingOpen token
 * @returns {number} Depth 1-6 for ATX
 */
export function getATXHeadingDepth(token) {
  return token & 0xFFFF; // Lower 16 bits contain the hash count
}
