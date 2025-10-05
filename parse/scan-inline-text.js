// @ts-check

import { getTokenKind, getTokenLength } from './scan-core.js';
import { InlineText, Whitespace } from './scan-tokens.js';

/**
 * Parse a range of text from the input string.
 * Tries to merge with or append to previous InlineText token if possible.
 * 
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} offset
 * @param {number} endOffset
 * @param {import('./scan0').ProvisionalToken[]} output
 * @returns {number} characters consumed (always 1)
 */
export function scanInlineText(input, offset, endOffset, output) {
  if (output.length > 1) {
    const last = output[output.length - 1];
    const lastFlags = getTokenKind(last);
    const lastLen = getTokenLength(last);
    const prev = output[output.length - 2];
    const prevFlags = getTokenKind(prev);

    // previous token is a single InlineText, followed by a single Whitespace
    // Check the character BEFORE the current one (which should be the whitespace)
    if (lastFlags === Whitespace && prevFlags === InlineText && lastLen === 1 && offset > 0 && input.charCodeAt(offset - 1) === 32 /* space */) {
      output[output.length - 2] += 2; // Increment length of InlineText (low bits)
      output.pop(); // Remove Whitespace token
      // merge "word<space>word" into a single InlineText token
      return 1;
    }
  }

  if (output.length > 0 && getTokenKind(output[output.length - 1]) === InlineText) {
    // add to existing InlineText token
    output[output.length - 1]++; // Increment length
    return 1;
  } else {
    // emit new InlineText token
    output.push(InlineText | 1 /* InlineText, length: 1 */);
    return 1;
  }
}
