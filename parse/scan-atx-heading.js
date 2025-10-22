// @ts-check

import { ATXHeadingOpen, ATXHeadingClose, InlineText } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan ATX-style heading (# prefix)
 * 
 * Scans the opening # sequence, then scans content as inline tokens,
 * setting heading depth (bits 28-30) on all emitted tokens.
 * 
 * ATX headings:
 * - Require 1-6 # characters (7+ is not a heading)
 * - Must have at least one space or tab after opening #
 * - Can have up to 3 spaces indentation (4+ is code block)
 * - Optional closing # sequence (any length)
 * - All inline content tokens carry the heading depth in bits 28-30
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first #)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not valid ATX heading
 */
export function scanATXHeading(input, start, end, output) {
  if (start >= end) return 0;
  
  // Must start with #
  if (input.charCodeAt(start) !== 35 /* # */) return 0;
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;
  
  // Heading must be first non-whitespace character on line
  if (lineStart + lineIndent !== start) return 0;
  
  // Count consecutive # characters (must be 1-6)
  let hashCount = 0;
  let pos = start;
  while (pos < end && input.charCodeAt(pos) === 35 /* # */ && hashCount < 7) {
    hashCount++;
    pos++;
  }
  
  // Invalid if 7+ hashes
  if (hashCount > 6) return 0;
  
  // Must have space, tab, newline, or be at EOF after #
  if (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch !== 32 && ch !== 9 && ch !== 10 && ch !== 13) return 0;
  }
  
  // Valid ATX heading
  const depth = hashCount; // 1-6
  const depthBits = (depth & 0x7) << 26; // Use bits 26-28 for heading depth
  
  // Find end of line
  let lineEnd = pos;
  while (lineEnd < end) {
    const ch = input.charCodeAt(lineEnd);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
    lineEnd++;
  }
  
  // Emit ATXHeadingOpen (just the # characters, no space)
  output.push(hashCount | ATXHeadingOpen | depthBits);
  
  // Content starts immediately after opening (includes the required space)
  let contentStart = pos;
  
  // Find content bounds (excluding closing sequence if present)
  let contentEnd = lineEnd;
  
  // Trim trailing whitespace
  while (contentEnd > contentStart && 
         (input.charCodeAt(contentEnd - 1) === 32 || input.charCodeAt(contentEnd - 1) === 9)) {
    contentEnd--;
  }
  
  // Check for closing sequence at end
  let closingStart = -1;
  let closingEnd = -1;
  if (contentEnd > contentStart && input.charCodeAt(contentEnd - 1) === 35 /* # */) {
    // Scan backwards to find start of # sequence
    let hashStart = contentEnd - 1;
    while (hashStart > contentStart && input.charCodeAt(hashStart - 1) === 35 /* # */) {
      hashStart--;
    }
    
    // Must be preceded by space/tab or be right at content start
    if (hashStart === contentStart || 
        input.charCodeAt(hashStart - 1) === 32 || 
        input.charCodeAt(hashStart - 1) === 9) {
      closingStart = hashStart;
      closingEnd = contentEnd;
      // Set flag on opening token
      output[output.length - 1] |= (1 << 31);
      // Adjust content end to exclude closing
      contentEnd = hashStart;
      // Trim whitespace before closing
      while (contentEnd > contentStart && 
             (input.charCodeAt(contentEnd - 1) === 32 || input.charCodeAt(contentEnd - 1) === 9)) {
        contentEnd--;
      }
    }
  }
  
  // Emit content as InlineText if non-empty
  if (contentEnd > contentStart) {
    const contentLength = contentEnd - contentStart;
    output.push(contentLength | InlineText | depthBits);
  }
  
  // Emit closing sequence if present
  if (closingStart >= 0) {
    const closingLength = closingEnd - closingStart;
    output.push(closingLength | ATXHeadingClose | depthBits);
  }
  
  // Calculate total consumed: from start to end of line including newline
  let consumed = lineEnd - start;
  if (lineEnd < end) {
    const ch = input.charCodeAt(lineEnd);
    if (ch === 13 && lineEnd + 1 < end && input.charCodeAt(lineEnd + 1) === 10) {
      consumed += 2; // CRLF
    } else if (ch === 10 || ch === 13) {
      consumed += 1; // LF or CR
    }
  }
  
  return consumed;
}

/**
 * Extract heading depth from token (1-6 for ATX, 0 if not in heading)
 * @param {number} token - Any token from heading
 * @returns {number} Depth 1-6 for ATX, 0 if not in heading
 */
export function getHeadingDepth(token) {
  return (token >> 26) & 0x7; // Extract bits 26-28
}

/**
 * Check if ATX heading has closing sequence
 * @param {number} token - ATXHeadingOpen token
 * @returns {boolean}
 */
export function hasATXClosingSequence(token) {
  return ((token >> 31) & 1) === 1;
}
