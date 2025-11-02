// @ts-check

import { WWWAutolink } from './scan-tokens.js';

/**
 * Scan WWW autolink (GFM extension) starting at `start`.
 * 
 * WWW autolinks start with "www." and are automatically recognized
 * and linked (with http:// prepended in rendering).
 * 
 * Per GFM spec:
 * - Must start with "www."
 * - Must have valid domain (at least one more '.' after "www.")
 * - Must be preceded by beginning of line or non-alphanumeric character
 * - Continues until whitespace, '<', or certain punctuation
 * - Handles balanced parentheses
 * - Trailing punctuation is excluded in some cases
 * 
 * @pattern primitive - returns token directly (Pattern A)
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @param {number} prevCharCode  Character code before start (or 0 if at line start)
 * @returns {number} provisional token (length | WWWAutolink) or 0
 */
export function scanWWWAutolink(input, start, end, prevCharCode) {
  if (start < 0 || start >= end) return 0;

  // Check that previous character is valid (not alphanumeric)
  // WWW autolinks must be preceded by start of line or non-alphanumeric
  if (prevCharCode !== 0) {
    const isAlphaNum = 
      (prevCharCode >= 48 && prevCharCode <= 57) || // 0-9
      (prevCharCode >= 65 && prevCharCode <= 90) ||  // A-Z
      (prevCharCode >= 97 && prevCharCode <= 122);   // a-z
    
    if (isAlphaNum) {
      return 0;
    }
  }

  // Check for "www." or "WWW." (4 chars, case insensitive)
  if (start + 4 > end) {
    return 0;
  }

  const c0 = input.charCodeAt(start);
  const c1 = input.charCodeAt(start + 1);
  const c2 = input.charCodeAt(start + 2);
  const c3 = input.charCodeAt(start + 3);
  
  // Check for www or WWW (case insensitive)
  if ((c0 !== 119 /* w */ && c0 !== 87 /* W */) ||
      (c1 !== 119 /* w */ && c1 !== 87 /* W */) ||
      (c2 !== 119 /* w */ && c2 !== 87 /* W */) ||
      c3 !== 46 /* . */) {
    return 0;
  }

  let offset = start + 4;

  // Must have at least some domain content after "www."
  if (offset >= end) {
    return 0;
  }

  // Scan the URL content
  let parenDepth = 0;
  let lastGoodOffset = offset;
  let hasDomainDot = false;

  while (offset < end) {
    const ch = input.charCodeAt(offset);

    // Stop at whitespace or line break
    if (ch === 32 /* space */ || ch === 9 /* tab */ || ch === 10 /* \n */ || ch === 13 /* \r */) {
      break;
    }

    // Stop at '<' (HTML tag start)
    if (ch === 60 /* < */) {
      break;
    }

    // Stop at '&' (potential entity start)
    if (ch === 38 /* & */) {
      break;
    }

    // Track parentheses depth
    if (ch === 40 /* ( */) {
      parenDepth++;
      lastGoodOffset = offset + 1;
      offset++;
      continue;
    }

    if (ch === 41 /* ) */) {
      parenDepth--;
      if (parenDepth < 0) {
        // Unmatched closing paren - don't include it
        break;
      }
      lastGoodOffset = offset + 1;
      offset++;
      continue;
    }

    // Track dots (need at least one more after "www.")
    if (ch === 46 /* . */) {
      hasDomainDot = true;
    }

    // Check for trailing punctuation that should be excluded
    const isTrailingPunc = 
      ch === 46 /* . */ || ch === 44 /* , */ || ch === 58 /* : */ ||
      ch === 59 /* ; */ || ch === 33 /* ! */ || ch === 63 /* ? */;

    if (!isTrailingPunc) {
      lastGoodOffset = offset + 1;
    }

    offset++;
  }

  // Use lastGoodOffset to exclude trailing punctuation
  const finalOffset = lastGoodOffset;

  // Must have content after "www." and at least one more dot
  const contentLength = finalOffset - start;
  if (contentLength <= 4) {
    return 0;
  }

  // Must have at least one dot after "www."
  if (!hasDomainDot) {
    return 0;
  }

  return WWWAutolink | contentLength;
}
