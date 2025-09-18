// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { scanEntity } from './scan-entity.js';
import { scanInlineText } from './scan-inline-text.js';
import { scanEscaped } from './scan-escaped.js';
import { scanBacktickInline } from './scan-backtick-inline.js';
import { scanFencedBlock } from './scan-fences.js';
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
  let tokenCount = 0;
  let offset = startOffset;
  let atLineStart = true; // Track whether we're at the start of a line
  
  while (offset < endOffset) {
    const ch = input.charCodeAt(offset++);
    switch (ch) {
      case 10 /* \n */:
      case 0: {
        output.push(NewLine | 1 /* NewLine, length: 1 */);
        tokenCount++;
        atLineStart = true;
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
        atLineStart = true;
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
        atLineStart = false;
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
          atLineStart = false;
          continue;
        }
        // fallthrough to inline text if not recognized
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        atLineStart = false;
        continue;
      }

      case 96 /* ` backtick */: {
        // Check if we should try block fence first
        if (atLineStart || isAfterIndentation(output)) {
          const fenceTokens = scanFencedBlock(input, offset - 1, endOffset, output);
          if (fenceTokens > 0) {
            // Calculate how much input was consumed by the fence
            let fenceLength = 0;
            const fenceStart = output.length - fenceTokens;
            for (let i = fenceStart; i < output.length; i++) {
              fenceLength += getTokenLength(output[i]);
            }
            // We consumed the entire fence, so we're done scanning this input
            return tokenCount + fenceTokens;
          }
        }
        
        // Fall back to inline backtick handling
        const added = scanBacktickInline(input, offset - 1, endOffset, output);
        if (added === 0) {
          // nothing recognized; fall back to inline text handling
          tokenCount += scanInlineText(input, offset - 1, endOffset, output);
          atLineStart = false;
          continue;
        }

        // scanBacktickInline added tokens and in previous logic we returned
        // early after handling a backtick span. Mirror that: return tokenCount + added
        return tokenCount + added;
      }

      case 126 /* ~ tilde */: {
        // Check if we should try block fence
        if (atLineStart || isAfterIndentation(output)) {
          const fenceTokens = scanFencedBlock(input, offset - 1, endOffset, output);
          if (fenceTokens > 0) {
            // Calculate how much input was consumed by the fence
            let fenceLength = 0;
            const fenceStart = output.length - fenceTokens;
            for (let i = fenceStart; i < output.length; i++) {
              fenceLength += getTokenLength(output[i]);
            }
            // We consumed the entire fence, so we're done scanning this input
            return tokenCount + fenceTokens;
          }
        }
        
        // Fall back to inline text
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        atLineStart = false;
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
        // Don't change atLineStart - whitespace at line start is still line start
        continue;
      }

      default: {
        tokenCount += scanInlineText(input, offset - 1, endOffset, output);
        atLineStart = false;
      }
    }
  }

  return tokenCount;

  /**
   * Check if we're after acceptable indentation for a block fence
   * @param {import('./scan0.js').ProvisionalToken[]} tokens
   */
  function isAfterIndentation(tokens) {
    if (tokens.length === 0) return true;
    
    const lastToken = tokens[tokens.length - 1];
    const kind = getTokenKind(lastToken);
    
    // Allow up to 3 spaces of indentation
    if (kind === Whitespace) {
      const length = getTokenLength(lastToken);
      return length <= 3;
    }
    
    // If last token was newline, we're at line start
    return kind === NewLine;
  }
}
