// @ts-check

import { TablePipe, TableDelimiterCell } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan table pipe separator: |
 * 
 * GFM Tables Extension:
 * Tables consist of a header row, delimiter row, and zero or more data rows.
 * Columns are separated by pipe | characters.
 * 
 * This scanner handles pipe characters. The pipes are used to delimit table cells.
 * 
 * Rules:
 * - Pipe characters separate table cells
 * - Spaces around pipes are allowed and trimmed
 * 
 * Token encoding (31 bits):
 * - Bits 0-15: Length (always 1 for pipe character)
 * - Bits 16-25: Token type (TablePipe)
 * - Bits 26-31: Reserved for flags
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
  
  // Must be |
  if (char !== 124) return 0;
  
  // Token length is just the pipe character (1 byte)
  const length = 1;
  
  output.push(length | TablePipe);
  
  return length;
}

/**
 * Check if a line is a valid table delimiter row.
 * A delimiter row consists of cells with hyphens, optional colons for alignment,
 * and pipes separating the cells.
 * 
 * Format: | :--- | :---: | ---: |
 * - Each cell must contain at least three hyphens
 * - Leading colon = left align or center
 * - Trailing colon = right align or center
 * - Both colons = center align
 * - Spaces are allowed around hyphens and colons
 * 
 * @param {string} input - The input text
 * @param {number} lineStart - Start of the line
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, cellCount: number, alignments: number[] }} Result object
 */
export function checkTableDelimiterRow(input, lineStart, end) {
  let pos = lineStart;
  const alignments = [];
  
  // Skip leading whitespace (up to 3 spaces)
  const lineIndent = countIndentation(input, lineStart, end);
  if (lineIndent > 3) {
    return { isValid: false, cellCount: 0, alignments: [] };
  }
  pos += lineIndent;
  
  // Skip optional leading pipe
  if (pos < end && input.charCodeAt(pos) === 124 /* | */) {
    pos++;
  }
  
  let cellCount = 0;
  
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    
    // End of line
    if (ch === 10 /* \n */ || ch === 13 /* \r */ || ch === 0) {
      break;
    }
    
    // Skip spaces before cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    if (pos >= end) break;
    
    // Check for cell content (hyphens and colons)
    let leftAlign = false;
    let rightAlign = false;
    let hyphenCount = 0;
    
    // Check for leading colon
    if (input.charCodeAt(pos) === 58 /* : */) {
      leftAlign = true;
      pos++;
    }
    
    // Skip spaces after leading colon
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    // Count hyphens
    while (pos < end && input.charCodeAt(pos) === 45 /* - */) {
      hyphenCount++;
      pos++;
    }
    
    // Need at least 3 hyphens
    if (hyphenCount < 3) {
      return { isValid: false, cellCount: 0, alignments: [] };
    }
    
    // Skip spaces before trailing colon
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    // Check for trailing colon
    if (pos < end && input.charCodeAt(pos) === 58 /* : */) {
      rightAlign = true;
      pos++;
    }
    
    // Determine alignment: 0=left, 1=center, 2=right
    let alignment = 0; // left (default)
    if (leftAlign && rightAlign) {
      alignment = 1; // center
    } else if (rightAlign) {
      alignment = 2; // right
    }
    
    alignments.push(alignment);
    cellCount++;
    
    // Skip trailing spaces in cell
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    // Check for pipe or end of line
    if (pos >= end) break;
    
    const next = input.charCodeAt(pos);
    if (next === 10 /* \n */ || next === 13 /* \r */ || next === 0) {
      break;
    } else if (next === 124 /* | */) {
      pos++; // Skip pipe
    } else {
      // Invalid character in delimiter row
      return { isValid: false, cellCount: 0, alignments: [] };
    }
  }
  
  // Must have at least one cell
  if (cellCount === 0) {
    return { isValid: false, cellCount: 0, alignments: [] };
  }
  
  return { isValid: true, cellCount, alignments };
}

/**
 * Scan table delimiter cell content starting with : or -.
 * A delimiter cell contains at least 3 hyphens with optional leading/trailing colons.
 * 
 * This scanner is called when we encounter a : or - that might be part of a delimiter cell.
 * It checks if the pattern matches a table delimiter cell and emits the appropriate token.
 * 
 * Format patterns:
 * - :---  (left align with leading colon)
 * - :---: (center align with both colons)
 * - ---:  (right align with trailing colon)
 * - ---   (left align, default, no colons)
 * 
 * Token encoding (31 bits):
 * - Bits 0-15: Length (cell content including hyphens, colons, and spaces)
 * - Bits 16-25: Token type (TableDelimiterCell)
 * - Bits 26-27: Alignment (0=left, 1=center, 2=right)
 * - Bits 28-31: Reserved for flags
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first : or -)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a table delimiter cell
 */
export function scanTableDelimiterCell(input, start, end, output) {
  if (start >= end) return 0;
  
  let pos = start;
  let leftAlign = false;
  let rightAlign = false;
  let hyphenCount = 0;
  
  // Check for leading colon
  if (input.charCodeAt(pos) === 58 /* : */) {
    leftAlign = true;
    pos++;
  }
  
  // Skip spaces after leading colon
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Count hyphens
  const hyphenStart = pos;
  while (pos < end && input.charCodeAt(pos) === 45 /* - */) {
    hyphenCount++;
    pos++;
  }
  
  // Need at least 3 hyphens
  if (hyphenCount < 3) {
    return 0;
  }
  
  // Skip spaces before trailing colon
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Check for trailing colon
  if (pos < end && input.charCodeAt(pos) === 58 /* : */) {
    rightAlign = true;
    pos++;
  }
  
  // The delimiter cell must be followed by a pipe, whitespace, or end of line
  // Check what comes next
  if (pos < end) {
    const next = input.charCodeAt(pos);
    // Only valid if followed by whitespace, pipe, or newline
    if (next !== 32 && next !== 9 && next !== 124 && next !== 10 && next !== 13 && next !== 0) {
      return 0;
    }
  }
  
  const length = pos - start;
  
  // Determine alignment: 0=left, 1=center, 2=right
  let alignment = 0; // left (default)
  if (leftAlign && rightAlign) {
    alignment = 1; // center
  } else if (rightAlign) {
    alignment = 2; // right
  }
  
  // Encode alignment in bits 26-27
  const alignmentBits = (alignment & 0x3) << 26;
  
  output.push(length | TableDelimiterCell | alignmentBits);
  
  return length;
}

/**
 * Extract alignment from a TableDelimiterCell token
 * @param {number} token - The token
 * @returns {number} Alignment (0=left, 1=center, 2=right)
 */
export function getTableCellAlignment(token) {
  return (token >> 26) & 0x3;
}
