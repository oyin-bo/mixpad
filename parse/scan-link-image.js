// @ts-check

import { ImageMarker, LinkClose, LinkDestClose, LinkDestOpen, LinkOpen } from './scan-tokens.js';

/**
 * Scan a link open marker `[`, emitting a LinkOpen token of length 1.
 *
 * @pattern primitive - pushes one token (Pattern B)
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} always 1
 */
export function scanLinkOpen(output) {
  output.push(LinkOpen | 1);
  return 1;
}

/**
 * Scan a link close marker `]`, emitting a LinkClose token of length 1.
 *
 * @pattern primitive - pushes one token (Pattern B)
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} always 1
 */
export function scanLinkClose(output) {
  output.push(LinkClose | 1);
  return 1;
}

/**
 * Scan an image marker `!` only when immediately followed by `[`.
 * Emits an ImageMarker token of length 1 (covering only the `!`).
 * If `!` is not followed by `[`, returns 0 (caller falls back to inline text).
 *
 * @pattern primitive - pushes one token (Pattern B)
 * @param {string} input
 * @param {number} start - position of `!`
 * @param {number} end
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} 1 if ImageMarker emitted, 0 otherwise
 */
export function scanImageMarker(input, start, end, output) {
  if (start + 1 >= end || input.charCodeAt(start + 1) !== 91 /* [ */) return 0;
  output.push(ImageMarker | 1);
  return 1;
}

/**
 * Scan a link destination open marker `(`, emitting a LinkDestOpen token of length 1.
 *
 * @pattern primitive - pushes one token (Pattern B)
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} always 1
 */
export function scanLinkDestOpen(output) {
  output.push(LinkDestOpen | 1);
  return 1;
}

/**
 * Scan a link destination close marker `)`, emitting a LinkDestClose token of length 1.
 *
 * @pattern primitive - pushes one token (Pattern B)
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} always 1
 */
export function scanLinkDestClose(output) {
  output.push(LinkDestClose | 1);
  return 1;
}
