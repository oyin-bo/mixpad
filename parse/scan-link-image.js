// @ts-check

import { ImageMarker, LinkClose, LinkDestClose, LinkDestOpen, LinkOpen } from './scan-tokens.js';

/**
 * Scan link open bracket `[` at `start`.
 *
 * @pattern complex - pushes token and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of `[`
 * @param {number} end - Exclusive end index
 * @param {number[]} output - Array to push provisional tokens into
 * @returns {number} characters consumed (1), or 0 if not a `[`
 */
export function scanLinkOpen(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 91 /* [ */) return 0;
  output.push(1 | LinkOpen);
  return 1;
}

/**
 * Scan link close bracket `]` at `start`.
 *
 * @pattern complex - pushes token and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of `]`
 * @param {number} end - Exclusive end index
 * @param {number[]} output - Array to push provisional tokens into
 * @returns {number} characters consumed (1), or 0 if not a `]`
 */
export function scanLinkClose(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 93 /* ] */) return 0;
  output.push(1 | LinkClose);
  return 1;
}

/**
 * Scan image marker `!` at `start`, only when immediately followed by `[`.
 * When `!` is not followed by `[`, returns 0 so the caller can fall back to inline text.
 *
 * @pattern complex - pushes token and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of `!`
 * @param {number} end - Exclusive end index
 * @param {number[]} output - Array to push provisional tokens into
 * @returns {number} characters consumed (1), or 0 if not `![`
 */
export function scanImageMarker(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 33 /* ! */) return 0;
  if (start + 1 >= end || input.charCodeAt(start + 1) !== 91 /* [ */) return 0;
  output.push(1 | ImageMarker);
  return 1;
}

/**
 * Scan link destination open parenthesis `(` at `start`.
 *
 * @pattern complex - pushes token and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of `(`
 * @param {number} end - Exclusive end index
 * @param {number[]} output - Array to push provisional tokens into
 * @returns {number} characters consumed (1), or 0 if not a `(`
 */
export function scanLinkDestOpen(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 40 /* ( */) return 0;
  output.push(1 | LinkDestOpen);
  return 1;
}

/**
 * Scan link destination close parenthesis `)` at `start`.
 *
 * @pattern complex - pushes token and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of `)`
 * @param {number} end - Exclusive end index
 * @param {number[]} output - Array to push provisional tokens into
 * @returns {number} characters consumed (1), or 0 if not a `)`
 */
export function scanLinkDestClose(input, start, end, output) {
  if (start >= end) return 0;
  if (input.charCodeAt(start) !== 41 /* ) */) return 0;
  output.push(1 | LinkDestClose);
  return 1;
}
