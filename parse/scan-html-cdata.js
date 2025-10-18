// @ts-check

import { ErrorUnbalancedToken } from './scan-token-flags.js';
import { HTMLCDataClose, HTMLCDataContent, HTMLCDataOpen } from './scan-tokens.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan CDATA section.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLCData(input, start, end, output) {
  // Must start with '<![CDATA['
  if (start + 9 > end) return 0;
  if (input.charCodeAt(start) !== 60 /* < */ ||
      input.charCodeAt(start + 1) !== 33 /* ! */ ||
      input.charCodeAt(start + 2) !== 91 /* [ */ ||
      input.charCodeAt(start + 3) !== 67 /* C */ ||
      input.charCodeAt(start + 4) !== 68 /* D */ ||
      input.charCodeAt(start + 5) !== 65 /* A */ ||
      input.charCodeAt(start + 6) !== 84 /* T */ ||
      input.charCodeAt(start + 7) !== 65 /* A */ ||
      input.charCodeAt(start + 8) !== 91 /* [ */) {
    return 0;
  }

  const openTokenIndex = output.length;
  // Emit opening token (will flag later if unclosed)
  output.push(9 | HTMLCDataOpen);

  let offset = start + 9;
  const contentStart = offset;
  let prevWasNewline = false;  // Track if previous non-space/tab was newline

  // Scan for ']]>' with heuristic recovery
  while (offset < end) {
    const ch = input.charCodeAt(offset);

    if (ch === 93 /* ] */ && offset + 2 < end &&
        input.charCodeAt(offset + 1) === 93 /* ] */ &&
        input.charCodeAt(offset + 2) === 62 /* > */) {
      // Found proper close
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCDataContent);
      }
      output.push(3 | HTMLCDataClose);
      return offset - start + 3;
    }

    // Heuristic recovery points
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Double newline (with possible whitespace between) - recovery point
      if (prevWasNewline) {
        const contentLength = offset - contentStart;
        if (contentLength > 0) {
          output.push(contentLength | HTMLCDataContent);
        }
        output[openTokenIndex] |= ErrorUnbalancedToken;
        // Don't consume the newline - it will be parsed normally
        return offset - start;
      }
      
      prevWasNewline = true;
      
      // Consume newline (including \r\n pairs)
      if (ch === 13 && offset + 1 < end && input.charCodeAt(offset + 1) === 10) {
        offset += 2; // \r\n
      } else {
        offset++;
      }
      continue;
    }

    if (ch === 60 /* < */) {
      // < - recovery point
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCDataContent);
      }
      output[openTokenIndex] |= ErrorUnbalancedToken;
      // Don't consume the < - it will be parsed normally
      return offset - start;
    }

    if (ch === 62 /* > */) {
      // > - recovery point, emit as malformed close
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCDataContent);
      }
      output[openTokenIndex] |= ErrorUnbalancedToken;
      output.push(1 | HTMLCDataClose | ErrorUnbalancedToken);
      // Consume the > and continue parsing after it
      return offset - start + 1;
    }

    // Reset newline flag if we encounter non-whitespace character
    if (ch !== 32 && ch !== 9) {
      prevWasNewline = false;
    }

    offset++;
  }

  // EOF without finding close
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCDataContent);
  }
  output[openTokenIndex] |= ErrorUnbalancedToken;
  return offset - start;
}
