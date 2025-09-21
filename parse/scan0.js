// @ts-check

import { scanBacktickInline } from './scan-backtick-inline.js';
import { getTokenFlags, getTokenKind, getTokenLength, isAsciiAlphaNum } from './scan-core.js';
import { scanEmphasis } from './scan-emphasis.js';
import { scanEntity } from './scan-entity.js';
import { scanEscaped } from './scan-escaped.js';
import { scanFencedBlock } from './scan-fences.js';
import { scanInlineText } from './scan-inline-text.js';
import { BacktickBoundary, InlineCode, InlineText, NewLine, Whitespace } from './scan-tokens.js';

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

      case 92 /* backslash */: {
        // Try to parse an escape: consume '\' + following char when present
        const esc = scanEscaped(input, offset - 1, endOffset);
        if (esc !== 0) {
          const length = getTokenLength(esc);
          output.push(esc);
          tokenCount++;
          offset += length - 1;
          continue;
        }
        // fallthrough to inline text if not recognized
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        continue;
      }

      case 96 /* ` backtick */: {
        // Try fenced block first if we could be at line start
        const tokensBefore = output.length;
        scanFencedBlock(input, offset - 1, endOffset, output);
        const fencedAdded = output.length - tokensBefore;

        if (fencedAdded > 0) {
          // no need to update offset, we return immediately
          tokenCount += fencedAdded;
          return tokenCount; // Return after handling block fence
        }

        // delegate all backtick orchestration to scanBacktickInline which will
        // emit the provisional tokens (if any) and return how many were added.
        const tokensBeforeBacktick = output.length;
        scanBacktickInline(input, offset - 1, endOffset, output);
        const added = output.length - tokensBeforeBacktick;

        if (added === 0) {
          // nothing recognized; fall back to inline text handling
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
          continue;
        }

        // no need to update offset, we return immediately
        tokenCount += added;
        return tokenCount;
      }

      case 126 /* ~ tilde */: {
        // Try fenced block first
        const tokensBeforeFence = output.length;
        scanFencedBlock(input, offset - 1, endOffset, output);
        const fencedAdded = output.length - tokensBeforeFence;
        if (fencedAdded > 0) {
          tokenCount += fencedAdded;
          return tokenCount; // Return after handling block fence
        }

        // Try emphasis delimiter
        const tokensBeforeEmphasis = output.length;
        scanEmphasis(input, offset - 1, endOffset, output);
        const addedEmphasis = output.length - tokensBeforeEmphasis;
        if (addedEmphasis > 0) {
          tokenCount += addedEmphasis;
          let consumedLength = 0;
          for (let i = tokensBeforeEmphasis; i < output.length; i++) {
            consumedLength += getTokenLength(output[i]);
          }
          offset += consumedLength - 1;
          continue;
        }

        // Fall back to inline text
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        continue;
      }

      case 42 /* * asterisk */: {
        // Try emphasis delimiter (new API: may push tokens into output)
        {
          const addedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
          if (addedEmphasis > 0) {
            tokenCount += addedEmphasis;
            const lastToken = output[output.length - 1];
            offset += getTokenLength(lastToken) - 1;
            continue;
          }
        }

        // Fall back to inline text
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        continue;
      }

      case 95 /* _ underscore */: {
        const addedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (addedEmphasis > 0) {
          tokenCount += addedEmphasis;
          const lastToken = output[output.length - 1];
          offset += getTokenLength(lastToken) - 1;
          continue;
        }

        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
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

/**
 * Facility useful to be used in 'Watch' expressions for step-by-step debugging.
 * @param {{
 *  input: string,
 *  offset: number,
 *  output: ProvisionalToken[],
 *  tokenCount: number
 * }} _
 */
function debugDumpTokens({ input, offset, output, tokenCount }) {
  const dmp = output.slice(0, tokenCount).map((t, i) => {
    const pre = !i ? 0 : output.slice(0, i).reduce((sum, a) => sum + getTokenLength(a), 0);
    return input.slice(pre, pre + getTokenLength(t)) + ':' + getTokenKind(t) + (getTokenFlags(t) !== 0 ? ' (' + getTokenFlags(t) + ')' : '');
  }).concat(['<' + input.charAt(offset) + '>']);

  return dmp;
}