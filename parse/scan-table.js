// @ts-check

import { countIndentation, findLineStart } from './scan-core.js';
import { TablePipe, TableDelimiterCell, Whitespace } from './scan-tokens.js';
import { AlignNone, AlignLeft, AlignCenter, AlignRight } from './scan-token-flags.js';

/**
 * Check if a line is a valid table delimiter row.
 * 
 * GFM Table Delimiter Row Rules:
 * - Must contain at least one pipe character (|)
 * - Each cell must contain at least three hyphens (-), optionally with colons for alignment
 * - Leading/trailing whitespace is allowed
 * - Leading/trailing pipes are optional
 * - Alignment: :--- (left), :---: (center), ---: (right)
 * 
 * @param {string} input - The input text
 * @param {number} start - Start of the line to check
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, cells: Array<{ start: number, length: number, align: 'left'|'center'|'right'|'none' }> }} Result object
 */
export function checkTableDelimiterRow(input, start, end) {
  if (start >= end) {
    return { isValid: false, cells: [] };
  }

  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  
  // Tables cannot be indented more than 3 spaces (would be code block)
  if (lineIndent > 3) {
    return { isValid: false, cells: [] };
  }

  // Must be at first non-whitespace position
  if (lineStart + lineIndent !== start) {
    return { isValid: false, cells: [] };
  }

  let pos = start;
  let hasPipe = false;
  const cells = [];

  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }

  // Skip optional leading pipe
  if (pos < end && input.charCodeAt(pos) === 124 /* | */) {
    hasPipe = true;
    pos++;
  }

  // Parse delimiter cells
  while (pos < end) {
    // Skip whitespace before cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }

    // Check for newline (end of line)
    const ch = pos < end ? input.charCodeAt(pos) : 0;
    if (ch === 10 /* \n */ || ch === 13 /* \r */ || ch === 0) {
      break;
    }

    // Parse a delimiter cell
    const cellStart = pos;
    let leftColon = false;
    let rightColon = false;
    let hyphenCount = 0;

    // Check for leading colon
    if (pos < end && input.charCodeAt(pos) === 58 /* : */) {
      leftColon = true;
      pos++;
    }

    // Count hyphens
    while (pos < end && input.charCodeAt(pos) === 45 /* - */) {
      hyphenCount++;
      pos++;
    }

    // Check for trailing colon
    if (pos < end && input.charCodeAt(pos) === 58 /* : */) {
      rightColon = true;
      pos++;
    }

    // Must have at least 3 hyphens
    if (hyphenCount < 3) {
      return { isValid: false, cells: [] };
    }

    const cellLength = pos - cellStart;
    
    // Determine alignment
    let align = 'none';
    if (leftColon && rightColon) {
      align = 'center';
    } else if (leftColon) {
      align = 'left';
    } else if (rightColon) {
      align = 'right';
    }

    cells.push({ start: cellStart, length: cellLength, align });

    // Skip trailing whitespace
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }

    // Check for pipe separator or end of line
    if (pos < end) {
      const nextCh = input.charCodeAt(pos);
      if (nextCh === 124 /* | */) {
        hasPipe = true;
        pos++;
      } else if (nextCh !== 10 && nextCh !== 13) {
        // Invalid character - not a delimiter row
        return { isValid: false, cells: [] };
      }
    }
  }

  // Must have at least one pipe and at least one cell
  if (!hasPipe || cells.length === 0) {
    return { isValid: false, cells: [] };
  }

  return { isValid: true, cells };
}

/**
 * Scan a table delimiter row and emit tokens.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first character)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a table delimiter row
 */
export function scanTableDelimiterRow(input, start, end, output) {
  const result = checkTableDelimiterRow(input, start, end);
  
  if (!result.isValid) {
    return 0;
  }

  let pos = start;
  let cellIndex = 0;
  
  // Skip leading whitespace (not emitted - part of line indentation)
  const wsStart = pos;
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  const leadingWsLength = pos - wsStart;

  // Handle optional leading pipe
  if (pos < end && input.charCodeAt(pos) === 124 /* | */) {
    output.push(1 | TablePipe);
    pos++;
    
    // Emit whitespace after pipe if any
    const wsAfterPipe = pos;
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    if (pos > wsAfterPipe) {
      output.push((pos - wsAfterPipe) | Whitespace);
    }
  }

  // Process cells
  while (cellIndex < result.cells.length) {
    const cell = result.cells[cellIndex];
    
    // We should be at the cell start now
    if (pos !== cell.start) {
      // Something went wrong with position tracking
      return 0;
    }

    // Emit the delimiter cell token with alignment flags
    let alignFlag = AlignNone;
    if (cell.align === 'left') alignFlag = AlignLeft;
    else if (cell.align === 'center') alignFlag = AlignCenter;
    else if (cell.align === 'right') alignFlag = AlignRight;
    
    output.push(cell.length | TableDelimiterCell | alignFlag);
    pos += cell.length;

    // Emit whitespace after cell if any
    const wsAfterCell = pos;
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    if (pos > wsAfterCell) {
      output.push((pos - wsAfterCell) | Whitespace);
    }

    // Handle pipe separator (if not at end of line)
    if (pos < end && input.charCodeAt(pos) === 124 /* | */) {
      output.push(1 | TablePipe);
      pos++;
      
      // Emit whitespace after pipe if any (for next iteration)
      const wsAfterNextPipe = pos;
      while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
        pos++;
      }
      if (pos > wsAfterNextPipe) {
        output.push((pos - wsAfterNextPipe) | Whitespace);
      }
    }

    cellIndex++;
  }

  return pos - start + leadingWsLength;
}

/**
 * Get alignment from a TableDelimiterCell token
 * @param {number} token - The token
 * @returns {'none'|'left'|'center'|'right'} Alignment
 */
export function getTableCellAlignment(token) {
  const alignBits = token & 0x1C000000; // Extract bits 26-28
  if (alignBits === AlignLeft) return 'left';
  if (alignBits === AlignCenter) return 'center';
  if (alignBits === AlignRight) return 'right';
  return 'none';
}
