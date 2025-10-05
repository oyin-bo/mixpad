// @ts-check

import { TaskListMarker } from './scan-tokens.js';

/**
 * Scan task list checkbox marker (GitHub extension)
 * 
 * Syntax: `[ ]`, `[x]`, `[X]` (checkbox, must be followed by space)
 * 
 * Rules:
 * - Must be `[` + (space OR x OR X) + `]`
 * - Must be followed by space or tab
 * - Should appear immediately after a bullet list marker
 * - Case-insensitive for x/X
 * 
 * Token encoding (31 bits):
 * - Bits 0-19: Length (always 3: '[', check, ']')
 * - Bits 20-23: Token type (TaskListMarker)
 * - Bits 28-31: Metadata:
 *   - Bit 28: Checked state (0 for unchecked, 1 for checked)
 *   - Bits 29-31: Reserved
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of '[')
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a task list marker
 */
export function scanTaskListMarker(input, start, end, output) {
  // Need at least 4 characters: [ + check + ] + space
  if (start + 3 >= end) return 0;
  
  // Must start with '['
  if (input.charCodeAt(start) !== 91) return 0; // not [
  
  // Check character: space (32), x (120), or X (88)
  const check = input.charCodeAt(start + 1);
  const isChecked = (check === 120 || check === 88); // x or X
  const isUnchecked = (check === 32); // space
  
  if (!isChecked && !isUnchecked) return 0;
  
  // Must have ']'
  if (input.charCodeAt(start + 2) !== 93) return 0; // not ]
  
  // Must be followed by space or tab (validation only, not consumed)
  const next = input.charCodeAt(start + 3);
  if (next !== 32 && next !== 9) return 0;
  
  // Token length is just the bracket expression (3 chars)
  const length = 3;
  
  // Encode checked state in bit 28
  const checkedBit = isChecked ? (1 << 28) : 0;
  
  output.push(length | TaskListMarker | checkedBit);
  
  return length;
}

/**
 * Extract the checked state from a TaskListMarker token
 * @param {number} token - The token
 * @returns {boolean} True if checked, false if unchecked
 */
export function getTaskListChecked(token) {
  return ((token >> 28) & 1) === 1;
}
