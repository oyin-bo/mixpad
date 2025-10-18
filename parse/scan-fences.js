// @ts-check

import { FencedOpen, FencedContent, FencedClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * A simple, always-forward scanner for fenced code blocks.
 * It scans from the opener forward one time, captures the content span and
 * detects a valid closing fence. If no closer is found before `endOffset`,
 * it returns an unbalanced result that uses the same fallback pattern as
 * `scan-backtick-inline.js` (emit opener with ErrorUnbalancedToken
 * and content up to EOF).
 *
 * This implementation is intentionally straightforward: advance indices only,
 * avoid allocations, and never re-scan the same region twice.
 *
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset  index where input[startOffset] is fence char
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
export function scanFencedBlock(input, startOffset, endOffset, output) {
  if (startOffset >= endOffset) return 0;

  const fenceChar = input.charCodeAt(startOffset);
  if (fenceChar !== 96 /* ` */ && fenceChar !== 126 /* ~ */) return 0;

  // Verify line-start context allowing up to 3 leading spaces.
  const lineStart = findLineStart(input, startOffset);
  const leadingSpaces = startOffset - lineStart;
  if (leadingSpaces > 3) return 0;

  // Count opening run length
  let pos = startOffset;
  let openLen = 0;
  while (pos < endOffset && input.charCodeAt(pos) === fenceChar) {
    openLen++;
    pos++;
  }

  if (openLen < 3) return 0; // not a fence opener

  // info string runs until the first newline (or EOF). We include the info
  // line in the FencedContent span (this mirrors the project's existing
  // scanner behaviour where the info string is part of the content token).
  let infoPos = pos;
  while (infoPos < endOffset) {
    const ch = input.charCodeAt(infoPos);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
    infoPos++;
  }

  // contentStart should be immediately after the info line's newline so the
  // FencedContent token contains only the actual fenced code (tests expect
  // the info string to be excluded from the content token).
  let contentStart = pos;
  if (infoPos < endOffset) {
    const ch = input.charCodeAt(infoPos);
    if (ch === 13 /* \r */ && infoPos + 1 < endOffset && input.charCodeAt(infoPos + 1) === 10 /* \n */) {
      contentStart = infoPos + 2;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      contentStart = infoPos + 1;
    } else {
      // No newline after info (EOF), contentStart remains as pos (will lead to empty content)
      contentStart = pos;
    }
  }

  // Now scan forward line-by-line looking for a valid closing fence. This
  // follows the same strategy as the previous implementation: find the next
  // newline, advance to the start of the following line, and test that line
  // for a closer. `newlinePos` remembers the position of the newline that
  // precedes the line we are testing so that content length can be computed
  // as `newlinePos + 1 - contentStart` when a closer is found.
  let p = infoPos;
  while (p < endOffset) {
    let newlinePos = -1;
    while (p < endOffset) {
      const ch = input.charCodeAt(p);
      if (ch === 10 /* \n */ || ch === 13 /* \r */) {
        newlinePos = p;
        // advance p to the start of the next line (handle CRLF)
        if (ch === 13 /* \r */ && p + 1 < endOffset && input.charCodeAt(p + 1) === 10 /* \n */) {
          p += 2;
        } else {
          p += 1;
        }
        break;
      }
      p++;
    }

    if (p >= endOffset) break; // no more full lines to test

    // Now at the start of a line; skip up to 3 leading spaces
    let linePos = p;
    let spaceCount = 0;
    while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
      spaceCount++;
      linePos++;
    }

    // If we find a run of the fence char here, count it
    if (linePos < endOffset && input.charCodeAt(linePos) === fenceChar) {
        // valid closer found
      let closeLen = 0;
      let fencePos = linePos;
      while (fencePos < endOffset && input.charCodeAt(fencePos) === fenceChar) {
        closeLen++;
        fencePos++;
      }

      if (closeLen >= openLen) {
        // Ensure rest of line is only whitespace
        let validCloser = true;
        let checkPos = fencePos;
        while (checkPos < endOffset) {
          const nextCh = input.charCodeAt(checkPos);
          if (nextCh === 10 /* \n */ || nextCh === 13 /* \r */) break;
          if (nextCh !== 32 /* space */ && nextCh !== 9 /* \t */) {
            validCloser = false;
            break;
          }
          checkPos++;
        }

        if (validCloser) {
          // compute token lengths that cover the entire consumed input region
          // open token should span from the fence start to the start of content
          const openTokenLen = contentStart - startOffset;
          // content length: up to the newline that precedes the closing fence
          const contentLength = newlinePos + 1 - contentStart;

          // determine end of closing line (include newline if present)
          let closeLineEnd = checkPos;
          if (checkPos < endOffset) {
            const nc = input.charCodeAt(checkPos);
            if (nc === 13 /* \r */ && checkPos + 1 < endOffset && input.charCodeAt(checkPos + 1) === 10 /* \n */) {
              closeLineEnd = checkPos + 2;
            } else if (nc === 10 /* \n */ || nc === 13 /* \r */) {
              closeLineEnd = checkPos + 1;
            }
          }
          const closeTokenLen = closeLineEnd - linePos;

          output.push(FencedOpen | openTokenLen);
          if (contentLength > 0) output.push(FencedContent | contentLength);
          output.push(FencedClose | closeTokenLen);
          return closeLineEnd - startOffset;
        }
      }
    }
  }

  // No closing fence found before EOF: fallback to unbalanced behaviour.
  const contentLength = endOffset - contentStart;
  output.push(FencedOpen | ErrorUnbalancedToken | openLen);
  if (contentLength > 0) output.push(FencedContent | ErrorUnbalancedToken | contentLength);
  return endOffset - startOffset;
}

/**
 * Find the start of the current line (scan backwards to previous newline or start of input)
 * @param {string} input
 * @param {number} pos
 * @returns {number} position of line start
 */
function findLineStart(input, pos) {
  // scan backwards until previous CR or LF or start
  while (pos > 0) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) return pos;
    pos--;
  }
  return 0;
}
