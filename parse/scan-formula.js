// @ts-check

import { FormulaOpen, FormulaContent, FormulaClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * A simple, always-forward scanner for formula blocks (display math).
 * Formula blocks are delimited by `$$` (or longer runs of dollar signs).
 * It scans from the opener forward one time, captures the content span and
 * detects a valid closing delimiter. If no closer is found before `endOffset`,
 * it returns an unbalanced result (emit opener with ErrorUnbalancedToken
 * and content up to EOF).
 *
 * This implementation follows the same pattern as scan-fences.js: advance
 * indices only, avoid allocations, and never re-scan the same region twice.
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

  const dollarChar = 36; // '$'
  if (input.charCodeAt(startOffset) !== dollarChar) return 0;

  // Verify line-start context allowing up to 3 leading spaces.
  const lineStart = findLineStart(input, startOffset);
  const leadingSpaces = startOffset - lineStart;
  if (leadingSpaces > 3) return 0;

  // Count opening run length
  let pos = startOffset;
  let openLen = 0;
  while (pos < endOffset && input.charCodeAt(pos) === dollarChar) {
    openLen++;
    pos++;
  }

  if (openLen < 2) return 0; // not a formula block opener (single $ is inline math)

  // Formula blocks don't have an info string like code fences.
  // Content starts immediately after the opening delimiter.
  // If there's a newline right after opener, content starts after it.
  let contentStart = pos;
  if (pos < endOffset) {
    const ch = input.charCodeAt(pos);
    if (ch === 13 /* \r */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 10 /* \n */) {
      contentStart = pos + 2;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      contentStart = pos + 1;
    }
  }

  // Scan forward line-by-line looking for a valid closing delimiter.
  // A valid closer is a run of dollar signs with length >= openLen,
  // appearing at the start of a line (allowing up to 3 leading spaces).
  let p = pos;
  while (p < endOffset) {
    let newlinePos = -1;
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

    if (p >= endOffset) break; // no more full lines to test

    // Now at the start of a line; skip up to 3 leading spaces
    let linePos = p;
    let spaceCount = 0;
    while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
      spaceCount++;
      linePos++;
    }

    // If we find a run of dollar signs here, count it
    if (linePos < endOffset && input.charCodeAt(linePos) === dollarChar) {
      let closeLen = 0;
      let dollarPos = linePos;
      while (dollarPos < endOffset && input.charCodeAt(dollarPos) === dollarChar) {
        closeLen++;
        dollarPos++;
      }

      if (closeLen >= openLen) {
        // Ensure rest of line is only whitespace or end of line
        let validCloser = true;
        let checkPos = dollarPos;
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
          // compute token lengths
          // open token spans from startOffset to contentStart
          const openTokenLen = contentStart - startOffset;
          // content length: up to the newline that precedes the closing delimiter
          const contentLength = newlinePos + 1 - contentStart;

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

          output.push(FormulaOpen | openTokenLen);
          output.push(FormulaContent | contentLength);
          output.push(FormulaClose | closeTokenLen);
          return closeLineEnd - startOffset;
        }
      }
    }
  }

  // No closing delimiter found before EOF: fallback to unbalanced behaviour.
  const openTokenLen = contentStart - startOffset;
  const contentLength = endOffset - contentStart;
  output.push(FormulaOpen | ErrorUnbalancedToken | openTokenLen);
  output.push(FormulaContent | ErrorUnbalancedToken | contentLength);
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
