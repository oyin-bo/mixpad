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
  // Emit opening token (will flag later if unclosed)
  output.push(4 | HTMLCommentOpen);

  let offset = start + 4;
  const contentStart = offset;
  let newlineCount = 0;  // Track consecutive newlines for recovery detection
  let lineStart = offset;

  // Scan for '-->' with heuristic recovery
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

    // Check for heuristic recovery points
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Consume newline (including \r\n pairs)
      if (ch === 13 && offset + 1 < end && input.charCodeAt(offset + 1) === 10) {
        offset += 2; // \r\n
      } else {
        offset++;
      }
      
      newlineCount++;
      lineStart = offset;
      
      // Double newline found - recovery point
      if (newlineCount >= 2) {
        const contentLength = offset - contentStart;
        if (contentLength > 0) {
          output.push(contentLength | HTMLCommentContent | ErrorUnbalancedToken);
        }
        // Flag opening token as unbalanced
        output[openTokenIndex] |= ErrorUnbalancedToken;
        return offset - start;
      }
      continue;
    }

    // Check for < on new line (with possible whitespace indent)
    if (ch === 60 /* < */ && newlineCount >= 1) {
      // Check if only whitespace between lineStart and here
      let onlyWhitespace = true;
      for (let i = lineStart; i < offset; i++) {
        const wsCh = input.charCodeAt(i);
        if (wsCh !== 32 && wsCh !== 9) {
          onlyWhitespace = false;
          break;
        }
      }
      if (onlyWhitespace) {
        // Recovery point: < on new line
        const contentLength = offset - contentStart;
        if (contentLength > 0) {
          const contentToken = contentLength | HTMLCommentContent;
          output.push(contentToken | ErrorUnbalancedToken);
        }
        // Flag opening token as unbalanced
        output[openTokenIndex] |= ErrorUnbalancedToken;
        return offset - start;
      }
    }

    // Reset newline counter if we encounter non-whitespace, non-newline
    if (ch !== 32 && ch !== 9) {
      newlineCount = 0;
    }

    offset++;
  }

  // EOF without finding proper close - error recovery
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    const contentToken = contentLength | HTMLCommentContent;
    output.push(contentToken | ErrorUnbalancedToken);
  }
  // Flag opening token as unbalanced
  output[openTokenIndex] |= ErrorUnbalancedToken;
  return offset - start;
}
