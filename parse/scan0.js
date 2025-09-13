// @ts-check

import { scanEntity } from './scan-entity.js';
import { scanInlineText } from './scan-inline-text.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan ahead producing provisional tokens, until a decisive resolution point reached.
 * The last token may carry flags reporting what kind of resolution was reached.
 * @param {{
 *  input: string,
 *  startOffset: number,
 *  endOffset: number,
 *  output: ProvisionalToken[]
 * }} _
 * @return {number} The count of tokens pushed into output.
 */

export function scan0({
  input,
  startOffset, endOffset,
  output
}) {
  // mock implementation for now

  let tokenCount = 0;
  let offset = startOffset;
  while (offset < endOffset) {
    const ch = input.charCodeAt(offset++);
    switch (ch) {
      case 10 /* \n */:
      case 0: {
        output.push(0x1000001 /* NewLine, length: 1 */);
        tokenCount++;
        break;
      }

      case 13 /* \r */: {
        if (offset < endOffset && input.charCodeAt(offset) === 10 /* \n */) {
          offset++;
          output.push(0x1000002 /* NewLine, length: 2 */);
        } else {
          output.push(0x1000001 /* NewLine, length: 1 */);
        }
        tokenCount++;
        break;
      }

      case 38 /* & */: {
        // Try to parse an entity and get both its length and its token kind.
        const entityResult = scanEntity(input, offset - 1, endOffset);
        if (entityResult && entityResult.length > 0) {
          output.push(entityResult.kind | entityResult.length);
          tokenCount++;
          offset += entityResult.length - 1;
        } else {
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        }
        continue;
      }
 
      case 9 /* \t */:
      case 32 /* space */: {
        // TODO: if latest token is Whitespace, append to it, else emit new Whitespace token
        if (output.length > 0 && (output[output.length - 1] & 0x2000000) === 0x2000000) {
          output[output.length - 1] ++; // Increment length
        } else {
          output.push(0x2000001 /* Whitespace, length: 1 */);
          tokenCount++;
        }
        continue;
      }
 
      default: {
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
      }
    }
  }

  return tokenCount;
}

/** @param {number} ch */
export function isAlphaNum(ch) {
  return (
    (ch >= 65 /* A */ && ch <= 90 /* Z */) ||
    (ch >= 97 /* a */ && ch <= 122 /* z */) ||
    (ch >= 48 /* 0 */ && ch <= 57 /* 9 */)
  );
}

export const PARSE_TOKENS = {
  InlineText: 0x1000000,
  Whitespace: 0x2000000,
  NewLine: 0x1000000,
  EntityNamed: 0x3000000,
  EntityDecimal: 0x4000000,
  EntityHex: 0x5000000
};