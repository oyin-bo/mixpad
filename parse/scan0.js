// @ts-check

import { scanATXHeading } from './scan-atx-heading.js';
import { scanBacktickInline } from './scan-backtick-inline.js';
import { countIndentation, findLineStart, getTokenFlags, getTokenKind, getTokenLength, isAsciiAlphaNum } from './scan-core.js';
import { scanEmphasis } from './scan-emphasis.js';
import { scanEntity } from './scan-entity.js';
import { scanEscaped } from './scan-escaped.js';
import { scanFencedBlock } from './scan-fences.js';
import { scanFrontmatter } from './scan-frontmatter.js';
import { scanHTMLCData } from './scan-html-cdata.js';
import { scanHTMLComment } from './scan-html-comment.js';
import { scanHTMLDocType } from './scan-html-doctype.js';
import { scanHTMLRawText } from './scan-html-raw-text.js';
import { isRawTextElement, scanHTMLTag } from './scan-html-tag.js';
import { scanInlineText } from './scan-inline-text.js';
import { scanBulletListMarker } from './scan-list-bullet.js';
import { scanOrderedListMarker } from './scan-list-ordered.js';
import { scanTaskListMarker } from './scan-list-task.js';
import { bufferSetextToken, checkSetextUnderline, flushSetextBuffer } from './scan-setext-heading.js';
import { scanTablePipe } from './scan-table.js';
import { scanTextarea } from './scan-textarea.js';
import { ErrorUnbalancedToken, IsSafeReparsePoint } from './scan-token-flags.js';
import { BacktickBoundary, HTMLTagClose, HTMLTagName, HTMLTagOpen, InlineCode, InlineText, NewLine, SetextHeadingUnderline, Whitespace } from './scan-tokens.js';
import { scanXMLProcessingInstruction } from './scan-xml-pi.js';

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

  // Setext heading speculative parsing state
  let lineStartOffset = startOffset;
  let lineTokenStartIndex = 0;
  let lineCouldBeSetextText = true;

  // Check for frontmatter at absolute position 0
  if (startOffset === 0) {
    const frontmatterConsumed = scanFrontmatter(input, startOffset, endOffset, output);
    if (frontmatterConsumed > 0) {
      offset += frontmatterConsumed;
      tokenCount += output.length;
      // Update line tracking to skip past frontmatter
      lineStartOffset = offset;
      lineTokenStartIndex = output.length;
      lineCouldBeSetextText = false; // Next line after frontmatter can't be Setext text
    }
  }

  // Safe reparse point tracking
  // Initialize to true for the start of file (offset 0)
  let next_token_is_reparse_start = (startOffset === 0);
  let error_recovery_mode = false;

  // Are we buffering tokens for potential Setext?
  let isInSetextBufferMode = false;

  while (offset < endOffset) {
    // Record the index where the next token(s) will be added
    const tokenStartIndex = output.length;
    const shouldMarkAsReparsePoint = next_token_is_reparse_start && !error_recovery_mode;

    // Reset the flag; it will be set again if this token creates a safe boundary
    next_token_is_reparse_start = false;

    const ch = input.charCodeAt(offset++);

    switch (ch) {
      case 10 /* \n */:
      case 0: {
        // Before emitting newline, check if we should do Setext speculative parsing
        if (lineCouldBeSetextText && lineTokenStartIndex < output.length) {
          // This line could be Setext heading text
          // Look ahead to check if next line is a valid underline
          const nextLineStart = offset; // Position after the newline we're about to emit
          const setextCheck = checkSetextUnderline(input, nextLineStart, endOffset);

          if (setextCheck.isValid) {
            // Valid Setext underline found!
            // Apply depth to all tokens on the current line (from lineTokenStartIndex to current)
            const depth = setextCheck.depth;
            const depthBits = (depth & 0x7) << 26;
            for (let i = lineTokenStartIndex; i < output.length; i++) {
              output[i] = (output[i] & ~(0x7 << 26)) | depthBits;
            }

            // Emit the newline (without depth - newlines don't carry heading depth)
            output.push(NewLine | 1 /* NewLine, length: 1 */);
            tokenCount++;

            // Emit the Setext underline token (without newline)
            const underlineLength = setextCheck.underlineTokenLength;
            output.push(underlineLength | SetextHeadingUnderline | depthBits);
            tokenCount++;

            // Skip past the underline in the input (including newline)
            offset += setextCheck.consumedLength;

            // Reset line state for next line
            lineStartOffset = offset;
            lineTokenStartIndex = output.length;
            lineCouldBeSetextText = true;
            break;
          }
        }

        // Not a Setext heading (or line doesn't qualify) - emit newline normally
        output.push(NewLine | 1 /* NewLine, length: 1 */);
        tokenCount++;

        // Reset line state for next line
        lineStartOffset = offset;
        lineTokenStartIndex = output.length;
        lineCouldBeSetextText = true;
        break;
      }

      case 13 /* \r */: {
        // Similar logic for \r\n and \r
        const isLF = (offset < endOffset && input.charCodeAt(offset) === 10 /* \n */);
        const newlineLength = isLF ? 2 : 1;
        if (isLF) offset++;

        // Before emitting newline, check for Setext
        if (lineCouldBeSetextText && lineTokenStartIndex < output.length) {
          const nextLineStart = offset;
          const setextCheck = checkSetextUnderline(input, nextLineStart, endOffset);

          if (setextCheck.isValid) {
            // Apply depth to current line tokens
            const depth = setextCheck.depth;
            const depthBits = (depth & 0x7) << 26;
            for (let i = lineTokenStartIndex; i < output.length; i++) {
              output[i] = (output[i] & ~(0x7 << 26)) | depthBits;
            }

            // Emit newline
            output.push(NewLine | newlineLength);
            tokenCount++;

            // Emit underline token (without newline)
            const underlineLength = setextCheck.underlineTokenLength;
            output.push(underlineLength | SetextHeadingUnderline | depthBits);
            tokenCount++;

            // Skip underline (including newline)
            offset += setextCheck.consumedLength;

            // Reset line state
            lineStartOffset = offset;
            lineTokenStartIndex = output.length;
            lineCouldBeSetextText = true;
            break;
          }
        }

        // Not Setext - emit newline normally
        output.push(NewLine | newlineLength);
        tokenCount++;

        // Reset line state
        lineStartOffset = offset;
        lineTokenStartIndex = output.length;
        lineCouldBeSetextText = true;
        break;
      }

      case 38 /* & */: {
        // Try to parse an entity; scanEntity now returns a numeric ProvisionalToken
        // (flags in the upper bits, length in the lower 24 bits), or 0 when none.
        const entityToken = scanEntity(input, offset - 1, endOffset);
        if (entityToken !== 0) {
          const length = getTokenLength(entityToken);
          // Apply reparse flag if this is the first token after a safe boundary
          const flaggedToken = shouldMarkAsReparsePoint ? (entityToken | IsSafeReparsePoint) : entityToken;
          output.push(flaggedToken);
          tokenCount++;
          offset += length - 1;
        } else {
          const consumed = scanInlineText(input, offset - 1, endOffset, output);
          if (consumed > 0) {
            // Apply reparse flag to first token if needed
            if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
              output[tokenStartIndex] |= IsSafeReparsePoint;
            }
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
          // Fenced block detected - line cannot be Setext text
          lineCouldBeSetextText = false;
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
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
            // Apply reparse flag to first token if needed
            if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
              output[tokenStartIndex] |= IsSafeReparsePoint;
            }
            tokenCount = output.length;
            offset += consumed - 1;
          }
          continue;
        }

        // no need to update offset, we return immediately
        // Apply reparse flag to first token if needed
        if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
          output[tokenStartIndex] |= IsSafeReparsePoint;
        }
        tokenCount = output.length;
        return tokenCount;
      }

      case 126 /* ~ tilde */: {
        // Try fenced block first
        const consumedFence = scanFencedBlock(input, offset - 1, endOffset, output);
        if (consumedFence > 0) {
          // Fenced block detected - line cannot be Setext text
          lineCouldBeSetextText = false;
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          return tokenCount; // Return after handling block fence
        }

        // Try emphasis delimiter
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 42 /* * asterisk */: {
        // Try bullet list marker first
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Try emphasis delimiter (Pattern B: returns consumed length)
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 95 /* _ underscore */: {
        const consumedEmphasis = scanEmphasis(input, offset - 1, endOffset, output);
        if (consumedEmphasis > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumedEmphasis - 1;
          continue;
        }

        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
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
            if (htmlConsumed > 0) {
              // HTML comment at line start - disqualify from Setext
              lineCouldBeSetextText = false;
            }
          } else if (offset + 1 < endOffset && input.charCodeAt(offset + 1) === 91 /* [ */) {
            // Try CDATA: <![CDATA[
            htmlConsumed = scanHTMLCData(input, offset - 1, endOffset, output);
            if (htmlConsumed > 0) {
              lineCouldBeSetextText = false;
            }
          } else {
            // Try DOCTYPE: <!DOCTYPE
            htmlConsumed = scanHTMLDocType(input, offset - 1, endOffset, output);
            if (htmlConsumed > 0) {
              lineCouldBeSetextText = false;
            }
          }
        } else if (offset < endOffset && input.charCodeAt(offset) === 63 /* ? */) {
          // Try XML PI: <?
          htmlConsumed = scanXMLProcessingInstruction(input, offset - 1, endOffset, output);
          if (htmlConsumed > 0) {
            lineCouldBeSetextText = false;
          }
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
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += htmlConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
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

        // After emitting whitespace, check if this is the first token on the line
        // and if it represents 4+ spaces indentation (code block)
        if (lineTokenStartIndex === output.length - 1) {
          // This whitespace is the first token on the line
          const wsLength = getTokenLength(output[output.length - 1]);
          // Count spaces/tabs (tabs count as moving to next multiple of 4)
          const lineStart = lineStartOffset;
          const indentCount = countIndentation(input, lineStart, lineStart + wsLength);
          if (indentCount >= 4) {
            // 4+ spaces indentation = code block
            lineCouldBeSetextText = false;
          }
        }
        continue;
      }

      case 35 /* # hash */: {
        // Try ATX heading
        const headingConsumed = scanATXHeading(input, offset - 1, endOffset, output);
        if (headingConsumed > 0) {
          // ATX heading detected - line cannot be Setext text
          lineCouldBeSetextText = false;
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          return tokenCount; // Return after processing heading
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 45 /* - hyphen-minus */: {
        // Try bullet list marker
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          // List marker detected - line cannot be Setext text
          lineCouldBeSetextText = false;
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumed - 1;
        }
        continue;
      }

      case 43 /* + plus */: {
        // Try bullet list marker
        const listConsumed = scanBulletListMarker(input, offset - 1, endOffset, output);
        if (listConsumed > 0) {
          // List marker detected - line cannot be Setext text
          lineCouldBeSetextText = false;
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += listConsumed - 1;
          continue;
        }

        // Fall back to inline text
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
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
          // Ordered list marker detected - line cannot be Setext text
          lineCouldBeSetextText = false;
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
          // Task list marker detected - line cannot be Setext text
          lineCouldBeSetextText = false;
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

      case 124 /* | pipe */: {
        // Scan table pipe - the semantic phase will determine if this is part of a table
        const pipeConsumed = scanTablePipe(input, offset - 1, endOffset, output);
        if (pipeConsumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += pipeConsumed - 1;
          continue;
        }

        // Fall back to inline text if not recognized as table pipe
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // Apply reparse flag to first token if needed
          if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
            output[tokenStartIndex] |= IsSafeReparsePoint;
          }
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

    // Apply safe reparse point flag if needed (to the first token emitted in this iteration)
    if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
      output[tokenStartIndex] |= IsSafeReparsePoint;
    }

    // Check if we just emitted tokens that create a safe boundary
    // A safe boundary is created by a blank line pattern:
    // - NewLine followed by NewLine (blank line)
    // - NewLine followed by Whitespace followed by NewLine (blank line with spaces)
    if (output.length > tokenStartIndex) {
      const lastToken = output[output.length - 1];
      const lastTokenKind = getTokenKind(lastToken);
      const lastTokenFlags = getTokenFlags(lastToken);

      // Update error recovery mode based on last token
      if (lastTokenFlags & ErrorUnbalancedToken) {
        error_recovery_mode = true;
      }

      // Check for blank line pattern
      if (lastTokenKind === NewLine) {
        // Look at the token before the one we just emitted
        // (could be from a previous iteration)
        if (output.length >= 2) {
          const prevToken = output[output.length - 2];
          const prevTokenKind = getTokenKind(prevToken);

          // NewLine after NewLine or Whitespace = blank line
          if (prevTokenKind === NewLine || prevTokenKind === Whitespace) {
            // Only set reparse point if not in error recovery
            if (!error_recovery_mode) {
              next_token_is_reparse_start = true;
            }
          }
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