// @ts-check

import { OrderedListMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan ordered list marker: digits followed by . or )
 * 
 * Syntax: `1. `, `2) `, `999. ` (1-9 digits + delimiter + space/tab)
 * 
 * Rules:
 * - 1-9 digits (0-9)
 * - Followed by `.` (46) or `)` (41)
 * - Followed by at least one space (32) or tab (9)
 * - Can be indented up to 3 spaces from line start
 * - Start number ≤ 999,999,999
 * 
 * Token encoding (31 bits):
 * - Bits 0-19: Length (digits + delimiter, NOT including trailing space)
 * - Bits 20-23: Token type (OrderedListMarker)
 * - Bits 24-31: Metadata:
 *   - Bit 24: Delimiter type (0 for '.', 1 for ')')
 *   - Bits 25-31: Reserved for start number (stored separately in higher bits)
 * 
 * Note: Start number is stored in a separate metadata structure since we can't
 * fit large numbers in the remaining bits. For now we only store delimiter type.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first digit)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not an ordered marker
 */
export function scanOrderedListMarker(input, start, end, output) {
  if (start >= end) return 0;
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;
  
  // Marker must be first non-whitespace character on line
  if (lineStart + lineIndent !== start) return 0;
  
  let offset = start;
  let number = 0;
  let digitCount = 0;
  
  // Parse digits (1-9 digits max to prevent overflow)
  while (offset < end && digitCount < 9) {
    const ch = input.charCodeAt(offset);
    if (ch >= 48 && ch <= 57) { // 0-9
      number = number * 10 + (ch - 48);
      digitCount++;
      offset++;
    } else {
      break;
    }
  }
  
  // Must have at least one digit, but not more than 9
  if (digitCount === 0 || digitCount > 9) return 0;
  
  // Must have . or ) delimiter
  if (offset >= end) return 0;
  const delim = input.charCodeAt(offset);
  if (delim !== 46 && delim !== 41) return 0; // not . or )
  offset++;
  
  // Must be followed by space or tab
  if (offset >= end) return 0;
  const next = input.charCodeAt(offset);
  if (next !== 32 && next !== 9) return 0;
  
  // Token length is digits + delimiter (NOT including trailing space)
  const length = offset - start;
  
  // Encode delimiter type in bit 28: 0 for '.', 1 for ')'
  const delimBit = delim === 46 ? 0 : (1 << 28);
  
  // Pack: length | type | delimiter_bit
  // Note: We can't fit the start number in the token itself for large numbers,
  // so semantic layer will need to re-parse it from the source when needed
  output.push(length | OrderedListMarker | delimBit);
  
  return length;
}

/**
 * Extract the delimiter type from an OrderedListMarker token
 * @param {number} token - The token
 * @returns {'.' | ')'} The delimiter character
 */
export function getOrderedMarkerDelimiter(token) {
  return ((token >> 28) & 1) === 0 ? '.' : ')';
}

/**
 * Re-parse the start number from the source text
 * @param {string} input - The input text
 * @param {number} start - Start of the marker in input
 * @returns {number} The start number (1-999999999)
 */
export function getOrderedMarkerStartNumber(input, start) {
  let number = 0;
  let offset = start;
  
  while (offset < input.length) {
    const ch = input.charCodeAt(offset);
    if (ch >= 48 && ch <= 57) { // 0-9
      number = number * 10 + (ch - 48);
      offset++;
    } else {
      break;
    }
  }
  
  return number;
}
