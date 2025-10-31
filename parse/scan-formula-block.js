// @ts-check

import { FormulaBlockOpen, FormulaBlockContent, FormulaBlockClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * A simple, always-forward scanner for formula blocks (display math).
 * It scans from the opener forward one time, captures the content span and
 * detects a valid closing delimiter. If no closer is found before `endOffset`,
 * it returns an unbalanced result similar to the fenced code block scanner.
 *
 * Formula blocks use $$ delimiters (minimum 2 dollar signs).
 *
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset  index where input[startOffset] is dollar sign
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
export function scanFormulaBlock(input, startOffset, endOffset, output) {
  if (startOffset >= endOffset) return 0;

  const fenceChar = input.charCodeAt(startOffset);
  if (fenceChar !== 36 /* $ */) return 0;

  // Verify line-start context allowing up to 3 leading spaces.
  const lineStart = findLineStart(input, startOffset);
  const leadingSpaces = startOffset - lineStart;
  if (leadingSpaces > 3) return 0;

  // Count opening run length
  let pos = startOffset;
  let openLen = 0;
  while (pos < endOffset && input.charCodeAt(pos) === fenceChar) {
    openLen++;
    pos++;
  }

  if (openLen < 2) return 0; // not a formula block opener (minimum 2 dollar signs)

  // Formula blocks don't have info strings like code fences
  // Content starts immediately after the opener (possibly on the same line or next line)
  // If there's content on the same line as opener, we include it
  // Most commonly, $$ is on its own line and content starts on next line

  // Find the end of the opener line
  let contentStart = pos;
  while (contentStart < endOffset) {
    const ch = input.charCodeAt(contentStart);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Move past the newline
      if (ch === 13 /* \r */ && contentStart + 1 < endOffset && input.charCodeAt(contentStart + 1) === 10 /* \n */) {
        contentStart += 2;
      } else {
        contentStart += 1;
      }
      break;
    }
    contentStart++;
  }

  // Now scan forward line-by-line looking for a valid closing delimiter
  let p = contentStart;
  let newlinePos = pos - 1; // Initialize to position before opener (will be updated as we scan)
  
  while (p < endOffset) {
    // Now at the start of a line; skip up to 3 leading spaces
    let linePos = p;
    let spaceCount = 0;
    while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
      spaceCount++;
      linePos++;
    }

    // If we find a run of dollar signs here, count it
    if (linePos < endOffset && input.charCodeAt(linePos) === fenceChar) {
      let closeLen = 0;
      let fencePos = linePos;
      while (fencePos < endOffset && input.charCodeAt(fencePos) === fenceChar) {
        closeLen++;
        fencePos++;
      }

      if (closeLen >= openLen) {
        // Ensure rest of line is only whitespace
        let validCloser = true;
        let checkPos = fencePos;
        while (checkPos < endOffset) {
          const nextCh = input.charCodeAt(checkPos);
          if (nextCh === 10 /* \n */ || nextCh === 13 /* \r */) break;
          if (nextCh !== 32 /* space */ && nextCh !== 9 /* \t */) {
            validCloser = false;
            break;
          }
          checkPos++;
        }

        if (validCloser) {
          // Valid closer found
          // Compute token lengths
          const openTokenLen = contentStart - startOffset;
          // content length: from contentStart to start of this line (before leading spaces)
          const contentLength = p - contentStart;

          // determine end of closing line (include newline if present)
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

    // Find the next newline to advance to the next line
    while (p < endOffset) {
      const ch = input.charCodeAt(p);
      if (ch === 10 /* \n */ || ch === 13 /* \r */) {
        newlinePos = p;
        // advance p to the start of the next line (handle CRLF)
        if (ch === 13 /* \r */ && p + 1 < endOffset && input.charCodeAt(p + 1) === 10 /* \n */) {
          p += 2;
        } else {
          p += 1;
        }
        break;
      }
      p++;
    }
    
    if (p >= endOffset) break; // no more lines to test
  }

  // No closing delimiter found before EOF: fallback to unbalanced behavior
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
  // scan backwards until previous CR or LF or start
  while (pos > 0) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) return pos;
    pos--;
  }
  return 0;
}
