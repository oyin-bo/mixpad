// @ts-check

import { isAlphaNum } from './scan0.js';

/**
 * Try to parse an entity starting at `start` (expected to point at '&').
 * If a valid entity is found that ends with a semicolon, return its total length
 * (including the leading '&' and trailing ';'), otherwise return 0.
 *
 * Supports:
 *  - Named entities: &name;
 *  - Decimal numeric entities: &#1234;
 *  - Hex numeric entities: &#x1A3F; or &#X1A3F;
 *
 * Note: This is a conservative parser that requires the terminating ';'.
 *
 * @param {string} input
 * @param {number} start  Index of '&'
 * @param {number} end  Exclusive end index to not read past buffer
 * @returns {import('./scan0.js').ProvisionalToken} object with length and token kind, or null if not a valid entity
 */
export function scanEntity(input, start, end) {
  if (start < 0 || start >= end) return 0;
  if (input.charCodeAt(start) !== 38 /* & */) return 0;

  let offset = start + 1;
  if (offset >= end) return 0;

  const ch = input.charCodeAt(offset);

  // Numeric entity: &#... or &#x...
  if (ch === 35 /* # */) {
    offset++;
    if (offset >= end) return 0;

    // hex?
    const cc = input.charCodeAt(offset);
    let isHex = false;
    if (cc === 120 /* x */ || cc === 88 /* X */) {
      isHex = true;
      offset++;
      if (offset >= end) return 0;
    }

    const digitsStart = offset;
    while (offset < end) {
      const d = input.charCodeAt(offset);
      if (isHex) {
        const isHexDigit = (d >= 48 && d <= 57) || (d >= 65 && d <= 70) || (d >= 97 && d <= 102);
        if (!isHexDigit) break;
      } else {
        if (!(d >= 48 && d <= 57)) break;
      }
      offset++;
    }

    // require at least one digit
    if (offset === digitsStart) return 0;
    // require terminating semicolon
    if (offset < end && input.charCodeAt(offset) === 59 /* ; */) {
      const length = offset - start + 1;
      const kind = isHex ? 0x5000000 /* EntityHex */ : 0x4000000 /* EntityDecimal */;
      return length | kind;
    }
    return 0;
  }

  // Named entity: &name;
  const nameStart = offset;
  while (offset < end) {
    const d = input.charCodeAt(offset);
    if (!isAlphaNum(d)) break;
    offset++;
  }

  // require at least one name character and a terminating semicolon
  if (offset === nameStart) return 0;
  if (offset < end && input.charCodeAt(offset) === 59 /* ; */) {
    const length = offset - start + 1;
    const kind = 0x3000000; /* EntityNamed */
    return length | kind;
  }

  return 0;
}