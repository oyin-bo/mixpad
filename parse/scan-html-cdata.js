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
  let recoveryEnd = -1;

  // Heuristic 1: Double newline
  for (let i = offset; i < end; i++) {
    const ch = input.charCodeAt(i);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Found first newline, now check if another newline follows
      let nextPos = i + 1;
      if (ch === 13 && nextPos < end && input.charCodeAt(nextPos) === 10) {
        nextPos++; // Skip \n in \r\n pair
      }
      // Check if next character is also a newline
      if (nextPos < end) {
        const nextCh = input.charCodeAt(nextPos);
        if (nextCh === 10 || nextCh === 13) {
          // Double newline found! Recovery point is at the first newline
          recoveryEnd = i;
          break;
        }
      }
    }
  }

  // Heuristic 2: '<' character
  if (recoveryEnd === -1) {
    for (let i = offset; i < end; i++) {
      if (input.charCodeAt(i) === 60 /* < */) {
        // Found <, backtrack past any preceding newlines
        recoveryEnd = i;
        while (recoveryEnd > offset) {
          const prevCh = input.charCodeAt(recoveryEnd - 1);
          if (prevCh === 10 /* \n */ || prevCh === 13 /* \r */) {
            recoveryEnd--;
          } else {
            break;
          }
        }
        break;
      }
    }
  }

  // Heuristic 3: '>' character (malformed close)
  if (recoveryEnd === -1) {
    for (let i = offset; i < end; i++) {
      if (input.charCodeAt(i) === 62 /* > */) {
        recoveryEnd = i;
        const contentLength = recoveryEnd - contentStart;
        if (contentLength > 0) {
          output.push(contentLength | HTMLCDataContent | ErrorUnbalancedToken);
        }
        output.push(1 | HTMLCDataClose | ErrorUnbalancedToken);
        return recoveryEnd - start + 1; // Consume the >
      }
    }
  }

  if (recoveryEnd !== -1) {
    const contentLength = recoveryEnd - contentStart;
    if (contentLength > 0) {
      output.push(contentLength | HTMLCDataContent | ErrorUnbalancedToken);
    }
    return recoveryEnd - start;
  }

  // EOF
  const contentLength = end - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLCDataContent | ErrorUnbalancedToken);
  }
  return end - start;
}
