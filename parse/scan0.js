// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { scanEntity } from './scan-entity.js';
import { scanInlineText } from './scan-inline-text.js';
import { scanEscaped } from './scan-escaped.js';
import { scanBacktickInline } from './scan-backtick-inline.js';
import { NewLine, Whitespace, BacktickBoundary, InlineCode } from './scan-tokens.js';
import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';

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
    // const dmp = output.map((t, i) => {
    //   const pre = !i ? 0 : output.slice(0, i).reduce((sum, a) => sum + getTokenLength(a), 0);
    //   return input.slice(pre, pre + getTokenLength(t)) + ':' + getTokenKind(t) + (getTokenFlags(t) !== 0 ? ' (' + getTokenFlags(t) + ')' : '');
    // }).concat(['<' + input.charAt(offset) + '>']);

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
        // delegate all backtick orchestration to scanBacktickInline which will
        // emit the provisional tokens (if any) and return how many were added.
        const added = scanBacktickInline(input, offset - 1, endOffset, output);
        if (added === 0) {
          // nothing recognized; fall back to inline text handling
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
          continue;
        }

        // scanBacktickInline added tokens and in previous logic we returned
        // early after handling a backtick span. Mirror that: return tokenCount + added
        return tokenCount + added;
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
