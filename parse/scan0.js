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
import { scanHTMLTag, isRawTextElement } from './scan-html-tag.js';
import { scanXMLProcessingInstruction } from './scan-xml-pi.js';
import { scanBulletListMarker } from './scan-list-bullet.js';
import { scanOrderedListMarker } from './scan-list-ordered.js';
import { scanTaskListMarker } from './scan-list-task.js';
import { BacktickBoundary, InlineCode, InlineText, NewLine, Whitespace, HTMLTagName, HTMLTagClose, HTMLTagOpen } from './scan-tokens.js';

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
          const consumed = scanInlineText(input, offset - 1, endOffset, output);
          if (consumed > 0) {
            tokenCount = output.length;
            offset += consumed - 1;
          }
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
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 96 /* ` backtick */: {
        // Try fenced block first if we could be at line start
        const consumed = scanFencedBlock(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          return tokenCount; // Return after handling block fence
        }

        // delegate all backtick orchestration to scanBacktickInline which will
        // emit the provisional tokens (if any) and return consumed length.
        const consumedBacktick = scanBacktickInline(input, offset - 1, endOffset, output);
        if (consumedBacktick === 0) {
          // nothing recognized; fall back to inline text handling
          const consumed = scanInlineText(input, offset - 1, endOffset, output);
          if (consumed > 0) {
            tokenCount = output.length;
            offset += consumed - 1;
          }
          continue;
        }

        // no need to update offset, we return immediately
        tokenCount = output.length;
        return tokenCount;
      }

      case 126 /* ~ tilde */: {
        // Try fenced block first
        const consumedFence = scanFencedBlock(input, offset - 1, endOffset, output);
        if (consumedFence > 0) {
          tokenCount = output.length;
          return tokenCount; // Return after handling block fence
        }

        // Try emphasis delimiter
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 42 /* * asterisk */: {
        // Try bullet list marker first
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }
        
        // Try emphasis delimiter (Pattern B: returns consumed length)
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 95 /* _ underscore */: {
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 60 /* < less-than */: {
        // Try HTML/XML constructs with lookahead
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
                  const rawTextConsumed = scanHTMLRawText(input, rawTextStart, endOffset, actualOffset, tagNameLength, output);
                  htmlConsumed += rawTextConsumed;
                }
              }
            }
          }
        }

        if (htmlConsumed > 0) {
          tokenCount = output.length;
          offset += htmlConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
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

      case 45 /* - hyphen-minus */: {
        // Try bullet list marker
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 43 /* + plus */: {
        // Try bullet list marker
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
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
        const listConsumed = scanOrderedListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 91 /* [ left square bracket */: {
        // Try task list marker
        const taskConsumed = scanTaskListMarker(input, offset - 1, endOffset, output);
        if (taskConsumed > 0) {
          tokenCount = output.length;
          offset += taskConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      default: {
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          tokenCount = output.length;
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