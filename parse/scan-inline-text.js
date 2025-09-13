// @ts-check

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
  if (output.length > 1 && // previous token is a single whitespace
    (output[output.length - 1] & 0x2000000) === 0x2000000 && (output[output.length - 2] & 0x1FFFFFF) === 0x1000001 &&
    input.charCodeAt(offset - 2) === 32 /* space */
  ) {
    output[output.length - 2]++; // Increment length of InlineText
    output.pop(); // Remove Whitespace token

    // this optimisation merges "word<space>word" into a single InlineText token
    return -1;
  }

  if (output.length > 0 && (output[output.length - 1] & 0x1000000) === 0x1000000) {
    // add to existing InlineText token
    output[output.length - 1]++; // Increment length
    return 0;
  } else {
    // emit new InlineText token
    output.push(0x1000001 /* InlineText, length: 1 */);
    return +1;
  }
}
