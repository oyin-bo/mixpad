// @ts-check

import { TablePipe, TableDelimiterDash, TableDelimiterColon } from './scan-tokens.js';
import { findLineStart } from './scan-core.js';

/**
 * Check if a line is a valid table delimiter row
 * 
 * Delimiter row format:
 * - Pipes separating cells (at least one pipe required)
 * - Each cell contains: optional spaces, optional colon, at least 3 dashes, optional colon, optional spaces
 * - Valid patterns per cell: `---`, `:---`, `---:`, `:---:`
 * - Outer pipes are optional
 * 
 * @param {string} input - The input text
 * @param {number} start - Start of line to check
 * @param {number} end - End boundary
 * @returns {{ isValid: boolean, columnCount: number, alignments: number[] }} 
 *   Result with validity flag, column count, and alignment info
 *   Alignments: 0=left, 1=center, 2=right
 */
export function checkTableDelimiterRow(input, start, end) {
  let offset = start;
  let columnCount = 0;
  /** @type {number[]} */
  const alignments = [];
  
  // Skip leading whitespace
  while (offset < end && (input.charCodeAt(offset) === 32 || input.charCodeAt(offset) === 9)) {
    offset++;
  }
  
  // Check if starts with pipe (optional)
  const hasLeadingPipe = offset < end && input.charCodeAt(offset) === 124; // |
  if (hasLeadingPipe) {
    offset++;
  }
  
  // Parse cells
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    
    // End of line
    if (ch === 10 || ch === 0) break;
    
    // Skip whitespace before cell content
    while (offset < end && (input.charCodeAt(offset) === 32 || input.charCodeAt(offset) === 9)) {
      offset++;
    }
    if (offset >= end) break;
    
    // Check for cell content
    let hasLeadingColon = false;
    let hasTrailingColon = false;
    let dashCount = 0;
    
    // Leading colon
    if (input.charCodeAt(offset) === 58) { // :
      hasLeadingColon = true;
      offset++;
    }
    
    // Skip whitespace after leading colon
    while (offset < end && (input.charCodeAt(offset) === 32 || input.charCodeAt(offset) === 9)) {
      offset++;
    }
    
    // Count dashes
    while (offset < end && input.charCodeAt(offset) === 45) { // -
      dashCount++;
      offset++;
    }
    
    // Need at least 3 dashes
    if (dashCount < 3) {
      return { isValid: false, columnCount: 0, alignments: [] };
    }
    
    // Skip whitespace after dashes
    while (offset < end && (input.charCodeAt(offset) === 32 || input.charCodeAt(offset) === 9)) {
      offset++;
    }
    
    // Trailing colon
    if (offset < end && input.charCodeAt(offset) === 58) { // :
      hasTrailingColon = true;
      offset++;
    }
    
    // Skip trailing whitespace
    while (offset < end && (input.charCodeAt(offset) === 32 || input.charCodeAt(offset) === 9)) {
      offset++;
    }
    
    // Determine alignment
    let alignment = 0; // left
    if (hasLeadingColon && hasTrailingColon) {
      alignment = 1; // center
    } else if (hasTrailingColon) {
      alignment = 2; // right
    }
    alignments.push(alignment);
    columnCount++;
    
    // Check for pipe or end of line
    if (offset < end) {
      const nextCh = input.charCodeAt(offset);
      if (nextCh === 124) { // |
        offset++;
      } else if (nextCh === 10 || nextCh === 0) {
        break;
      } else {
        // Unexpected character
        return { isValid: false, columnCount: 0, alignments: [] };
      }
    }
  }
  
  // Must have at least one column
  if (columnCount === 0) {
    return { isValid: false, columnCount: 0, alignments: [] };
  }
  
  return { isValid: true, columnCount, alignments };
}

/**
 * Scan a table pipe character
 * 
 * This is called when we encounter a pipe (|) character that should be treated
 * as a table cell separator.
 * 
 * @param {string} input - The input text
 * @param {number} start - Position of the pipe character
 * @param {number} end - End boundary
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed (1 for the pipe)
 */
export function scanTablePipe(input, start, end, output) {
  if (start >= end) return 0;
  
  const ch = input.charCodeAt(start);
  if (ch !== 124) return 0; // Not a pipe
  
  output.push(1 | TablePipe);
  return 1;
}

/**
 * Scan table delimiter row components
 * 
 * This scans the dashes and colons in a delimiter row.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start of delimiter component
 * @param {number} end - End boundary
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed
 */
export function scanTableDelimiter(input, start, end, output) {
  if (start >= end) return 0;
  
  let offset = start;
  const ch = input.charCodeAt(offset);
  
  // Scan colon
  if (ch === 58) { // :
    output.push(1 | TableDelimiterColon);
    return 1;
  }
  
  // Scan dashes
  if (ch === 45) { // -
    let dashCount = 0;
    while (offset < end && input.charCodeAt(offset) === 45) {
      dashCount++;
      offset++;
    }
    output.push(dashCount | TableDelimiterDash);
    return dashCount;
  }
  
  return 0;
}

/**
 * Check if current position could be the start of a table
 * 
 * A table starts when:
 * 1. We're at the start of a line
 * 2. The line contains at least one pipe character
 * 3. The next non-blank line is a valid delimiter row
 * 
 * @param {string} input - The input text
 * @param {number} start - Current position (start of potential header row)
 * @param {number} end - End boundary
 * @returns {{ isTable: boolean, delimiterStart: number, delimiterEnd: number, columnCount: number, alignments: number[] }}
 */
export function checkTableStart(input, start, end) {
  // Find end of current line
  let lineEnd = start;
  while (lineEnd < end && input.charCodeAt(lineEnd) !== 10 && input.charCodeAt(lineEnd) !== 0) {
    lineEnd++;
  }
  
  // Check if current line has at least one pipe
  let hasPipe = false;
  let escaped = false;
  for (let i = start; i < lineEnd; i++) {
    const ch = input.charCodeAt(i);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === 92) { // backslash
      escaped = true;
      continue;
    }
    if (ch === 124) { // |
      hasPipe = true;
      break;
    }
  }
  
  if (!hasPipe) {
    return { isTable: false, delimiterStart: 0, delimiterEnd: 0, columnCount: 0, alignments: [] };
  }
  
  // Skip newline
  let nextLineStart = lineEnd;
  if (nextLineStart < end && input.charCodeAt(nextLineStart) === 10) {
    nextLineStart++;
  }
  
  // Find end of next line
  let nextLineEnd = nextLineStart;
  while (nextLineEnd < end && input.charCodeAt(nextLineEnd) !== 10 && input.charCodeAt(nextLineEnd) !== 0) {
    nextLineEnd++;
  }
  
  // Check if next line is a valid delimiter row
  const delimiterCheck = checkTableDelimiterRow(input, nextLineStart, nextLineEnd);
  
  if (!delimiterCheck.isValid) {
    return { isTable: false, delimiterStart: 0, delimiterEnd: 0, columnCount: 0, alignments: [] };
  }
  
  return {
    isTable: true,
    delimiterStart: nextLineStart,
    delimiterEnd: nextLineEnd,
    columnCount: delimiterCheck.columnCount,
    alignments: delimiterCheck.alignments
  };
}
