// @ts-check

import { TableDelimiterRow, TablePipe } from './scan-tokens.js';
import { countIndentation, findLineStart } from './scan-core.js';

/**
 * Scan for GFM table delimiter row.
 * 
 * A valid delimiter row consists of:
 * - Pipes (|) separating columns
 * - At least one dash (-) per column
 * - Optional colons (:) for alignment
 * - Optional whitespace
 * - Leading/trailing pipes are optional
 * 
 * Examples:
 * - | --- | --- |
 * - :--- | :---: | ---:
 * - --- | ---
 * 
 * Alignment:
 * - :--- or --- = left (default)
 * - :---: = center
 * - ---: = right
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (should be at start of line or after indentation)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a valid delimiter row
 */
export function scanTableDelimiterRow(input, start, end, output) {
  if (start >= end) return 0;
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;
  
  // Must be first non-whitespace character on line
  if (lineStart + lineIndent !== start) return 0;
  
  const ch = input.charCodeAt(start);
  
  // Quick check: must start with pipe, dash, or colon
  if (ch !== 124 /* | */ && ch !== 45 /* - */ && ch !== 58 /* : */) {
    return 0;
  }
  
  // Parse the entire line to check if it's a valid delimiter row
  let pos = start;
  let columnCount = 0;
  let hasAnyPipe = false;
  let foundAnyDash = false;
  let inColumn = false;
  let currentColumnHasDash = false;
  
  // Parse columns
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    
    // Stop at newline
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      break;
    }
    
    // Skip whitespace
    if (ch === 32 || ch === 9) {
      pos++;
      continue;
    }
    
    // Parse column separator (pipe)
    if (ch === 124 /* | */) {
      hasAnyPipe = true;
      if (inColumn) {
        // End of current column
        if (!currentColumnHasDash) {
          // Column without dashes is invalid
          return 0;
        }
        columnCount++;
        inColumn = false;
        currentColumnHasDash = false;
      }
      pos++;
      continue;
    }
    
    // Parse column content (dash or colon)
    if (ch === 45 /* - */ || ch === 58 /* : */) {
      if (!inColumn) {
        inColumn = true;
        currentColumnHasDash = false;
      }
      
      if (ch === 45) {
        currentColumnHasDash = true;
        foundAnyDash = true;
      }
      
      pos++;
      continue;
    }
    
    // Invalid character for delimiter row
    return 0;
  }
  
  // Handle last column if we ended in one
  if (inColumn) {
    if (!currentColumnHasDash) {
      return 0;
    }
    columnCount++;
  }
  
  // Must have at least one dash, at least one pipe, and at least one column
  // A table delimiter MUST contain at least one pipe character
  if (!foundAnyDash || !hasAnyPipe || columnCount === 0) {
    return 0;
  }
  
  const length = pos - start;
  
  // Encode column count in bits 26-31 (6 bits = up to 63 columns)
  const columnBits = (Math.min(columnCount, 63) & 0x3F) << 26;
  
  output.push(length | TableDelimiterRow | columnBits);
  
  return length;
}

/**
 * Check if a line looks like it could be a table delimiter row (quick check).
 * This is a fast pre-check before calling the full scanner.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {boolean} True if line might be a delimiter row
 */
export function couldBeTableDelimiterRow(input, start, end) {
  let hasPipe = false;
  let hasDash = false;
  
  for (let i = start; i < end; i++) {
    const ch = input.charCodeAt(i);
    if (ch === 10 || ch === 13) break;
    if (ch === 124 /* | */) hasPipe = true;
    if (ch === 45 /* - */) hasDash = true;
    // Quick reject if we see invalid characters
    if (ch !== 32 && ch !== 9 && ch !== 124 && ch !== 45 && ch !== 58) {
      return false;
    }
  }
  
  return hasPipe && hasDash;
}

/**
 * Extract column count from TableDelimiterRow token
 * @param {number} token - The token
 * @returns {number} Number of columns
 */
export function getTableColumnCount(token) {
  return (token >> 26) & 0x3F;
}

/**
 * Scan for table pipe delimiter (|) in table context.
 * This is called when scanning table rows to mark pipe positions.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of |)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed (always 1 for pipe)
 */
export function scanTablePipe(input, start, end, output) {
  if (start >= end) return 0;
  
  const ch = input.charCodeAt(start);
  if (ch !== 124 /* | */) return 0;
  
  output.push(1 | TablePipe);
  return 1;
}
