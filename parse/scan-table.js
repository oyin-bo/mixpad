// @ts-check

import { TablePipe, TableDelimiterCell } from './scan-tokens.js';

/**
 * Scan table pipe character |
 * 
 * GFM tables use pipes to separate cells. A pipe can appear:
 * - At the start of a line (optional leading pipe)
 * - Between cells
 * - At the end of a line (optional trailing pipe)
 * 
 * The scanner only recognizes isolated pipes - the semantic phase
 * determines if they form a valid table structure.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of |)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a table pipe
 */
export function scanTablePipe(input, start, end, output) {
  if (start >= end) return 0;
  
  const char = input.charCodeAt(start);
  
  // Must be a pipe character
  if (char !== 124) return 0; // 124 = '|'
  
  // Token length is 1
  const length = 1;
  
  output.push(length | TablePipe);
  
  return length;
}

/**
 * Scan table delimiter cell (part of delimiter row)
 * 
 * A delimiter cell consists of:
 * - Optional leading colon (:)
 * - One or more dashes (-)
 * - Optional trailing colon (:)
 * - Optional whitespace around the content
 * 
 * Valid examples:
 * - "---"      (default/left align)
 * - ":---"     (left align)
 * - ":---:"    (center align)
 * - "---:"     (right align)
 * - " :---: "  (center with whitespace)
 * 
 * The alignment info is encoded in the token for later semantic analysis.
 * 
 * Token encoding:
 * - Bits 0-15: Length (total characters consumed)
 * - Bits 16-25: Token type (TableDelimiterCell)
 * - Bits 26-27: Alignment (0=left, 1=center, 2=right, 3=default)
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a delimiter cell
 */
export function scanTableDelimiterCell(input, start, end, output) {
  if (start >= end) return 0;
  
  let pos = start;
  
  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  if (pos >= end) return 0;
  
  // Check for leading colon
  let hasLeadingColon = false;
  if (input.charCodeAt(pos) === 58) { // ':'
    hasLeadingColon = true;
    pos++;
  }
  
  if (pos >= end) return 0;
  
  // Must have at least one dash
  let dashCount = 0;
  while (pos < end && input.charCodeAt(pos) === 45) { // '-'
    dashCount++;
    pos++;
  }
  
  if (dashCount === 0) return 0;
  
  // Check for trailing colon
  let hasTrailingColon = false;
  if (pos < end && input.charCodeAt(pos) === 58) { // ':'
    hasTrailingColon = true;
    pos++;
  }
  
  // Skip trailing whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Determine alignment
  // 0 = explicit left (:---), 1 = center (:---:), 2 = right (---:), 3 = default/unspecified (---)
  let alignment = 3; // default/unspecified
  if (hasLeadingColon && hasTrailingColon) {
    alignment = 1; // center
  } else if (hasLeadingColon) {
    alignment = 0; // explicit left
  } else if (hasTrailingColon) {
    alignment = 2; // right
  }
  
  const length = pos - start;
  // alignment is guaranteed to be 0-3, safe for 2-bit encoding
  const alignmentBits = alignment << 26;
  
  output.push(length | TableDelimiterCell | alignmentBits);
  
  return length;
}

/**
 * Check if a line looks like a table delimiter row
 * 
 * A delimiter row consists of pipes and delimiter cells.
 * This is a lookahead function used by semantic analysis.
 * 
 * @param {string} input - The input text
 * @param {number} lineStart - Start of line
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, cellCount: number }} Whether line is a valid delimiter row
 */
export function checkTableDelimiterRow(input, lineStart, end) {
  let pos = lineStart;
  let cellCount = 0;
  let hasPipes = false;
  
  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Check for leading pipe (optional)
  if (pos < end && input.charCodeAt(pos) === 124) { // '|'
    hasPipes = true;
    pos++;
  }
  
  // Process cells
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    
    // Stop at newline
    if (ch === 10 || ch === 13) break;
    
    // Skip whitespace before cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    if (pos >= end || input.charCodeAt(pos) === 10 || input.charCodeAt(pos) === 13) break;
    
    // Parse delimiter cell
    const cellStart = pos;
    
    // Optional leading colon
    if (pos < end && input.charCodeAt(pos) === 58) pos++; // ':'
    
    // Must have at least one dash
    let dashCount = 0;
    while (pos < end && input.charCodeAt(pos) === 45) { // '-'
      dashCount++;
      pos++;
    }
    
    if (dashCount === 0) return { isValid: false, cellCount: 0 };
    
    // Optional trailing colon
    if (pos < end && input.charCodeAt(pos) === 58) pos++; // ':'
    
    cellCount++;
    
    // Skip whitespace after cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    if (pos >= end) break;
    
    const nextCh = input.charCodeAt(pos);
    if (nextCh === 10 || nextCh === 13) break;
    
    // Expect pipe separator
    if (nextCh === 124) { // '|'
      hasPipes = true;
      pos++;
    } else {
      // No pipe - only valid if this is the last cell and no leading pipe was used
      return { isValid: false, cellCount: 0 };
    }
  }
  
  // Valid if we found at least one cell and at least one pipe
  return { isValid: hasPipes && cellCount > 0, cellCount };
}

/**
 * Extract alignment from a TableDelimiterCell token
 * @param {number} token - The token
 * @returns {number} Alignment: 0=left, 1=center, 2=right, 3=default
 */
export function getTableAlignment(token) {
  return (token >> 26) & 0x3;
}
