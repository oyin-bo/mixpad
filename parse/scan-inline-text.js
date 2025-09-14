// @ts-check

import { getTokenKind, getTokenLength } from './scan-core.js';
import { InlineText, Whitespace } from './scan-tokens.js';

/**
 * Parse a range of text from the input string.
 * Returns increment of token count:
 *  -1 (merged into previous InlineText),
 *  0 (added to previous InlineText),
 *  +1 (new InlineText token)
 * @param {string} input
 * @param {number} offset
 * @param {number} endOffset
 * @param {import('./scan0').ProvisionalToken[]} output
 */
export function scanInlineText(input, offset, endOffset, output) {
  const INLINE_FLAG = InlineText;
  const WHITESPACE_FLAG = Whitespace;

  if (output.length > 1) {
    const last = output[output.length - 1];
    const lastFlags = getTokenKind(last);
    const prev = output[output.length - 2];
    const prevFlags = getTokenKind(prev);
    const prevLen = getTokenLength(prev);

    // previous token is a single InlineText, followed by a single Whitespace
    if (lastFlags === WHITESPACE_FLAG && prevFlags === INLINE_FLAG && prevLen === 1 && input.charCodeAt(offset - 2) === 32 /* space */) {
      output[output.length - 2]++; // Increment length of InlineText (low bits)
      output.pop(); // Remove Whitespace token
      // merge "word<space>word" into a single InlineText token
      return -1;
    }
  }

  if (output.length > 0 && getTokenKind(output[output.length - 1]) === INLINE_FLAG) {
    // add to existing InlineText token
    output[output.length - 1]++; // Increment length
    return 0;
  } else {
    // emit new InlineText token
    output.push(0x1000001 /* InlineText, length: 1 */);
    return +1;
  }
}
