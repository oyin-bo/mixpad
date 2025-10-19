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

  // First, try to find the closing ']]>'
  let closeOffset = -1;
  for (let i = offset; i < end; i++) {
    if (input.charCodeAt(i) === 93 /* ] */ && i + 2 < end &&
        input.charCodeAt(i + 1) === 93 /* ] */ &&
        input.charCodeAt(i + 2) === 62 /* > */) {
      closeOffset = i;
      break;
    }
  }

  if (closeOffset !== -1) {
    // Found proper close
    const contentLength = closeOffset - contentStart;
    if (contentLength > 0) {
      output.push(contentLength | HTMLCDataContent);
    }
    output.push(3 | HTMLCDataClose);
    return closeOffset - start + 3;
  }

  // EOF without finding close, now apply recovery heuristics.
  output[openTokenIndex] |= ErrorUnbalancedToken;
  let prevWasNewline = false;

  while (offset < end) {
    const ch = input.charCodeAt(offset);

    // Heuristic recovery points
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      if (prevWasNewline) {
        const contentLength = offset - contentStart;
        if (contentLength > 0) {
          output.push(contentLength | HTMLCDataContent);
        }
        return offset - start; // Don't consume the newline
      }
      prevWasNewline = true;
      if (ch === 13 && offset + 1 < end && input.charCodeAt(offset + 1) === 10) {
        offset += 2; // \r\n
      } else {
        offset++;
      }
      continue;
    }

    if (ch === 60 /* < */) {
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCDataContent);
      }
      return offset - start; // Don't consume the <
    }

    if (ch === 62 /* > */) {
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLCDataContent);
      }
      output.push(1 | HTMLCDataClose | ErrorUnbalancedToken);
      return offset - start + 1; // Consume the >
    }

    if (ch !== 32 && ch !== 9) {
      prevWasNewline = false;
    }
    offset++;
  }

  // EOF
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCDataContent);
  }
  return offset - start;
}
