// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
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

  // Emit opening token
  output.push(4 | HTMLCommentOpen);

  let offset = start + 4;
  const contentStart = offset;
  let foundNewlineWithoutClose = false;

  // Scan for '-->' or use restorative strategy
  while (offset < end) {
    const ch = input.charCodeAt(offset);

    // Check for closing sequence '-->'
    if (ch === 45 /* - */ && offset + 2 < end &&
        input.charCodeAt(offset + 1) === 45 /* - */ &&
        input.charCodeAt(offset + 2) === 62 /* > */) {
      // Found proper close
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCommentContent);
      }
      output.push(3 | HTMLCommentClose);
      return offset - start + 3;
    }

    // Restorative strategy: look for '<' on new line as breakpoint
    if (ch === 10 || ch === 13) {
      foundNewlineWithoutClose = true;
      offset++;
      
      // Skip any additional newline characters (handle \r\n)
      while (offset < end) {
        const nlCh = input.charCodeAt(offset);
        if (nlCh === 10 || nlCh === 13) {
          offset++;
        } else {
          break;
        }
      }

      // Check if next non-whitespace character is '<'
      let tempOffset = offset;
      while (tempOffset < end) {
        const wsCh = input.charCodeAt(tempOffset);
        if (wsCh === 9 || wsCh === 32) {
          tempOffset++;
        } else {
          break;
        }
      }

      if (tempOffset < end && input.charCodeAt(tempOffset) === 60 /* < */) {
        // Found '<' on new line - close comment here
        const contentLength = offset - contentStart;
        if (contentLength > 0) {
          output.push(contentLength | HTMLCommentContent | ErrorUnbalancedTokenFallback);
        }
        // Don't emit zero-length close token
        return offset - start;
      }
      
      continue;
    }

    offset++;
  }

  // EOF without finding proper close
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCommentContent | ErrorUnbalancedTokenFallback);
  }
  // Don't emit zero-length close token
  return offset - start;
}
