// @ts-check

import { SetextHeadingUnderline } from './scan-tokens.js';
import { countIndentation, findLineStart } from './scan-core.js';

// Module-level buffer (reused across all Setext pre-scans, non-reentrant)
let setextBuffer = [];

/**
 * Check if next line is a valid Setext underline.
 * Does NOT allocate; scans via charCodeAt.
 * 
 * Setext underlines:
 * - All = characters (level 1) or all - characters (level 2)
 * - Minimum 1 character required
 * - Can have up to 3 spaces leading indentation
 * - Can have trailing spaces (ignored)
 * - Cannot be mixed (=-= is invalid)
 * 
 * @param {string} input - The input text
 * @param {number} underlineStart - Index where underline line begins
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, depth: number, consumedLength: number, underlineTokenLength: number, underlineChar: number }} Result object
 */
export function checkSetextUnderline(input, underlineStart, end) {
  if (underlineStart >= end) {
    return { isValid: false, depth: 0, consumedLength: 0, underlineTokenLength: 0, underlineChar: 0 };
  }
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, underlineStart);
  const lineIndent = countIndentation(input, lineStart, underlineStart);
  if (lineIndent > 3) {
    return { isValid: false, depth: 0, consumedLength: 0, underlineTokenLength: 0, underlineChar: 0 };
  }
  
  // Underline must be first non-whitespace character on line
  if (lineStart + lineIndent !== underlineStart) {
    return { isValid: false, depth: 0, consumedLength: 0, underlineTokenLength: 0, underlineChar: 0 };
  }
  
  // Get first character - must be = or -
  const firstChar = input.charCodeAt(underlineStart);
  if (firstChar !== 61 /* = */ && firstChar !== 45 /* - */) {
    return { isValid: false, depth: 0, consumedLength: 0, underlineTokenLength: 0, underlineChar: 0 };
  }
  
  // Scan for all matching characters
  let pos = underlineStart;
  let underlineCount = 0;
  while (pos < end && input.charCodeAt(pos) === firstChar) {
    underlineCount++;
    pos++;
  }
  
  // Skip trailing spaces
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Must reach newline or EOF
  const ch = pos < end ? input.charCodeAt(pos) : 0;
  if (ch !== 0 && ch !== 10 /* \n */ && ch !== 13 /* \r */) {
    return { isValid: false, depth: 0, consumedLength: 0, underlineTokenLength: 0, underlineChar: 0 };
  }
  
  // Include newline in consumed length (for advancing the scanner)
  // but also calculate the underline token length (without newline)
  let consumedLength = pos - lineStart;
  const underlineTokenLength = pos - underlineStart; // Just the underline chars + trailing spaces
  if (ch === 13 && pos + 1 < end && input.charCodeAt(pos + 1) === 10) {
    consumedLength += 2;
  } else if (ch === 10 || ch === 13) {
    consumedLength++;
  }
  
  // Determine depth: 1 for =, 2 for -
  const depth = firstChar === 61 ? 1 : 2;
  
  return {
    isValid: true,
    depth: depth,
    consumedLength: consumedLength,
    underlineTokenLength: underlineTokenLength,
    underlineChar: firstChar
  };
}

/**
 * Flush buffered tokens to output array, applying heading depth if valid Setext.
 * Clears buffer for reuse.
 * 
 * @param {number[]} output - Main output token array
 * @param {number} depth - Heading depth (0 if not Setext, 1 or 2 if valid)
 */
export function flushSetextBuffer(output, depth) {
  for (let i = 0; i < setextBuffer.length; i++) {
    let token = setextBuffer[i];
    if (depth > 0) {
      // Apply heading depth to bits 26-28
      token = (token & ~(0x7 << 26)) | ((depth & 0x7) << 26);
    }
    output.push(token);
  }
  setextBuffer.length = 0; // Clear for reuse
}

/**
 * Add token to Setext buffer (during line pre-scan)
 * @param {number} token - Token to buffer
 */
export function bufferSetextToken(token) {
  setextBuffer.push(token);
}

/**
 * Get the current buffer (for testing or inspection)
 * @returns {number[]}
 */
export function getSetextBuffer() {
  return setextBuffer;
}

/**
 * Clear the Setext buffer
 */
export function clearSetextBuffer() {
  setextBuffer.length = 0;
}

/**
 * Get underline character from SetextHeadingUnderline token
 * @param {number} token
 * @returns {string} '=' or '-'
 */
export function getSetextUnderlineChar(token) {
  // Derive from depth: depth 1 = '=', depth 2 = '-'
  const depth = (token >> 26) & 0x7; // Extract bits 26-28
  return depth === 1 ? '=' : '-';
}
