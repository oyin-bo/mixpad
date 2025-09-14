// @ts-check

import { getTokenKind, getTokenLength } from './scan-core.js';
import { scanEntity } from './scan-entity.js';
import { scanInlineText } from './scan-inline-text.js';
import { NewLine, Whitespace } from './scan-tokens.js';

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
        output.push(NewLine | 1 /* NewLine, length: 1 */);
        tokenCount++;
        break;
      }

      case 13 /* \r */: {
        if (offset < endOffset && input.charCodeAt(offset) === 10 /* \n */) {
          offset++;
          output.push(NewLine | 2 /* NewLine, length: 2 */);
        } else {
          output.push(NewLine | 1 /* NewLine, length: 1 */);
        }
        tokenCount++;
        break;
      }

      case 38 /* & */: {
        // Try to parse an entity; scanEntity now returns a numeric ProvisionalToken
        // (flags in the upper bits, length in the lower 24 bits), or 0 when none.
        const entityToken = scanEntity(input, offset - 1, endOffset);
        if (entityToken !== 0) {
          const length = getTokenLength(entityToken);
          output.push(entityToken);
          tokenCount++;
          offset += length - 1;
        } else {
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        }
        continue;
      }

      case 9 /* \t */:
      case 32 /* space */: {
        // If latest token is exactly Whitespace, append to it, else emit new Whitespace token
        if (output.length > 0 && getTokenKind(output[output.length - 1]) === Whitespace) {
          output[output.length - 1]++; // Increment length (low bits)
        } else {
          output.push(Whitespace | 1 /* Whitespace, length: 1 */);
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
