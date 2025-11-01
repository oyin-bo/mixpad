// @ts-check

import { FormulaBlockOpen, FormulaBlockContent, FormulaBlockClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * Scanner for formula/math blocks delimited by double dollar signs ($$).
 * 
 * Formula blocks can be:
 * - Block mode: $$ on separate lines with content between them
 * - Display mode: $$content$$ all on one line
 * 
 * This scanner follows the same allocation-sparing pattern as scan-fences.js:
 * advance indices only, avoid allocations, never re-scan the same region twice.
 * 
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset  index where input[startOffset] is $ (dollar sign)
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
export function scanFormulaBlock(input, startOffset, endOffset, output) {
  if (startOffset >= endOffset) return 0;

  // Must start with exactly two dollar signs
  if (input.charCodeAt(startOffset) !== 36 /* $ */) return 0;
  if (startOffset + 1 >= endOffset || input.charCodeAt(startOffset + 1) !== 36 /* $ */) return 0;

  // Verify line-start context allowing up to 3 leading spaces
  const lineStart = findLineStart(input, startOffset);
  const leadingSpaces = startOffset - lineStart;
  if (leadingSpaces > 3) return 0;

  // We have a valid $$ opener at position startOffset
  let pos = startOffset + 2; // position after $$

  // Determine if this is block mode or display mode
  // Block mode: $$ followed by newline
  // Display mode: $$ followed by non-newline content on same line
  
  let isBlockMode = false;
  if (pos < endOffset) {
    const ch = input.charCodeAt(pos);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      isBlockMode = true;
    }
  } else {
    // $$ at EOF with no content — treat as block mode (unclosed)
    isBlockMode = true;
  }

  if (isBlockMode) {
    return scanBlockFormula(input, startOffset, endOffset, output, pos);
  } else {
    return scanDisplayFormula(input, startOffset, endOffset, output, pos);
  }
}

/**
 * Scan block-mode formula where opener and closer are on separate lines
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} afterOpener position after the opening $$
 * @returns {number}
 */
function scanBlockFormula(input, startOffset, endOffset, output, afterOpener) {
  // Skip the newline after the opener
  let contentStart = afterOpener;
  if (contentStart < endOffset) {
    const ch = input.charCodeAt(contentStart);
    if (ch === 13 /* \r */ && contentStart + 1 < endOffset && input.charCodeAt(contentStart + 1) === 10 /* \n */) {
      contentStart += 2; // CRLF
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      contentStart += 1; // LF or CR
    }
  }

  // Scan forward line-by-line looking for closing $$
  // First check if contentStart itself is at a valid closing position
  // (handles empty formula blocks where closer is on the next line after opener)
  let pos = contentStart;
  let spaceCount = 0;
  while (pos < endOffset && input.charCodeAt(pos) === 32 /* space */ && spaceCount < 3) {
    spaceCount++;
    pos++;
  }
  
  if (pos + 1 < endOffset && 
      input.charCodeAt(pos) === 36 /* $ */ && 
      input.charCodeAt(pos + 1) === 36 /* $ */) {
    // Check if rest of line is whitespace
    let validCloser = true;
    let checkPos = pos + 2;
    while (checkPos < endOffset) {
      const ch = input.charCodeAt(checkPos);
      if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
      if (ch !== 32 /* space */ && ch !== 9 /* \t */) {
        validCloser = false;
        break;
      }
      checkPos++;
    }
    
    if (validCloser) {
      // Found valid closer immediately at contentStart (empty content)
      const openTokenLen = contentStart - startOffset;
      const contentLength = 0; // Empty content
      
      let closeLineEnd = checkPos;
      if (checkPos < endOffset) {
        const nc = input.charCodeAt(checkPos);
        if (nc === 13 /* \r */ && checkPos + 1 < endOffset && input.charCodeAt(checkPos + 1) === 10 /* \n */) {
          closeLineEnd = checkPos + 2;
        } else if (nc === 10 /* \n */ || nc === 13 /* \r */) {
          closeLineEnd = checkPos + 1;
        }
      }
      const closeTokenLen = closeLineEnd - pos;
      
      output.push(FormulaBlockOpen | openTokenLen);
      // No content token for empty formulas
      output.push(FormulaBlockClose | closeTokenLen);
      return closeLineEnd - startOffset;
    }
  }
  
  // Not at a closer yet, scan forward line-by-line
  pos = contentStart;
  while (pos < endOffset) {
    // Find the next newline
    let newlinePos = -1;
    while (pos < endOffset) {
      const ch = input.charCodeAt(pos);
      if (ch === 10 /* \n */ || ch === 13 /* \r */) {
        newlinePos = pos;
        // Advance to start of next line
        if (ch === 13 /* \r */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 10 /* \n */) {
          pos += 2; // CRLF
        } else {
          pos += 1; // LF or CR
        }
        break;
      }
      pos++;
    }

    if (pos >= endOffset) break; // No more lines to check

    // Now at the start of a line; skip up to 3 leading spaces
    let linePos = pos;
    spaceCount = 0;
    while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
      spaceCount++;
      linePos++;
    }

    // Check if we have $$ at this position
    if (linePos + 1 < endOffset && 
        input.charCodeAt(linePos) === 36 /* $ */ && 
        input.charCodeAt(linePos + 1) === 36 /* $ */) {
      
      // Verify rest of line is whitespace or end
      let validCloser = true;
      let checkPos = linePos + 2;
      while (checkPos < endOffset) {
        const ch = input.charCodeAt(checkPos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
        if (ch !== 32 /* space */ && ch !== 9 /* \t */) {
          validCloser = false;
          break;
        }
        checkPos++;
      }

      if (validCloser) {
        // Found valid closer
        // Open token spans from start to beginning of content (includes newline after $$)
        const openTokenLen = contentStart - startOffset;
        const contentLength = newlinePos + 1 - contentStart;
        
        // Determine end of closing line (include newline if present)
        let closeLineEnd = checkPos;
        if (checkPos < endOffset) {
          const nc = input.charCodeAt(checkPos);
          if (nc === 13 /* \r */ && checkPos + 1 < endOffset && input.charCodeAt(checkPos + 1) === 10 /* \n */) {
            closeLineEnd = checkPos + 2;
          } else if (nc === 10 /* \n */ || nc === 13 /* \r */) {
            closeLineEnd = checkPos + 1;
          }
        }
        const closeTokenLen = closeLineEnd - linePos;

        output.push(FormulaBlockOpen | openTokenLen);
        if (contentLength > 0) output.push(FormulaBlockContent | contentLength);
        output.push(FormulaBlockClose | closeTokenLen);
        return closeLineEnd - startOffset;
      }
    }
  }

  // No closing $$ found — unbalanced
  const openLen = contentStart - startOffset;
  const contentLength = endOffset - contentStart;
  output.push(FormulaBlockOpen | ErrorUnbalancedToken | openLen);
  if (contentLength > 0) output.push(FormulaBlockContent | ErrorUnbalancedToken | contentLength);
  return endOffset - startOffset;
}

/**
 * Scan display-mode formula where everything is on one line: $$content$$
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} afterOpener position after the opening $$
 * @returns {number}
 */
function scanDisplayFormula(input, startOffset, endOffset, output, afterOpener) {
  // Content starts immediately after opening $$
  const contentStart = afterOpener;
  
  // Scan forward on same line looking for closing $$
  let pos = contentStart;
  while (pos < endOffset) {
    const ch = input.charCodeAt(pos);
    
    // If we hit a newline, this is malformed display math (unbalanced)
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Unbalanced — treat content up to newline as content
      const openLen = 2; // always 2 for $$
      const contentLength = pos - contentStart;
      output.push(FormulaBlockOpen | ErrorUnbalancedToken | openLen);
      if (contentLength > 0) output.push(FormulaBlockContent | ErrorUnbalancedToken | contentLength);
      return pos - startOffset;
    }
    
    // Check for closing $$
    if (ch === 36 /* $ */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 36 /* $ */) {
      // Found closing $$
      const openLen = 2;
      const contentLength = pos - contentStart;
      const closeLen = 2;
      
      output.push(FormulaBlockOpen | openLen);
      if (contentLength > 0) output.push(FormulaBlockContent | contentLength);
      output.push(FormulaBlockClose | closeLen);
      return (pos + 2) - startOffset;
    }
    
    pos++;
  }
  
  // Reached EOF without finding closer — unbalanced
  const openLen = 2;
  const contentLength = endOffset - contentStart;
  output.push(FormulaBlockOpen | ErrorUnbalancedToken | openLen);
  if (contentLength > 0) output.push(FormulaBlockContent | ErrorUnbalancedToken | contentLength);
  return endOffset - startOffset;
}

/**
 * Find the start of the current line (scan backwards to previous newline or start of input)
 * @param {string} input
 * @param {number} pos
 * @returns {number} position of line start
 */
function findLineStart(input, pos) {
  while (pos > 0) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) return pos;
    pos--;
  }
  return 0;
}
