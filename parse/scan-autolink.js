// @ts-check

import { isAsciiAlpha, isAsciiAlphaNum } from './scan-core.js';
import { IsAutolinkFTP, IsAutolinkHTTP, IsAutolinkHTTPS, IsAutolinkMailto } from './scan-token-flags.js';
import {
  AutolinkAngleClose,
  AutolinkAngleEmail,
  AutolinkAngleOpen,
  AutolinkAngleURL,
  AutolinkEmail,
  AutolinkRawURL,
  AutolinkWWW
} from './scan-tokens.js';

/**
 * Scan an angle autolink starting at `<`.
 * Returns the number of characters consumed (0 if not a valid autolink).
 * Emits tokens for angle open, content (URL or email), and angle close.
 *
 * @pattern consumption - returns consumed length, emits multiple tokens (Pattern B)
 * @param {string} input
 * @param {number} start  Position of '<'
 * @param {number} end  Exclusive end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} consumed length
 */
export function scanAngleAutolink(input, start, end, output) {
  if (start >= end || input.charCodeAt(start) !== 60 /* < */) return 0;

  let offset = start + 1;
  if (offset >= end) return 0;

  // Check for URI scheme or email
  const contentStart = offset;
  
  // Try to find the closing >
  let closePos = -1;
  for (let i = offset; i < end; i++) {
    const ch = input.charCodeAt(i);
    if (ch === 62 /* > */) {
      closePos = i;
      break;
    }
    // No spaces allowed
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
      return 0;
    }
    // No < allowed inside
    if (ch === 60 /* < */) {
      return 0;
    }
  }

  if (closePos === -1) return 0;
  const contentEnd = closePos;
  const contentLength = contentEnd - contentStart;
  
  if (contentLength === 0) return 0;

  // Try to parse as URL or email
  const isEmail = scanAngleAutolinkEmail(input, contentStart, contentEnd);
  const scheme = isEmail ? 0 : scanAngleAutolinkScheme(input, contentStart, contentEnd);

  if (!isEmail && scheme === 0) return 0;

  // Valid autolink - emit tokens
  output.push(1 | AutolinkAngleOpen); // '<' length 1

  if (isEmail) {
    output.push(contentLength | AutolinkAngleEmail);
  } else {
    output.push(contentLength | AutolinkAngleURL | scheme);
  }

  output.push(1 | AutolinkAngleClose); // '>' length 1

  return closePos - start + 1;
}

/**
 * Check if content is a valid email for angle autolink.
 * Email must have exactly one @ and valid local/domain parts.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function scanAngleAutolinkEmail(input, start, end) {
  let atPos = -1;
  
  // Find @ (must have exactly one)
  for (let i = start; i < end; i++) {
    if (input.charCodeAt(i) === 64 /* @ */) {
      if (atPos !== -1) return false; // Multiple @
      atPos = i;
    }
  }

  if (atPos === -1 || atPos === start || atPos === end - 1) return false;

  // Validate local part (before @)
  for (let i = start; i < atPos; i++) {
    const ch = input.charCodeAt(i);
    // Allowed: alphanumeric, .!#$%&'*+-/=?^_`{|}~
    const isValid = isAsciiAlphaNum(ch) ||
      ch === 46 /* . */ || ch === 33 /* ! */ || ch === 35 /* # */ ||
      ch === 36 /* $ */ || ch === 37 /* % */ || ch === 38 /* & */ ||
      ch === 39 /* ' */ || ch === 42 /* * */ || ch === 43 /* + */ ||
      ch === 45 /* - */ || ch === 47 /* / */ || ch === 61 /* = */ ||
      ch === 63 /* ? */ || ch === 94 /* ^ */ || ch === 95 /* _ */ ||
      ch === 96 /* ` */ || ch === 123 /* { */ || ch === 124 /* | */ ||
      ch === 125 /* } */ || ch === 126 /* ~ */;
    if (!isValid) return false;
  }

  // Validate domain part (after @)
  return isValidDomain(input, atPos + 1, end);
}

/**
 * Check if angle autolink content starts with a valid URI scheme.
 * Returns scheme flag or 0 if invalid.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} scheme flag
 */
function scanAngleAutolinkScheme(input, start, end) {
  // Check for recognized schemes: http://, https://, ftp://, mailto:
  const len = end - start;
  
  if (len >= 7 && input.substring(start, start + 7).toLowerCase() === 'http://') {
    // Basic validation: at least one character after scheme
    if (len > 7) return IsAutolinkHTTP;
  }
  
  if (len >= 8 && input.substring(start, start + 8).toLowerCase() === 'https://') {
    if (len > 8) return IsAutolinkHTTPS;
  }
  
  if (len >= 6 && input.substring(start, start + 6).toLowerCase() === 'ftp://') {
    if (len > 6) return IsAutolinkFTP;
  }
  
  if (len >= 7 && input.substring(start, start + 7).toLowerCase() === 'mailto:') {
    // Validate email after mailto:
    if (len > 7) {
      const emailStart = start + 7;
      if (scanAngleAutolinkEmail(input, emailStart, end)) {
        return IsAutolinkMailto;
      }
    }
  }

  return 0;
}

/**
 * Scan a raw URL autolink (http:// or https://).
 * Returns the number of characters consumed (0 if not valid).
 *
 * @pattern consumption - returns consumed length, emits single token (Pattern B)
 * @param {string} input
 * @param {number} start  Position of 'h' in http(s)
 * @param {number} end  Exclusive end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} consumed length
 */
export function scanRawURLAutolink(input, start, end, output) {
  if (start >= end) return 0;
  
  // Check for http:// or https://
  let scheme = 0;
  let offset = start;
  
  const remaining = end - start;
  if (remaining >= 7) {
    const prefix = input.substring(start, start + 7).toLowerCase();
    if (prefix === 'http://') {
      scheme = IsAutolinkHTTP;
      offset = start + 7;
    } else if (remaining >= 8 && input.substring(start, start + 8).toLowerCase() === 'https://') {
      scheme = IsAutolinkHTTPS;
      offset = start + 8;
    }
  }

  if (scheme === 0) return 0;

  // Scan valid URL characters
  const urlEnd = scanURLContent(input, offset, end);
  if (urlEnd <= offset) return 0; // Need at least some content after scheme

  const length = urlEnd - start;
  output.push(length | AutolinkRawURL | scheme);
  return length;
}

/**
 * Scan a WWW autolink (www.example.com).
 * Returns the number of characters consumed (0 if not valid).
 *
 * @pattern consumption - returns consumed length, emits single token (Pattern B)
 * @param {string} input
 * @param {number} start  Position of 'w' in www
 * @param {number} end  Exclusive end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} consumed length
 */
export function scanWWWAutolink(input, start, end, output) {
  if (end - start < 4) return 0;

  // Check for www. (case-insensitive)
  if (input.substring(start, start + 4).toLowerCase() !== 'www.') return 0;

  // Scan valid URL characters after www.
  const urlEnd = scanURLContent(input, start + 4, end);
  if (urlEnd <= start + 4) return 0; // Need content after www.

  const length = urlEnd - start;
  output.push(length | AutolinkWWW);
  return length;
}

/**
 * Scan valid URL content from start position.
 * Returns the end position of the URL (exclusive).
 * Handles trailing punctuation and parentheses balancing per GFM spec.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} end position
 */
function scanURLContent(input, start, end) {
  let offset = start;
  let parenDepth = 0;

  while (offset < end) {
    const ch = input.charCodeAt(offset);

    // Terminators: whitespace, <
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 60 /* < */) {
      break;
    }

    // Track parentheses for balancing
    if (ch === 40 /* ( */) {
      parenDepth++;
      offset++;
      continue;
    }
    if (ch === 41 /* ) */) {
      if (parenDepth > 0) {
        parenDepth--;
        offset++;
        continue;
      } else {
        // Unbalanced ) - stop here
        break;
      }
    }

    // Valid URL characters: alphanumeric, -, _, ., ~, /, ?, #, [, ], @, !, $, &, ', (, ), *, +, ,, ;, =, :, %
    const isValidURLChar = isAsciiAlphaNum(ch) ||
      ch === 45 /* - */ || ch === 95 /* _ */ || ch === 46 /* . */ ||
      ch === 126 /* ~ */ || ch === 47 /* / */ || ch === 63 /* ? */ ||
      ch === 35 /* # */ || ch === 91 /* [ */ || ch === 93 /* ] */ ||
      ch === 64 /* @ */ || ch === 33 /* ! */ || ch === 36 /* $ */ ||
      ch === 38 /* & */ || ch === 39 /* ' */ || ch === 42 /* * */ ||
      ch === 43 /* + */ || ch === 44 /* , */ || ch === 59 /* ; */ ||
      ch === 61 /* = */ || ch === 58 /* : */ || ch === 37 /* % */;

    if (!isValidURLChar) {
      break;
    }

    offset++;
  }

  // Trim trailing punctuation: .,;:*_~
  while (offset > start) {
    const ch = input.charCodeAt(offset - 1);
    if (ch === 46 /* . */ || ch === 44 /* , */ || ch === 58 /* : */ ||
        ch === 59 /* ; */ || ch === 42 /* * */ || ch === 95 /* _ */ ||
        ch === 126 /* ~ */) {
      offset--;
    } else {
      break;
    }
  }

  return offset;
}

/**
 * Scan an extended email autolink (plain email without angle brackets).
 * This checks backward from @ to find the start of the local part.
 * Returns the number of characters consumed (0 if not valid).
 *
 * @pattern consumption - returns consumed length, emits single token (Pattern B)
 * @param {string} input
 * @param {number} atPos  Position of '@'
 * @param {number} lineStart  Start of current line (for boundary check)
 * @param {number} end  Exclusive end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} consumed length, or 0 if invalid
 */
export function scanExtendedEmailAutolink(input, atPos, lineStart, end, output) {
  if (atPos < lineStart || atPos >= end) return 0;
  if (input.charCodeAt(atPos) !== 64 /* @ */) return 0;

  // Scan backward for local part
  let localStart = atPos - 1;
  while (localStart >= lineStart) {
    const ch = input.charCodeAt(localStart);
    // Valid local part chars: alphanumeric, ., -, _, +
    const isValid = isAsciiAlphaNum(ch) ||
      ch === 46 /* . */ || ch === 45 /* - */ ||
      ch === 95 /* _ */ || ch === 43 /* + */;
    if (!isValid) {
      localStart++;
      break;
    }
    localStart--;
  }

  // Adjust if we went past the start
  if (localStart < lineStart) localStart = lineStart;

  // Need at least one character in local part
  if (localStart >= atPos) return 0;

  // Check that local part starts at a valid boundary
  if (localStart > lineStart) {
    const prevCh = input.charCodeAt(localStart - 1);
    // Must be preceded by whitespace or start of line
    const isValidBoundary = prevCh === 32 || prevCh === 9 || prevCh === 10 || prevCh === 13;
    if (!isValidBoundary) return 0;
  }

  // Scan forward for domain part
  let domainEnd = atPos + 1;
  while (domainEnd < end) {
    const ch = input.charCodeAt(domainEnd);
    // Valid domain chars: alphanumeric, -, .
    const isValid = isAsciiAlphaNum(ch) || ch === 45 /* - */ || ch === 46 /* . */;
    if (!isValid) break;
    domainEnd++;
  }

  // Need at least one character in domain
  if (domainEnd <= atPos + 1) return 0;

  // Validate domain has valid structure
  if (!isValidDomain(input, atPos + 1, domainEnd)) return 0;

  // Trim trailing punctuation from domain: .,;:
  while (domainEnd > atPos + 1) {
    const ch = input.charCodeAt(domainEnd - 1);
    if (ch === 46 /* . */ || ch === 44 /* , */ || ch === 59 /* ; */ || ch === 58 /* : */) {
      domainEnd--;
    } else {
      break;
    }
  }

  const length = domainEnd - localStart;
  output.push(length | AutolinkEmail);
  return length;
}

/**
 * Validate a domain part (after @ in email or in URL).
 * Domain must have at least one dot and valid labels.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function isValidDomain(input, start, end) {
  if (start >= end) return false;

  let hasDot = false;
  let labelStart = start;

  for (let i = start; i <= end; i++) {
    const ch = i < end ? input.charCodeAt(i) : -1;
    const isDot = ch === 46 /* . */;
    const isEnd = i === end;

    if (isDot || isEnd) {
      // Validate label
      const labelLen = i - labelStart;
      if (labelLen === 0) return false; // Empty label

      // Label can't start or end with hyphen
      const firstCh = input.charCodeAt(labelStart);
      const lastCh = input.charCodeAt(i - 1);
      if (firstCh === 45 /* - */ || lastCh === 45 /* - */) return false;

      // Check all characters in label are valid
      for (let j = labelStart; j < i; j++) {
        const c = input.charCodeAt(j);
        if (!isAsciiAlphaNum(c) && c !== 45 /* - */) return false;
      }

      if (isDot) {
        hasDot = true;
        labelStart = i + 1;
      }
    }
  }

  return hasDot;
}
