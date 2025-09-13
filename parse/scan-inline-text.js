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
  // Mask for the high-byte flags (flags live in bits 24..31)
  const FLAG_MASK = 0xff000000;
  const INLINE_FLAG = 0x1000000;
  const WHITESPACE_FLAG = 0x2000000;

  if (output.length > 1) {
    const last = output[output.length - 1];
    const lastFlags = last & FLAG_MASK;
    const prev = output[output.length - 2];
    const prevFlags = prev & FLAG_MASK;
    const prevLen = prev & 0xffffff;

    // previous token is a single InlineText, followed by a single Whitespace
    if (lastFlags === WHITESPACE_FLAG && prevFlags === INLINE_FLAG && prevLen === 1 && input.charCodeAt(offset - 2) === 32 /* space */) {
      output[output.length - 2]++; // Increment length of InlineText
      output.pop(); // Remove Whitespace token
      // merge "word<space>word" into a single InlineText token
      return -1;
    }
  }

  if (output.length > 0 && ((output[output.length - 1] & FLAG_MASK) === INLINE_FLAG)) {
    // add to existing InlineText token
    output[output.length - 1]++; // Increment length
    return 0;
  } else {
    // emit new InlineText token
    output.push(0x1000001 /* InlineText, length: 1 */);
    return +1;
  }
}
