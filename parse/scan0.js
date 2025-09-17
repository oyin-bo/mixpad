// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { scanEntity } from './scan-entity.js';
import { scanInlineText } from './scan-inline-text.js';
import { scanEscaped } from './scan-escaped.js';
import { scanBacktickOpen, scanInlineCode, scanBacktickClose } from './scan-backtick-inline.js';
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
        // 1) scanBacktickOpen -> BacktickBoundary token (or 0)
        const openBacktickTok = scanBacktickOpen(input, offset - 1, endOffset);
        if (!openBacktickTok) {
          // fall back to inline text handling
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
          continue;
        }

        const openLen = getTokenLength(openBacktickTok);
        // 2) attempt to parse inline code content using opening run length
        const inlineTok = scanInlineCode(input, offset + openLen - 1, endOffset, openLen);

        if (getTokenFlags(inlineTok) & ErrorUnbalancedTokenFallback) {
          // unterminated fallback:
          // - either followed by unbalanced backtick closure,
          // - or it's just an unclosed backtick run

          const closingBacktickTok = scanBacktickOpen(
            input,
            offset - 1 + getTokenLength(openBacktickTok) + getTokenLength(inlineTok),
            endOffset
          );

          if (closingBacktickTok) {
            // found a closing run, but it's unbalanced

            // produce tokens in order: BacktickBoundary (open), InlineCode, BacktickBoundary (close)
            output.push(openBacktickTok | ErrorUnbalancedTokenFallback);
            tokenCount++;

            output.push(inlineTok);
            tokenCount++;
            
            output.push(closingBacktickTok | ErrorUnbalancedTokenFallback);
            tokenCount++;
          } else {
            // produce tokens in order: BacktickBoundary (open), InlineCode
            // (no closing BacktickBoundary)

            output.push(openBacktickTok | ErrorUnbalancedTokenFallback);
            tokenCount++;
            
            output.push(inlineTok);
            tokenCount++;
          }

          // end of unbalanced handling
          return tokenCount;
        }

        // balanced case
        // 3) produce tokens in order: BacktickBoundary (open), InlineCode, BacktickBoundary (close)
        output.push(openBacktickTok);
        tokenCount++;

        output.push(inlineTok);
        tokenCount++;

        // closing run length is same as opening
        output.push(BacktickBoundary | openLen);
        tokenCount++;
        
        return tokenCount;
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
