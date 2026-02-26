// @ts-check

import { AngleLinkOpen, AngleLinkURL, AngleLinkEmail, AngleLinkClose } from './scan-tokens.js';

/**
 * Scan angle autolink starting at `start` (where input[start] === '<').
 * 
 * Angle autolinks come in two forms:
 * 1. URL autolink: <scheme:...> where scheme is valid (http, https, ftp, mailto, etc.)
 * 2. Email autolink: <user@domain>
 * 
 * Returns consumed length if valid autolink found, 0 otherwise.
 * Emits tokens: AngleLinkOpen, AngleLinkURL/AngleLinkEmail, AngleLinkClose
 * 
 * Per CommonMark spec:
 * - URL autolink must have valid scheme (one or more ASCII letters, digits, +, -, .)
 *   followed by ':', then non-space characters until '>'
 * - Email autolink matches pattern: local@domain where local and domain follow rules
 * - No line breaks allowed inside
 * - No unescaped '<' or '>' allowed inside
 * 
 * @pattern orchestration - emits tokens, returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start  Index of '<'
 * @param {number} end
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} consumed length, or 0 if not a valid angle autolink
 */
export function scanAngleAutolink(input, start, end, output) {
  if (start < 0 || start >= end) return 0;
  if (input.charCodeAt(start) !== 60 /* < */) return 0;

  let offset = start + 1;
  if (offset >= end) return 0;

  // Scan the content between < and >
  // First, try to determine if this is a URL or email autolink
  const contentStart = offset;
  let hasAt = false;
  let hasColon = false;
  let colonPos = -1;

  // Scan until we find '>', newline, or another '<'
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    
    // Disallowed characters
    if (ch === 10 /* \n */ || ch === 60 /* < */) {
      return 0; // Not a valid autolink
    }
    
    if (ch === 62 /* > */) {
      break; // Found closing bracket
    }
    
    if (ch === 64 /* @ */ && !hasAt) {
      hasAt = true;
    }
    
    if (ch === 58 /* : */ && !hasColon) {
      hasColon = true;
      colonPos = offset;
    }
    
    offset++;
  }

  // Must find closing '>'
  if (offset >= end || input.charCodeAt(offset) !== 62 /* > */) {
    return 0;
  }

  const contentEnd = offset;
  const contentLength = contentEnd - contentStart;

  // Empty content not allowed
  if (contentLength === 0) {
    return 0;
  }

  // Determine type: URL autolink or email autolink
  let isURL = false;
  let isEmail = false;

  if (hasColon && (!hasAt || (colonPos < contentStart + contentLength && colonPos < contentEnd))) {
    // Check if we have a valid URI scheme before the colon
    // Scheme must be: [a-zA-Z][a-zA-Z0-9+.-]*
    const schemeEnd = colonPos;
    const schemeStart = contentStart;
    
    if (schemeEnd > schemeStart) {
      const firstChar = input.charCodeAt(schemeStart);
      // First character must be ASCII letter
      if ((firstChar >= 65 && firstChar <= 90) || (firstChar >= 97 && firstChar <= 122)) {
        let validScheme = true;
        for (let i = schemeStart + 1; i < schemeEnd; i++) {
          const c = input.charCodeAt(i);
          const isAlpha = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
          const isDigit = c >= 48 && c <= 57;
          const isSpecial = c === 43 /* + */ || c === 45 /* - */ || c === 46 /* . */;
          if (!isAlpha && !isDigit && !isSpecial) {
            validScheme = false;
            break;
          }
        }
        
        if (validScheme) {
          // Additional check: content after ':' must not contain spaces
          let hasSpace = false;
          for (let i = colonPos + 1; i < contentEnd; i++) {
            const c = input.charCodeAt(i);
            if (c === 32 /* space */ || c === 9 /* tab */) {
              hasSpace = true;
              break;
            }
          }
          
          if (!hasSpace) {
            isURL = true;
          }
        }
      }
    }
  }

  if (!isURL && hasAt) {
    // Try to match email autolink pattern
    // Email pattern (simplified): local@domain
    // local: alphanumeric and some special chars
    // domain: alphanumeric and dots/hyphens
    isEmail = isValidEmailAutolink(input, contentStart, contentEnd);
  }

  if (!isURL && !isEmail) {
    return 0; // Not a valid autolink
  }

  // Emit tokens
  output.push(AngleLinkOpen | 1); // '<' has length 1
  
  if (isURL) {
    output.push(AngleLinkURL | contentLength);
  } else {
    output.push(AngleLinkEmail | contentLength);
  }
  
  output.push(AngleLinkClose | 1); // '>' has length 1

  return offset - start + 1; // Total consumed length
}

/**
 * Check if content matches email autolink pattern.
 * Simplified pattern: local-part@domain-part
 * where local and domain consist of allowed characters.
 * 
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function isValidEmailAutolink(input, start, end) {
  // Find @ symbol
  let atPos = -1;
  for (let i = start; i < end; i++) {
    if (input.charCodeAt(i) === 64 /* @ */) {
      if (atPos >= 0) {
        return false; // Multiple @ symbols not allowed
      }
      atPos = i;
    }
  }

  if (atPos < 0 || atPos === start || atPos === end - 1) {
    return false; // @ must exist and not be at start or end
  }

  // Validate local part (before @)
  for (let i = start; i < atPos; i++) {
    const c = input.charCodeAt(i);
    const isAlphaNum = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const isSpecial = c === 46 /* . */ || c === 45 /* - */ || c === 95 /* _ */ || 
                      c === 43 /* + */;
    if (!isAlphaNum && !isSpecial) {
      return false;
    }
  }

  // Validate domain part (after @)
  let lastCharWasDot = false;
  let hasDot = false;
  for (let i = atPos + 1; i < end; i++) {
    const c = input.charCodeAt(i);
    const isAlphaNum = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const isDot = c === 46 /* . */;
    const isHyphen = c === 45 /* - */;
    
    if (isDot) {
      hasDot = true;
      lastCharWasDot = true;
    } else {
      lastCharWasDot = false;
    }
    
    if (!isAlphaNum && !isDot && !isHyphen) {
      return false;
    }
  }

  // Domain must have at least one dot and not end with dot
  return hasDot && !lastCharWasDot;
}
