// @ts-check

import { scanEntity } from './scan-entity.js';
import { HTMLRawText } from './scan-tokens.js';
import { getTokenLength } from './scan-core.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan raw text content for script, style, or textarea elements.
 * This scanner tokenizes the content until it finds the appropriate closing tag.
 * Unlike regular text, this content is not parsed for Markdown or HTML tags,
 * but entities are still recognized.
 * 
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index after the opening tag's '>'
 * @param {number} end - Exclusive end
 * @param {number} tagNameStart - Start position of tag name in input
 * @param {number} tagNameLength - Length of tag name
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLRawText(input, start, end, tagNameStart, tagNameLength, output) {
  let offset = start;
  let segmentStart = start;
  let prevWasNewline = false;  // Track if previous non-space/tab was newline

  while (offset < end) {
    const ch = input.charCodeAt(offset);

    // Check for double newline (with possible whitespace between) recovery point
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      if (prevWasNewline) {
        // Double newline - recovery point
        if (offset > segmentStart) {
          const rawLength = offset - segmentStart;
          output.push(rawLength | HTMLRawText);
        }
        // Note: Opening tag will be flagged by scan-html-tag.js
        // Don't consume the newline - it will be parsed normally
        return offset - start;
      }
      prevWasNewline = true;
      offset++;
      continue;
    }

    // Check for closing tag (case-insensitive): '</', then tag name, then '>' or whitespace
    if (ch === 60 /* < */) {
      if (offset + 1 >= end || input.charCodeAt(offset + 1) !== 47 /* / */) {
        // Just a < but not closing tag - recovery point if flagged
        if (offset > segmentStart) {
          const rawLength = offset - segmentStart;
          output.push(rawLength | HTMLRawText);
        }
        // Recovery at < 
        // Note: Opening tag will be flagged by scan-html-tag.js
        // Don't consume the < - it will be parsed normally
        return offset - start;
      }
      
      // Check tag name match (case-insensitive)
      let tempOffset = offset + 2;
      let match = true;
      
      for (let i = 0; i < tagNameLength; i++) {
        if (tempOffset >= end) {
          match = false;
          break;
        }
        const tagCh = input.charCodeAt(tempOffset);
        const expectedCh = input.charCodeAt(tagNameStart + i);
        // Case-insensitive comparison
        const chLower = (tagCh >= 65 && tagCh <= 90) ? tagCh + 32 : tagCh;
        const expLower = (expectedCh >= 65 && expectedCh <= 90) ? expectedCh + 32 : expectedCh;
        
        if (chLower !== expLower) {
          match = false;
          break;
        }
        tempOffset++;
      }
      
      // After tag name, should be whitespace or '>'
      if (match && tempOffset < end) {
        const nextCh = input.charCodeAt(tempOffset);
        if (nextCh === 62 /* > */ || nextCh === 9 || nextCh === 32 || 
            nextCh === 10 || nextCh === 13) {
          // Found proper closing tag - emit any pending raw text
          if (offset > segmentStart) {
            const rawLength = offset - segmentStart;
            output.push(rawLength | HTMLRawText);
          }
          // Don't consume the closing tag - let the main scanner handle it
          return offset - start;
        }
      }
    }

    // Check for entity
    if (ch === 38 /* & */) {
      const entityToken = scanEntity(input, offset, end);
      if (entityToken !== 0) {
        // Emit any pending raw text before the entity
        if (offset > segmentStart) {
          const rawLength = offset - segmentStart;
          output.push(rawLength | HTMLRawText);
        }
        
        // Emit the entity token
        output.push(entityToken);
        
        const entityLength = getTokenLength(entityToken);
        offset += entityLength;
        segmentStart = offset;
        prevWasNewline = false;
        continue;
      }
    }

    // Reset newline flag if we encounter non-whitespace character
    if (ch !== 32 && ch !== 9) {
      prevWasNewline = false;
    }

    offset++;
  }

  // EOF without finding closing tag
  if (offset > segmentStart) {
    const rawLength = offset - segmentStart;
    output.push(rawLength | HTMLRawText);
  }
  // Note: Opening tag will be flagged by scan-html-tag.js
  return offset - start;
}
