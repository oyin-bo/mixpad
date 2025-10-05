// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
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
 * @param {string} tagName - lowercase tag name (script, style, or textarea)
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLRawText(input, start, end, tagName, output) {
  const closingTag = '</' + tagName;
  const closingTagLower = closingTag.toLowerCase();
  
  let offset = start;
  let segmentStart = start;

  while (offset < end) {
    // Check for closing tag (case-insensitive)
    if (input.charCodeAt(offset) === 60 /* < */) {
      let match = true;
      let tempOffset = offset;
      
      for (let i = 0; i < closingTag.length; i++) {
        if (tempOffset >= end) {
          match = false;
          break;
        }
        const ch = input.charCodeAt(tempOffset);
        const expectedLower = closingTagLower.charCodeAt(i);
        const expectedUpper = expectedLower - 32; // Convert to uppercase
        
        if (ch !== expectedLower && ch !== expectedUpper) {
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
          // Found closing tag - emit any pending raw text
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
    if (input.charCodeAt(offset) === 38 /* & */) {
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
        continue;
      }
    }

    offset++;
  }

  // EOF without finding closing tag
  if (offset > segmentStart) {
    const rawLength = offset - segmentStart;
    output.push(rawLength | HTMLRawText | ErrorUnbalancedTokenFallback);
  }
  
  return offset - start;
}
