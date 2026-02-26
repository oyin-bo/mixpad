// @ts-check

import { EmailAutolink } from './scan-tokens.js';

/**
 * Scan email autolink (GFM extension) starting at the '@' character.
 * 
 * Email autolinks are email addresses automatically recognized and linked.
 * 
 * Per GFM spec:
 * - Pattern: local-part@domain-part
 * - local-part: alphanumeric, dots, underscores, hyphens, plus signs (simplified)
 * - domain-part: alphanumeric, dots, hyphens, must have at least one dot
 * - Must not be preceded by alphanumeric or hyphen
 * - Must not be followed by alphanumeric or hyphen/underscore
 * - Needs to scan backwards to find start of local-part
 * 
 * This scanner is called when '@' is encountered and must scan both
 * backwards and forwards to determine if it's a valid email.
 * 
 * @pattern primitive - returns token directly (Pattern A)
 * @param {string} input
 * @param {number} atPos  Position of '@' character
 * @param {number} lineStart  Start of current line (for backward scanning)
 * @param {number} end
 * @returns {number} provisional token (length | EmailAutolink) or 0, length includes chars before @
 */
export function scanEmailAutolink(input, atPos, lineStart, end) {
  if (atPos < 0 || atPos >= end) return 0;
  if (input.charCodeAt(atPos) !== 64 /* @ */) return 0;

  // Scan backwards to find start of local part
  let localStart = atPos - 1;
  
  // Local part must have at least one character
  if (localStart < lineStart) {
    return 0;
  }

  // Check character before local part (if any)
  if (localStart > lineStart) {
    const prevChar = input.charCodeAt(localStart - 1);
    const isAlphaNum = 
      (prevChar >= 48 && prevChar <= 57) || // 0-9
      (prevChar >= 65 && prevChar <= 90) ||  // A-Z
      (prevChar >= 97 && prevChar <= 122);   // a-z
    const isHyphen = prevChar === 45; // -
    
    if (isAlphaNum || isHyphen) {
      return 0; // Invalid: preceded by alphanumeric or hyphen
    }
  }

  // Scan backwards to find start of local part
  while (localStart >= lineStart) {
    const ch = input.charCodeAt(localStart);
    const isAlphaNum = 
      (ch >= 48 && ch <= 57) || // 0-9
      (ch >= 65 && ch <= 90) ||  // A-Z
      (ch >= 97 && ch <= 122);   // a-z
    const isSpecial = 
      ch === 46 /* . */ || ch === 45 /* - */ || ch === 95 /* _ */ || ch === 43 /* + */;
    
    if (!isAlphaNum && !isSpecial) {
      break;
    }
    
    localStart--;
  }
  
  localStart++; // Move to first valid character

  // Local part must have at least one character
  if (localStart >= atPos) {
    return 0;
  }

  // Validate local part (alphanumeric, dots, hyphens, underscores, plus)
  for (let i = localStart; i < atPos; i++) {
    const ch = input.charCodeAt(i);
    const isAlphaNum = 
      (ch >= 48 && ch <= 57) || // 0-9
      (ch >= 65 && ch <= 90) ||  // A-Z
      (ch >= 97 && ch <= 122);   // a-z
    const isSpecial = 
      ch === 46 /* . */ || ch === 45 /* - */ || ch === 95 /* _ */ || ch === 43 /* + */;
    
    if (!isAlphaNum && !isSpecial) {
      return 0;
    }
  }

  // Scan forward to find domain part
  let offset = atPos + 1;
  if (offset >= end) {
    return 0;
  }

  let hasDot = false;
  let domainEnd = offset;

  while (offset < end) {
    const ch = input.charCodeAt(offset);
    const isAlphaNum = 
      (ch >= 48 && ch <= 57) || // 0-9
      (ch >= 65 && ch <= 90) ||  // A-Z
      (ch >= 97 && ch <= 122);   // a-z
    const isDot = ch === 46; // .
    const isHyphen = ch === 45; // -
    
    if (!isAlphaNum && !isDot && !isHyphen) {
      break;
    }
    
    if (isDot) {
      hasDot = true;
    }
    
    domainEnd = offset + 1;
    offset++;
  }

  // Domain must have at least one character and at least one dot
  if (domainEnd <= atPos + 1 || !hasDot) {
    return 0;
  }

  // Check character after domain (if any)
  if (domainEnd < end) {
    const nextChar = input.charCodeAt(domainEnd);
    const isAlphaNum = 
      (nextChar >= 48 && nextChar <= 57) || // 0-9
      (nextChar >= 65 && nextChar <= 90) ||  // A-Z
      (nextChar >= 97 && nextChar <= 122);   // a-z
    const isHyphenOrUnderscore = nextChar === 45 /* - */ || nextChar === 95 /* _ */;
    
    if (isAlphaNum || isHyphenOrUnderscore) {
      return 0; // Invalid: followed by alphanumeric, hyphen, or underscore
    }
  }

  // Domain must not end with hyphen
  const lastDomainChar = input.charCodeAt(domainEnd - 1);
  if (lastDomainChar === 45 /* - */) {
    return 0;
  }

  // Calculate total length including the part before @
  const totalLength = domainEnd - localStart;
  
  // Return token with length and offset adjustment
  // Note: this scanner is unique in that it includes characters before the trigger point
  // The caller needs to know where the token actually starts (at localStart, not atPos)
  // We'll encode this by returning the token, but the caller must handle positioning
  return EmailAutolink | totalLength;
}
