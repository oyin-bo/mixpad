// @ts-check

import { scanBacktickInline } from './scan-backtick-inline.js';
import { getTokenFlags, getTokenKind, getTokenLength, isAsciiAlphaNum } from './scan-core.js';
import { scanEmphasis } from './scan-emphasis.js';
import { scanEntity } from './scan-entity.js';
import { scanEscaped } from './scan-escaped.js';
import { scanFencedBlock } from './scan-fences.js';
import { scanInlineText } from './scan-inline-text.js';
import { scanHTMLCData } from './scan-html-cdata.js';
import { scanHTMLComment } from './scan-html-comment.js';
import { scanHTMLDocType } from './scan-html-doctype.js';
import { scanHTMLRawText } from './scan-html-raw-text.js';
import { scanTextarea } from './scan-textarea.js';
import { scanHTMLTag, isRawTextElement } from './scan-html-tag.js';
import { scanXMLProcessingInstruction } from './scan-xml-pi.js';
import { scanBulletListMarker } from './scan-list-bullet.js';
import { scanOrderedListMarker } from './scan-list-ordered.js';
import { scanTaskListMarker } from './scan-list-task.js';
import { BacktickBoundary, InlineCode, InlineText, NewLine, Whitespace, HTMLTagName, HTMLTagClose, HTMLTagOpen } from './scan-tokens.js';
import { IsSafeReparsePoint, ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * ProvisionalToken: 32-bit packed representation.
 * Bits 0–15: length (16 bits, up to 65535 bytes per token)
 * Bits 16–25: kind (10 bits, up to 1024 token types)
 * Bits 29–30: flags (2 bits, up to 4 distinct flags)
 * Bits 26-28 and 31 are unused.
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
  
  // Track safe reparse points:
  // - Start at true to mark the first token at offset 0
  // - Set to true after blank line (NewLine followed by NewLine/Whitespace+NewLine)
  // - Set to false when in error recovery
  let nextTokenIsReparseStart = (startOffset === 0);
  
  // Track if we just saw a NewLine (to detect blank lines)
  let lastTokenWasNewLine = false;
  
  // Track if we're in an error recovery state
  let inErrorRecovery = false;
  
  /**
   * Helper to apply safe reparse point flag to the most recent token(s)
   * and update state tracking
   * @param {number} previousLength - Previous length of output array
   */
  function markTokensAndUpdateState(previousLength) {
    // Process all newly added tokens
    for (let i = previousLength; i < output.length; i++) {
      const token = output[i];
      
      // Apply safe reparse point flag to first new token if appropriate
      // Do this BEFORE checking error flags so error tokens can still be reparse points
      if (i === previousLength && nextTokenIsReparseStart && !inErrorRecovery) {
        output[i] = token | IsSafeReparsePoint;
      }
      
      // Reset the reparse flag after applying it
      if (i === previousLength) {
        nextTokenIsReparseStart = false;
      }
      
      // Check if this token has an error flag (after potentially applying reparse flag)
      const hasErrorFlag = (getTokenFlags(output[i]) & ErrorUnbalancedToken) !== 0;
      if (hasErrorFlag) {
        inErrorRecovery = true;
      }
      
      // Detect blank lines: NewLine followed by NewLine (or Whitespace + NewLine)
      const tokenKind = getTokenKind(token);
      if (tokenKind === NewLine) {
        if (lastTokenWasNewLine) {
          // Two consecutive NewLines = blank line, next token is a safe reparse point
          // Clear error recovery state on blank line
          nextTokenIsReparseStart = true;
          inErrorRecovery = false;
        }
        lastTokenWasNewLine = true;
      } else if (tokenKind === Whitespace) {
        // Whitespace doesn't break the NewLine sequence
        // Keep lastTokenWasNewLine as is
      } else {
        // Any other token breaks the NewLine sequence
        lastTokenWasNewLine = false;
      }
    }
    
    tokenCount = output.length;
  }
  while (offset < endOffset) {
    const ch = input.charCodeAt(offset++);

    switch (ch) {
      case 10 /* \n */:
      case 0: {
        const prevLen = output.length;
        output.push(NewLine | 1 /* NewLine, length: 1 */);
        markTokensAndUpdateState(prevLen);
        break;
      }

      case 13 /* \r */: {
        const prevLen = output.length;
        if (offset < endOffset && input.charCodeAt(offset) === 10 /* \n */) {
          offset++;
          output.push(NewLine | 2 /* NewLine, length: 2 */);
        } else {
          output.push(NewLine | 1 /* NewLine, length: 1 */);
        }
        markTokensAndUpdateState(prevLen);
        break;
      }

      case 38 /* & */: {
        // Try to parse an entity; scanEntity now returns a numeric ProvisionalToken
        // (flags in the upper bits, length in the lower 24 bits), or 0 when none.
        const prevLen = output.length;
        const entityToken = scanEntity(input, offset - 1, endOffset);
        if (entityToken !== 0) {
          const length = getTokenLength(entityToken);
          output.push(entityToken);
          markTokensAndUpdateState(prevLen);
          offset += length - 1;
        } else {
          const consumed = scanInlineText(input, offset - 1, endOffset, output);
          if (consumed > 0) {
            markTokensAndUpdateState(prevLen);
            offset += consumed - 1;
          }
        }
        continue;
      }

      case 92 /* backslash */: {
        // Try to parse an escape: consume '\' + following char when present
        const prevLen = output.length;
        const esc = scanEscaped(input, offset - 1, endOffset);
        if (esc !== 0) {
          const length = getTokenLength(esc);
          output.push(esc);
          markTokensAndUpdateState(prevLen);
          offset += length - 1;
          continue;
        }
        // fallthrough to inline text if not recognized
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 96 /* ` backtick */: {
        // Try fenced block first if we could be at line start
        const prevLen = output.length;
        const consumed = scanFencedBlock(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          return tokenCount; // Return after handling block fence
        }

        // delegate all backtick orchestration to scanBacktickInline which will
        // emit the provisional tokens (if any) and return consumed length.
        const consumedBacktick = scanBacktickInline(input, offset - 1, endOffset, output);
        if (consumedBacktick === 0) {
          // nothing recognized; fall back to inline text handling
          const consumed = scanInlineText(input, offset - 1, endOffset, output);
          if (consumed > 0) {
            markTokensAndUpdateState(prevLen);
            offset += consumed - 1;
          }
          continue;
        }

        // no need to update offset, we return immediately
        markTokensAndUpdateState(prevLen);
        return tokenCount;
      }

      case 126 /* ~ tilde */: {
        // Try fenced block first
        const prevLen = output.length;
        const consumedFence = scanFencedBlock(input, offset - 1, endOffset, output);
        if (consumedFence > 0) {
          markTokensAndUpdateState(prevLen);
          return tokenCount; // Return after handling block fence
        }

        // Try emphasis delimiter
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 42 /* * asterisk */: {
        // Try bullet list marker first
        const prevLen = output.length;
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += listConsumed - 1;
          continue;
        }
        
        // Try emphasis delimiter (Pattern B: returns consumed length)
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 95 /* _ underscore */: {
        const prevLen = output.length;
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumedEmphasis - 1;
          continue;
        }

        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 60 /* < less-than */: {
        // Try HTML/XML constructs with lookahead
        const prevLen = output.length;
        let htmlConsumed = 0;

        // Try comment: <!--
        if (offset < endOffset && input.charCodeAt(offset) === 33 /* ! */) {
          if (offset + 1 < endOffset && input.charCodeAt(offset + 1) === 45 /* - */ &&
              offset + 2 < endOffset && input.charCodeAt(offset + 2) === 45 /* - */) {
            htmlConsumed = scanHTMLComment(input, offset - 1, endOffset, output);
          } else if (offset + 1 < endOffset && input.charCodeAt(offset + 1) === 91 /* [ */) {
            // Try CDATA: <![CDATA[
            htmlConsumed = scanHTMLCData(input, offset - 1, endOffset, output);
          } else {
            // Try DOCTYPE: <!DOCTYPE
            htmlConsumed = scanHTMLDocType(input, offset - 1, endOffset, output);
          }
        } else if (offset < endOffset && input.charCodeAt(offset) === 63 /* ? */) {
          // Try XML PI: <?
          htmlConsumed = scanXMLProcessingInstruction(input, offset - 1, endOffset, output);
        } else {
          // Try HTML tag: < or </
          const outputLengthBefore = output.length;
          htmlConsumed = scanHTMLTag(input, offset - 1, endOffset, output);
          
          // Check if we just parsed an opening tag for a raw text element
          if (htmlConsumed > 0 && output.length > outputLengthBefore) {
            // Look for HTMLTagOpen token to check if this is an opening tag (not closing tag)
            let tagOpenToken = -1;
            let tagNameToken = -1;
            let tagNameIndex = -1;
            for (let i = outputLengthBefore; i < output.length; i++) {
              if (getTokenKind(output[i]) === HTMLTagOpen) {
                tagOpenToken = output[i];
              }
              if (getTokenKind(output[i]) === HTMLTagName) {
                tagNameToken = output[i];
                tagNameIndex = i;
              }
            }
            
            // Check if this is an opening tag (HTMLTagOpen length 1 for '<', not 2 for '</')
            // and ends with HTMLTagClose (not self-closing)
            if (tagOpenToken >= 0 && getTokenLength(tagOpenToken) === 1 && 
                tagNameToken >= 0 && output.length > 0) {
              const lastToken = output[output.length - 1];
              if (getTokenKind(lastToken) === HTMLTagClose) {
                // Calculate actual position of tag name
                let actualOffset = offset - 1;
                for (let i = outputLengthBefore; i < tagNameIndex; i++) {
                  actualOffset += getTokenLength(output[i]);
                }
                
                const tagNameLength = getTokenLength(tagNameToken);
                
                // Check if it's a raw text element (no allocation!)
                if (isRawTextElement(input, actualOffset, tagNameLength)) {
                  // Scan raw text content
                  const rawTextStart = offset - 1 + htmlConsumed;
                  if (input.substring(actualOffset, actualOffset + tagNameLength).toLowerCase() === 'textarea') {
                    const rawTextConsumed = scanTextarea(input, rawTextStart, endOffset, actualOffset, tagNameLength, output);
                    htmlConsumed += rawTextConsumed;
                  } else {
                    const rawTextConsumed = scanHTMLRawText(input, rawTextStart, endOffset, actualOffset, tagNameLength, output);
                    htmlConsumed += rawTextConsumed;
                  }
                }
              }
            }
          }
        }

        if (htmlConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += htmlConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 9 /* \t */:
      case 32 /* space */: {
        const prevLen = output.length;
        // If latest token is exactly Whitespace, append to it, else emit new Whitespace token
        if (output.length > 0 && getTokenKind(output[output.length - 1]) === Whitespace) {
          output[output.length - 1]++; // Increment length (low bits)
        } else {
          output.push(Whitespace | 1 /* Whitespace, length: 1 */);
        }
        markTokensAndUpdateState(prevLen);
        continue;
      }

      case 45 /* - hyphen-minus */: {
        // Try bullet list marker
        const prevLen = output.length;
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 43 /* + plus */: {
        // Try bullet list marker
        const prevLen = output.length;
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 48: // 0
      case 49: // 1
      case 50: // 2
      case 51: // 3
      case 52: // 4
      case 53: // 5
      case 54: // 6
      case 55: // 7
      case 56: // 8
      case 57: /* 9 */ {
        // Try ordered list marker
        const prevLen = output.length;
        const listConsumed = scanOrderedListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      case 91 /* [ left square bracket */: {
        // Try task list marker
        const prevLen = output.length;
        const taskConsumed = scanTaskListMarker(input, offset - 1, endOffset, output);
        if (taskConsumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += taskConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
        continue;
      }

      default: {
        const prevLen = output.length;
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          markTokensAndUpdateState(prevLen);
          offset += consumed - 1;
        }
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