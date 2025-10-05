// @ts-check

import { BulletListMarker } from './scan-tokens.js';
import { findLineStart, countIndentation } from './scan-core.js';

/**
 * Scan bullet list marker: -, *, or +
 * 
 * Syntax: `- `, `* `, `+ ` (marker followed by at least one space or tab)
 * 
 * Rules:
 * - One of `-`, `*`, `+`
 * - Followed by at least one space (32) or tab (9)
 * - Can be indented up to 3 spaces from line start
 * - 4+ spaces of indentation = code block, not list
 * 
 * Token encoding (31 bits):
 * - Bits 0-19: Length (just the marker character, always 1)
 * - Bits 20-23: Token type (BulletListMarker)
 * - Bits 24-31: Metadata:
 *   - Bits 24-26: Marker character (45=-, 42=*, 43=+)
 *   - Bits 27-31: Reserved for flags
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of -, *, or +)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a bullet marker
 */
export function scanBulletListMarker(input, start, end, output) {
  if (start >= end) return 0;
  
  const char = input.charCodeAt(start);
  
  // Must be -, *, or +
  if (char !== 45 && char !== 42 && char !== 43) return 0;
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;
  
  // Marker must be first non-whitespace character on line
  // (lineStart + indentation should equal marker position)
  if (lineStart + lineIndent !== start) return 0;
  
  // Must be followed by space or tab
  if (start + 1 >= end) return 0;
  const next = input.charCodeAt(start + 1);
  if (next !== 32 && next !== 9) return 0;
  
  // Token length is just the marker character (1 byte)
  const length = 1;
  
  // Encode: length | type | marker_char
  // Token type is in bits 20-27 (0x0FF00000)
  // We store the marker character in bits 28-31 for later reference
  // Shift left by 28 to position in upper bits, but we only need 2 bits to distinguish -, *, +
  // Use bits 28-29: 0=-, 1=*, 2=+
  let markerBits = 0;
  if (char === 45) markerBits = 0 << 28;      // -
  else if (char === 42) markerBits = 1 << 28; // *
  else if (char === 43) markerBits = 2 << 28; // +
  
  output.push(length | BulletListMarker | markerBits);
  
  return length;
}

/**
 * Extract the marker character from a BulletListMarker token
 * @param {number} token - The token
 * @returns {number} Character code (45, 42, or 43)
 */
export function getBulletMarkerChar(token) {
  const bits = (token >> 28) & 0x3; // Extract bits 28-29
  if (bits === 0) return 45; // -
  if (bits === 1) return 42; // *
  return 43; // +
}
