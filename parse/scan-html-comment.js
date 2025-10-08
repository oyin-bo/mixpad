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

  // Scan for '-->'
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

    offset++;
  }

  // EOF without finding proper close - error recovery
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCommentContent | ErrorUnbalancedTokenFallback);
  }
  // Don't emit zero-length close token
  return offset - start;
}
