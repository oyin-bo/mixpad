// @ts-check

import { ErrorUnbalancedToken } from './scan-token-flags.js';
import { HTMLDocTypeClose, HTMLDocTypeContent, HTMLDocTypeOpen } from './scan-tokens.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan DOCTYPE declaration.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLDocType(input, start, end, output) {
  // Must start with '<!'
  if (start + 2 > end) return 0;
  if (input.charCodeAt(start) !== 60 /* < */ ||
      input.charCodeAt(start + 1) !== 33 /* ! */) {
    return 0;
  }

  // Check for 'DOCTYPE' (case-insensitive)
  let offset = start + 2;
  const doctypeStart = offset;
  const expectedDoctype = 'DOCTYPE';
  
  if (offset + 7 > end) return 0;
  
  for (let i = 0; i < 7; i++) {
    const ch = input.charCodeAt(offset);
    const expected = expectedDoctype.charCodeAt(i);
    // Case-insensitive comparison: both uppercase and lowercase match
    if (ch !== expected && ch !== (expected + 32)) {
      return 0;
    }
    offset++;
  }

  const openTokenIndex = output.length;
  // Emit opening token (will flag later if unclosed)
  output.push(9 | HTMLDocTypeOpen); // '<!DOCTYPE'

  // Scan content until '>' with heuristic recovery
  const contentStart = offset;
  let bracketDepth = 0;

  while (offset < end) {
    const ch = input.charCodeAt(offset);
    
    if (ch === 91 /* [ */) {
      bracketDepth++;
      offset++;
    } else if (ch === 93 /* ] */) {
      bracketDepth--;
      offset++;
    } else if (ch === 62 /* > */ && bracketDepth === 0) {
      // Found proper closing '>'
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLDocTypeContent);
      }
      output.push(1 | HTMLDocTypeClose);
      return offset - start + 1;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      // Newline - recovery point
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLDocTypeContent | ErrorUnbalancedToken);
      }
      output[openTokenIndex] |= ErrorUnbalancedToken;
      return offset - start;
    } else if (ch === 60 /* < */) {
      // < - recovery point
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLDocTypeContent | ErrorUnbalancedToken);
      }
      output[openTokenIndex] |= ErrorUnbalancedToken;
      return offset - start;
    } else {
      offset++;
    }
  }

  // EOF without finding '>'
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLDocTypeContent | ErrorUnbalancedToken);
  }
  output[openTokenIndex] |= ErrorUnbalancedToken;
  return offset - start;
}
