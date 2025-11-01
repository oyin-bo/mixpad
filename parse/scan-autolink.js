// @ts-check

import { AutolinkEmail, AutolinkURL, AutolinkWWW } from './scan-tokens.js';

/**
 * Scan for GFM autolinks (angle autolinks, raw URLs, WWW autolinks, email autolinks).
 * 
 * GFM autolinks include:
 * 1. Angle autolinks: <http://example.com> or <user@example.com>
 * 2. Raw URL autolinks: http://example.com or https://example.com
 * 3. WWW autolinks: www.example.com
 * 4. Email autolinks: user@example.com
 * 
 * @param {string} input - The input string
 * @param {number} start - Start position (guaranteed to point at '<' for angle autolinks, or start of scheme/www/email)
 * @param {number} end - End position
 * @returns {number} Packed token (kind | length) or 0 if no autolink matched
 */
export function scanAutolink(input, start, end) {
  if (start >= end) return 0;
  
  const ch = input.charCodeAt(start);
  
  // Check for angle autolink: <...>
  if (ch === 60 /* < */) {
    return scanAngleAutolink(input, start, end);
  }
  
  // Check for raw URL autolink (http:// or https://)
  if (ch === 104 /* h */ || ch === 72 /* H */) {
    const result = scanRawURLAutolink(input, start, end);
    if (result) return result;
  }
  
  // Check for WWW autolink (www.)
  if (ch === 119 /* w */ || ch === 87 /* W */) {
    const result = scanWWWAutolink(input, start, end);
    if (result) return result;
  }
  
  // Check for email autolink (user@domain)
  const result = scanEmailAutolink(input, start, end);
  if (result) return result;
  
  return 0;
}

/**
 * Scan angle autolink: <http://example.com> or <user@example.com>
 * @param {string} input
 * @param {number} start - Points at '<'
 * @param {number} end
 * @returns {number} Packed token or 0
 */
function scanAngleAutolink(input, start, end) {
  if (start >= end || input.charCodeAt(start) !== 60 /* < */) return 0;
  
  let pos = start + 1;
  
  // Check for URL scheme
  const schemeEnd = scanScheme(input, pos, end);
  if (schemeEnd > pos) {
    // Found scheme, expect colon
    if (schemeEnd < end && input.charCodeAt(schemeEnd) === 58 /* : */) {
      pos = schemeEnd + 1;
      // Scan rest of URL until >
      while (pos < end) {
        const ch = input.charCodeAt(pos);
        if (ch === 62 /* > */) {
          // Valid URL autolink
          return AutolinkURL | (pos - start + 1);
        }
        if (ch === 60 /* < */ || ch === 32 /* space */ || ch === 10 /* \n */) {
          // Invalid character in URL
          return 0;
        }
        pos++;
      }
      return 0; // No closing >
    }
  }
  
  // Check for email: user@domain
  pos = start + 1;
  let hasAt = false;
  let localPartStart = pos;
  
  // Scan local part (before @)
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 64 /* @ */) {
      if (pos === localPartStart) return 0; // Empty local part
      hasAt = true;
      pos++;
      break;
    }
    if (ch === 62 /* > */ || ch === 60 /* < */ || ch === 32 /* space */ || ch === 10 /* \n */) {
      return 0;
    }
    if (!isEmailLocalChar(ch)) return 0;
    pos++;
  }
  
  if (!hasAt) return 0;
  
  // Scan domain part (after @)
  const domainStart = pos;
  let lastDotPos = -1;
  let segmentStart = pos;
  
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 62 /* > */) {
      // Check if we have valid domain
      if (pos === domainStart) return 0; // Empty domain
      if (pos === segmentStart) return 0; // Empty segment after dot
      // Valid email autolink
      return AutolinkEmail | (pos - start + 1);
    }
    if (ch === 46 /* . */) {
      if (pos === segmentStart) return 0; // Empty segment
      lastDotPos = pos;
      segmentStart = pos + 1;
      pos++;
      continue;
    }
    if (ch === 60 /* < */ || ch === 32 /* space */ || ch === 10 /* \n */) {
      return 0;
    }
    if (!isEmailDomainChar(ch)) return 0;
    pos++;
  }
  
  return 0; // No closing >
}

/**
 * Scan raw URL autolink: http://example.com or https://example.com
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} Packed token or 0
 */
function scanRawURLAutolink(input, start, end) {
  // Check for http:// or https://
  let pos = start;
  
  // Match http or https (case-insensitive)
  if (!matchStringCI(input, pos, end, 'http')) return 0;
  pos += 4;
  
  // Optional 's'
  if (pos < end && (input.charCodeAt(pos) === 115 /* s */ || input.charCodeAt(pos) === 83 /* S */)) {
    pos++;
  }
  
  // Expect ://
  if (pos + 2 >= end || input.charCodeAt(pos) !== 58 /* : */ ||
      input.charCodeAt(pos + 1) !== 47 /* / */ || input.charCodeAt(pos + 2) !== 47 /* / */) {
    return 0;
  }
  pos += 3;
  
  // Scan domain and path
  const urlEnd = scanURLRest(input, pos, end);
  if (urlEnd <= pos) return 0;
  
  return AutolinkURL | (urlEnd - start);
}

/**
 * Scan WWW autolink: www.example.com
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} Packed token or 0
 */
function scanWWWAutolink(input, start, end) {
  // Must start with www. (case-insensitive)
  if (!matchStringCI(input, start, end, 'www.')) return 0;
  
  let pos = start + 4;
  
  // Scan domain and path
  const urlEnd = scanURLRest(input, pos, end);
  if (urlEnd <= pos) return 0;
  
  return AutolinkWWW | (urlEnd - start);
}

/**
 * Scan email autolink: user@example.com
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} Packed token or 0
 */
function scanEmailAutolink(input, start, end) {
  let pos = start;
  
  // Scan local part (before @)
  const localStart = pos;
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 64 /* @ */) break;
    if (!isEmailLocalChar(ch)) return 0;
    pos++;
  }
  
  if (pos === localStart || pos >= end) return 0; // No local part or no @
  if (input.charCodeAt(pos) !== 64 /* @ */) return 0;
  
  pos++; // Skip @
  
  // Scan domain
  const domainStart = pos;
  let segments = 0;
  let segmentStart = pos;
  let lastSegmentStart = pos;
  
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    
    if (ch === 46 /* . */) {
      if (pos === segmentStart) return 0; // Empty segment
      segments++;
      lastSegmentStart = pos + 1;
      segmentStart = pos + 1;
      pos++;
      continue;
    }
    
    if (!isEmailDomainChar(ch)) {
      // End of domain
      break;
    }
    
    pos++;
  }
  
  if (pos === domainStart) return 0; // No domain
  if (pos === segmentStart) return 0; // Empty segment after dot
  
  // Last segment must be at least 2 alphabetic characters
  const lastSegmentLen = pos - lastSegmentStart;
  if (lastSegmentLen < 2) return 0;
  
  // Verify last segment is alphabetic
  for (let i = lastSegmentStart; i < pos; i++) {
    const ch = input.charCodeAt(i);
    if (!isAsciiAlpha(ch)) return 0;
  }
  
  // Apply trailing punctuation rules
  const finalEnd = applyTrailingPunctuationRules(input, start, pos, end);
  
  return AutolinkEmail | (finalEnd - start);
}

/**
 * Scan URL scheme (alphabetic start, followed by alphanumeric + . + -)
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {number} Position after scheme or start if invalid
 */
function scanScheme(input, start, end) {
  if (start >= end) return start;
  
  // First character must be alphabetic
  const ch = input.charCodeAt(start);
  if (!isAsciiAlpha(ch)) return start;
  
  let pos = start + 1;
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 58 /* : */) {
      // End of scheme
      return pos;
    }
    if (!isAsciiAlphaNum(ch) && ch !== 46 /* . */ && ch !== 43 /* + */ && ch !== 45 /* - */) {
      return start;
    }
    pos++;
  }
  
  return start;
}

/**
 * Scan rest of URL (domain and path) for raw URL and WWW autolinks
 * @param {string} input
 * @param {number} start - Position after http:// or www.
 * @param {number} end
 * @returns {number} Position after URL or start if invalid
 */
function scanURLRest(input, start, end) {
  let pos = start;
  
  // Must have at least one valid domain character
  if (pos >= end || !isURLChar(input.charCodeAt(pos))) return start;
  
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (!isURLChar(ch)) break;
    pos++;
  }
  
  // Apply trailing punctuation rules
  return applyTrailingPunctuationRules(input, start, pos, end);
}

/**
 * Apply GFM trailing punctuation rules
 * @param {string} input
 * @param {number} start - Start of the URL/email
 * @param {number} end - Current end position
 * @param {number} inputEnd - End of input
 * @returns {number} Adjusted end position after removing trailing punctuation
 */
function applyTrailingPunctuationRules(input, start, end, inputEnd) {
  let pos = end;
  
  // Strip trailing ?, !, ., ,, :, *, _, ~
  while (pos > start) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 63 /* ? */ || ch === 33 /* ! */ || ch === 46 /* . */ || 
        ch === 44 /* , */ || ch === 58 /* : */ || ch === 42 /* * */ || 
        ch === 95 /* _ */ || ch === 126 /* ~ */) {
      pos--;
      continue;
    }
    break;
  }
  
  // Handle balanced parentheses
  // Count opening and closing parens
  let openParens = 0;
  let closeParens = 0;
  for (let i = start; i < pos; i++) {
    const ch = input.charCodeAt(i);
    if (ch === 40 /* ( */) openParens++;
    if (ch === 41 /* ) */) closeParens++;
  }
  
  // Remove trailing ) if unbalanced
  while (pos > start && closeParens > openParens) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 41 /* ) */) {
      pos--;
      closeParens--;
      continue;
    }
    break;
  }
  
  // Remove entity references at the end
  // Look for &...; pattern at the end
  if (pos > start + 3) {
    let semiPos = pos - 1;
    if (input.charCodeAt(semiPos) === 59 /* ; */) {
      let ampPos = semiPos - 1;
      while (ampPos > start && ampPos > semiPos - 32) {
        const ch = input.charCodeAt(ampPos);
        if (ch === 38 /* & */) {
          // Found potential entity reference
          const entityContent = input.substring(ampPos + 1, semiPos);
          if (looksLikeEntity(entityContent)) {
            pos = ampPos;
          }
          break;
        }
        if (!isAsciiAlphaNum(ch) && ch !== 35 /* # */ && ch !== 120 /* x */) {
          break;
        }
        ampPos--;
      }
    }
  }
  
  return pos;
}

/**
 * Check if string looks like an HTML entity
 * @param {string} str
 * @returns {boolean}
 */
function looksLikeEntity(str) {
  if (str.length === 0) return false;
  
  // Numeric entity: #123 or #xAB
  if (str.charCodeAt(0) === 35 /* # */) {
    if (str.length < 2) return false;
    if (str.charCodeAt(1) === 120 /* x */ || str.charCodeAt(1) === 88 /* X */) {
      // Hex entity
      return str.length > 2 && /^[0-9a-fA-F]+$/.test(str.substring(2));
    }
    // Decimal entity
    return /^[0-9]+$/.test(str.substring(1));
  }
  
  // Named entity: alphanumeric
  return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if character is valid in email local part
 * @param {number} ch - Character code
 * @returns {boolean}
 */
function isEmailLocalChar(ch) {
  // Alphanumeric, dot, dash, underscore, plus
  return isAsciiAlphaNum(ch) || ch === 46 /* . */ || ch === 45 /* - */ || 
         ch === 95 /* _ */ || ch === 43 /* + */;
}

/**
 * Check if character is valid in email domain
 * @param {number} ch - Character code
 * @returns {boolean}
 */
function isEmailDomainChar(ch) {
  // Alphanumeric, dash, underscore
  return isAsciiAlphaNum(ch) || ch === 45 /* - */ || ch === 95 /* _ */;
}

/**
 * Check if character is valid in URL
 * @param {number} ch - Character code
 * @returns {boolean}
 */
function isURLChar(ch) {
  // Not whitespace, not <, not >
  return ch > 32 && ch !== 60 /* < */ && ch !== 62 /* > */;
}

/**
 * Check if character is ASCII alphabetic
 * @param {number} ch - Character code
 * @returns {boolean}
 */
function isAsciiAlpha(ch) {
  return (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
}

/**
 * Check if character is ASCII alphanumeric
 * @param {number} ch - Character code
 * @returns {boolean}
 */
function isAsciiAlphaNum(ch) {
  return (ch >= 48 && ch <= 57) || (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
}

/**
 * Case-insensitive string match
 * @param {string} input
 * @param {number} pos
 * @param {number} end
 * @param {string} target
 * @returns {boolean}
 */
function matchStringCI(input, pos, end, target) {
  if (pos + target.length > end) return false;
  for (let i = 0; i < target.length; i++) {
    const ch = input.charCodeAt(pos + i);
    const targetCh = target.charCodeAt(i);
    // Convert to lowercase for comparison
    const chLower = (ch >= 65 && ch <= 90) ? ch + 32 : ch;
    const targetChLower = (targetCh >= 65 && targetCh <= 90) ? targetCh + 32 : targetCh;
    if (chLower !== targetChLower) return false;
  }
  return true;
}
