// @ts-check

import { getTokenKind, getTokenLength, isAsciiAlphaNum, isPunctuation, isWhitespace } from './scan-core.js';
import {
  AsteriskDelimiter, EmphasisClose, EmphasisOpen, InlineText,
  StrikethroughClose, StrikethroughOpen, StrongClose, StrongOpen,
  TildeDelimiter, UnderscoreDelimiter
} from './scan-tokens.js';

/**
 * @typedef {number} SemanticToken
 */

/**
 * Resolve provisional tokens from scan0 into semantic tokens.
 * Performs text coalescing and emphasis pairing.
 *
 * Zero-allocation: uses growing parallel arrays for the delimiter stack and
 * operates entirely over numeric token values.
 *
 * @param {string} input - Original markdown text
 * @param {import('./scan0.js').ProvisionalToken[]} tokens - Provisional tokens from scan0
 * @param {number} tokenCount - Number of valid tokens in the array
 * @param {SemanticToken[]} output - Array to push resolved tokens into
 * @returns {number} Number of tokens pushed
 */
export function resolveSemanticTokens(input, tokens, tokenCount, output) {
  const startOut = output.length;

  // Delimiter stack — parallel arrays to avoid object allocation
  /** @type {number[]} */
  const delimKinds = [];
  /** @type {number[]} */
  const delimOutIdx = [];
  let numDelims = 0;

  let textOffset = 0;

  for (let i = 0; i < tokenCount; i++) {
    const token = tokens[i];
    const kind = getTokenKind(token);
    const length = getTokenLength(token);
    const offset = textOffset;
    textOffset += length;

    if (kind === InlineText) {
      // Coalesce with preceding InlineText token
      if (output.length > startOut && getTokenKind(output[output.length - 1]) === InlineText) {
        output[output.length - 1] += length;
      } else {
        output.push(token);
      }
      continue;
    }

    if (kind === AsteriskDelimiter || kind === UnderscoreDelimiter || kind === TildeDelimiter) {
      const beforeChar = offset > 0 ? input.charCodeAt(offset - 1) : 0;
      const afterChar = offset + length < input.length ? input.charCodeAt(offset + length) : 0;

      const beforeWS = isWhitespace(beforeChar);
      const afterWS = isWhitespace(afterChar);
      const beforeP = isPunctuation(beforeChar);
      const afterP = isPunctuation(afterChar);

      const isLeftFlanking = !afterWS && (!afterP || beforeWS || beforeP);
      const isRightFlanking = !beforeWS && (!beforeP || afterWS || afterP);

      let canOpen = isLeftFlanking;
      let canClose = isRightFlanking;

      if (kind === UnderscoreDelimiter) {
        // Underscore cannot open if preceded by an ASCII alphanumeric (intraword right-flanking)
        if (canOpen && isRightFlanking) canOpen = !isAsciiAlphaNum(beforeChar);
        // Underscore cannot close if followed by an ASCII alphanumeric (intraword left-flanking)
        if (canClose && isLeftFlanking) canClose = !isAsciiAlphaNum(afterChar);
      }

      let matched = false;

      if (canClose) {
        for (let j = numDelims - 1; j >= 0; j--) {
          if (delimKinds[j] !== kind) continue;

          const openerLen = getTokenLength(output[delimOutIdx[j]]);
          const closerLen = length;
          let openToken, closeToken;

          if (kind === TildeDelimiter) {
            // Strikethrough always uses exactly two characters per delimiter
            openToken = StrikethroughOpen | 2;
            closeToken = StrikethroughClose | 2;
          } else if (Math.min(openerLen, closerLen) >= 2) {
            // Two or more matching chars → strong emphasis (consume 2 chars each side)
            openToken = StrongOpen | 2;
            closeToken = StrongClose | 2;
          } else {
            // Single matching char → regular emphasis (consume 1 char each side)
            openToken = EmphasisOpen | 1;
            closeToken = EmphasisClose | 1;
          }

          // Convert any unmatched openers between j+1 and numDelims-1 to InlineText
          for (let k = j + 1; k < numDelims; k++) {
            const idx = delimOutIdx[k];
            output[idx] = InlineText | getTokenLength(output[idx]);
          }

          output[delimOutIdx[j]] = openToken;
          output.push(closeToken);
          numDelims = j;
          matched = true;
          break;
        }
      }

      if (!matched) {
        if (canOpen) {
          if (numDelims >= delimKinds.length) {
            delimKinds.push(kind);
            delimOutIdx.push(output.length);
          } else {
            delimKinds[numDelims] = kind;
            delimOutIdx[numDelims] = output.length;
          }
          numDelims++;
          output.push(token);
        } else {
          // Not flanking in any useful direction: treat as plain text
          if (output.length > startOut && getTokenKind(output[output.length - 1]) === InlineText) {
            output[output.length - 1] += length;
          } else {
            output.push(InlineText | length);
          }
        }
      }
      continue;
    }

    // Pass all other tokens through unchanged
    output.push(token);
  }

  // Convert any remaining unmatched openers to InlineText
  for (let j = 0; j < numDelims; j++) {
    const idx = delimOutIdx[j];
    output[idx] = InlineText | getTokenLength(output[idx]);
  }

  // Coalesce adjacent InlineText tokens that may now be adjacent after
  // delimiter-to-InlineText conversion above
  let out = startOut;
  for (let i = startOut; i < output.length; i++) {
    const tok = output[i];
    if (getTokenKind(tok) === InlineText && out > startOut && getTokenKind(output[out - 1]) === InlineText) {
      output[out - 1] += getTokenLength(tok);
    } else {
      output[out++] = tok;
    }
  }
  output.length = out;

  return out - startOut;
}

/**
 * Scan ahead producing provisional tokens, until a decisive resolution point reached.
 * The last token may carry flags reporting what kind of resolution was reached.
 * @param {{
 *  input: string,
 *  startOffset: number,
 *  endOffset: number
 * }} _
 */
export function semantic({ input, startOffset, endOffset }) {

  return scan;

  /** @param {SemanticToken[]} output */
  function scan(output) {

  }
}