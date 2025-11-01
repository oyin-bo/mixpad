// @ts-check

import { RawURL } from './scan-tokens.js';

/**
 * Scan raw URL autolink (GFM extension) starting at `start`.
 * 
 * Raw URL autolinks are URLs that begin with http:// or https://
 * and are automatically recognized and linked without angle brackets.
 * 
 * Per GFM spec:
 * - Must start with http:// or https://
 * - Must have valid domain (at least one '.' in domain portion)
 * - Continues until whitespace, '<', or certain punctuation at line end
 * - Handles balanced parentheses
 * - Trailing punctuation is excluded in some cases
 * 
 * @pattern primitive - returns token directly (Pattern A)
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} provisional token (length | RawURL) or 0
 */
export function scanRawURLAutolink(input, start, end) {
  if (start < 0 || start >= end) return 0;

  // Check for http:// or https://
  let offset = start;
  let isHttp = false;
  let isHttps = false;

  // Check for "http://" (7 chars)
  if (offset + 7 <= end &&
      input.charCodeAt(offset) === 104 /* h */ &&
      input.charCodeAt(offset + 1) === 116 /* t */ &&
      input.charCodeAt(offset + 2) === 116 /* t */ &&
      input.charCodeAt(offset + 3) === 112 /* p */ &&
      input.charCodeAt(offset + 4) === 58 /* : */ &&
      input.charCodeAt(offset + 5) === 47 /* / */ &&
      input.charCodeAt(offset + 6) === 47 /* / */) {
    isHttp = true;
    offset += 7;
  }
  // Check for "https://" (8 chars)
  else if (offset + 8 <= end &&
      input.charCodeAt(offset) === 104 /* h */ &&
      input.charCodeAt(offset + 1) === 116 /* t */ &&
      input.charCodeAt(offset + 2) === 116 /* t */ &&
      input.charCodeAt(offset + 3) === 112 /* p */ &&
      input.charCodeAt(offset + 4) === 115 /* s */ &&
      input.charCodeAt(offset + 5) === 58 /* : */ &&
      input.charCodeAt(offset + 6) === 47 /* / */ &&
      input.charCodeAt(offset + 7) === 47 /* / */) {
    isHttps = true;
    offset += 8;
  }

  if (!isHttp && !isHttps) {
    return 0;
  }

  // Must have at least some content after the scheme
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

    // Track dots in domain portion (first part before path)
    if (ch === 46 /* . */) {
      hasDomainDot = true;
    }

    // Check for trailing punctuation that should be excluded
    // These are typically excluded if at the end: . , : ; ! ?
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

  // Must have at least one character after scheme and at least one dot in domain
  const contentLength = finalOffset - start;
  if (contentLength <= (isHttps ? 8 : 7)) {
    return 0;
  }

  // Check if we have a valid domain (contains at least one dot)
  // This is a simplified check - we just need some dot somewhere
  if (!hasDomainDot) {
    return 0;
  }

  return RawURL | contentLength;
}
