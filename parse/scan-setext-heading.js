// @ts-check

import { SetextHeadingUnderline } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Check if next line is a valid Setext underline.
 * Does NOT allocate; scans via charCodeAt.
 * 
 * @param {string} input - The input text
 * @param {number} underlineStart - Index where underline line begins
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, depth: number, char: number, length: number, consumedLength: number }} Result object
 */
export function checkSetextUnderline(input, underlineStart, end) {
  if (underlineStart >= end) {
    return { isValid: false, depth: 0, char: 0, length: 0, consumedLength: 0 };
  }
  
  const lineStart = findLineStart(input, underlineStart);
  const indent = countIndentation(input, lineStart, underlineStart);
  
  // Underline can have up to 3 spaces indent (4+ is code)
  if (indent > 3) {
    return { isValid: false, depth: 0, char: 0, length: 0, consumedLength: 0 };
  }
  
  // Check first character - must be = or -
  const firstChar = input.charCodeAt(underlineStart);
  if (firstChar !== 61 /* = */ && firstChar !== 45 /* - */) {
    return { isValid: false, depth: 0, char: 0, length: 0, consumedLength: 0 };
  }
  
  // Count how many = or - characters we have (all must be the same)
  let pos = underlineStart;
  let underlineLength = 0;
  while (pos < end && input.charCodeAt(pos) === firstChar) {
    underlineLength++;
    pos++;
  }
  
  // Must have at least 1 character (already checked above, but for clarity)
  if (underlineLength < 1) {
    return { isValid: false, depth: 0, char: 0, length: 0, consumedLength: 0 };
  }
  
  // After the underline chars, only spaces/tabs allowed until EOL
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      break;
    }
    if (ch !== 32 /* space */ && ch !== 9 /* tab */) {
      // Non-whitespace after underline = not valid
      return { isValid: false, depth: 0, char: 0, length: 0, consumedLength: 0 };
    }
    pos++;
  }
  
  // Calculate consumed length (including newline if present)
  let consumedLength = pos - lineStart;
  if (pos < end) {
    const ch = input.charCodeAt(pos);
    if (ch === 13 /* \r */ && pos + 1 < end && input.charCodeAt(pos + 1) === 10 /* \n */) {
      consumedLength += 2; // CRLF
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      consumedLength += 1; // LF or CR
    }
  }
  
  // Valid underline
  const depth = firstChar === 61 /* = */ ? 1 : 2;
  const totalLength = underlineStart - lineStart + underlineLength;
  
  return {
    isValid: true,
    depth: depth,
    char: firstChar,
    length: totalLength,
    consumedLength: consumedLength
  };
}

/**
 * Get underline character from SetextHeadingUnderline token
 * @param {number} token
 * @returns {'=' | '-'}
 */
export function getSetextUnderlineChar(token) {
  // We can derive from the token length or store separately
  // For now, return '=' as level 1 is more common
  // (This should be enhanced to actually encode the char in the token)
  return '=';
}
