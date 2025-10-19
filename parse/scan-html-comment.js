// @ts-check

import { ErrorUnbalancedToken } from './scan-token-flags.js';
import { HTMLCommentClose, HTMLCommentContent, HTMLCommentOpen } from './scan-tokens.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan HTML comment.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLComment(input, start, end, output) {
  // Must start with '<!--'
  if (start + 4 > end) return 0;
  if (input.charCodeAt(start) !== 60 /* < */ ||
      input.charCodeAt(start + 1) !== 33 /* ! */ ||
      input.charCodeAt(start + 2) !== 45 /* - */ ||
      input.charCodeAt(start + 3) !== 45 /* - */) {
    return 0;
  }

  const openTokenIndex = output.length;
  output.push(4 | HTMLCommentOpen);

  let offset = start + 4;
  const contentStart = offset;

  // Scan for a valid closing sequence '-->'
  while (offset < end) {
    if (input.charCodeAt(offset) === 45 && offset + 2 < end && input.charCodeAt(offset + 1) === 45 && input.charCodeAt(offset + 2) === 62) {
      // Found '-->', so the comment is well-formed.
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCommentContent);
      }
      output.push(3 | HTMLCommentClose);
      return offset - start + 3;
    }
    offset++;
  }

  // If we reach here, '-->' was not found. This is an unclosed comment.
  output[openTokenIndex] |= ErrorUnbalancedToken;

  // Apply recovery rules as per spec: double-newline or '<' on a new line.
  let recoveryEnd = end;

  let i = contentStart;
  while (i < end) {
    const ch = input.charCodeAt(i);

    if (ch === 10 /* LF */ || ch === 13 /* CR */) {
      const newlineStart = i;
      if (ch === 13 && i + 1 < end && input.charCodeAt(i + 1) === 10) {
        i++; // Consume LF in CRLF
      }
      
      // Check for double newline
      let nextNonWhitespace = i + 1;
      while (nextNonWhitespace < end) {
        const nextCh = input.charCodeAt(nextNonWhitespace);
        if (nextCh === 10 || nextCh === 13) { // Found a second newline
          recoveryEnd = newlineStart;
          i = end; // Break outer loop
          break;
        }
        if (nextCh !== 32 && nextCh !== 9) { // Not whitespace
          break;
        }
        nextNonWhitespace++;
      }
      if (i === end) break;
    } else if (ch === 60 /* < */) {
      // Check if '<' is on a new line
      let lineStart = -1;
      // Find the start of the current line
      for (let j = i - 1; j >= contentStart -1; j--) {
        if (j < contentStart) { // Beginning of comment content
          lineStart = contentStart;
          break;
        }
        const prevCh = input.charCodeAt(j);
        if (prevCh === 10 || prevCh === 13) {
          lineStart = j + 1;
          break;
        }
      }
      
      if (lineStart !== -1) {
        let isWhitespaceOnly = true;
        for (let j = lineStart; j < i; j++) {
          if (input.charCodeAt(j) !== 32 && input.charCodeAt(j) !== 9) {
            isWhitespaceOnly = false;
            break;
          }
        }
        if (isWhitespaceOnly) {
          recoveryEnd = i;
          break;
        }
      }
    }
    i++;
  }
  
  const contentLength = recoveryEnd - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCommentContent | ErrorUnbalancedToken);
  }

  return recoveryEnd - start;
}
