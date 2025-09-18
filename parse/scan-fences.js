// @ts-check

import { FencedOpen, FencedContent, FencedClose } from './scan-tokens.js';
import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';

/**
 * Scan for fenced code blocks starting with backticks (`) or tildes (~).
 * Must be at line start (or after up to 3 spaces) to be considered a block fence.
 * 
 * @param {string} input
 * @param {number} startOffset  index where input[startOffset] is fence char
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} count of tokens added to output
 */
export function scanFencedBlock(input, startOffset, endOffset, output) {
  if (startOffset >= endOffset) return 0;

  const fenceChar = input.charCodeAt(startOffset);
  if (fenceChar !== 96 /* ` */ && fenceChar !== 126 /* ~ */) return 0;

  // Check if we're at a valid line-start position (up to 3 leading spaces)
  const lineStartPos = findLineStart(input, startOffset);
  const leadingSpaces = startOffset - lineStartPos;
  if (leadingSpaces > 3) return 0; // Too much indentation, not a block fence

  // Count the fence run length
  let fenceLen = 0;
  let pos = startOffset;
  while (pos < endOffset && input.charCodeAt(pos) === fenceChar) {
    fenceLen++;
    pos++;
  }

  // Must have at least 3 fence characters
  if (fenceLen < 3) return 0;

  // Look for info string (everything until end of line)
  let infoEnd = pos;
  while (infoEnd < endOffset) {
    const ch = input.charCodeAt(infoEnd);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
    infoEnd++;
  }

  // Skip the newline(s) after opener - but keep it as part of content
  let contentStart = infoEnd;

  // Scan for closing fence
  const closeResult = findClosingFence(input, contentStart, endOffset, fenceChar, fenceLen);
  
  if (closeResult.found) {
    // Balanced fence: emit opener, content, closer
    output.push(FencedOpen | fenceLen);
    if (closeResult.contentLength > 0) {
      output.push(FencedContent | closeResult.contentLength);
    }
    output.push(FencedClose | closeResult.closeLength);
    return closeResult.contentLength > 0 ? 3 : 2;
  } else {
    // Unbalanced fence: emit opener and content with error flag
    output.push(FencedOpen | ErrorUnbalancedTokenFallback | fenceLen);
    if (closeResult.contentLength > 0) {
      output.push(FencedContent | ErrorUnbalancedTokenFallback | closeResult.contentLength);
    }
    return closeResult.contentLength > 0 ? 2 : 1;
  }
}

/**
 * Find the start of the current line (scan backwards to previous newline or start of input)
 * @param {string} input
 * @param {number} pos
 * @returns {number} position of line start
 */
function findLineStart(input, pos) {
  while (pos > 0) {
    const ch = input.charCodeAt(pos - 1);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      return pos;
    }
    pos--;
  }
  return 0; // Start of input
}

/**
 * Find a closing fence that matches the opener
 * @param {string} input
 * @param {number} contentStart
 * @param {number} endOffset
 * @param {number} fenceChar
 * @param {number} minFenceLen
 * @returns {{found: boolean, contentLength: number, closeLength?: number}}
 */
function findClosingFence(input, contentStart, endOffset, fenceChar, minFenceLen) {
  let pos = contentStart;

  while (pos < endOffset) {
    // Find start of next line, but remember where the newline is
    let newlinePos = -1;
    while (pos < endOffset) {
      const ch = input.charCodeAt(pos);
      if (ch === 10 /* \n */ || ch === 13 /* \r */) {
        newlinePos = pos;
        // Handle CRLF
        if (ch === 13 /* \r */ && pos + 1 < endOffset && 
            input.charCodeAt(pos + 1) === 10 /* \n */) {
          pos += 2;
        } else {
          pos += 1;
        }
        break;
      }
      pos++;
    }

    if (pos >= endOffset) break;

    // Now at start of a line, check for closing fence
    let linePos = pos;
    
    // Skip up to 3 leading spaces
    let spaceCount = 0;
    while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
      spaceCount++;
      linePos++;
    }
    
    // Check if we have fence characters at this position
    if (linePos < endOffset && input.charCodeAt(linePos) === fenceChar) {
      // Count the fence run
      let closeLen = 0;
      let fencePos = linePos;
      while (fencePos < endOffset && input.charCodeAt(fencePos) === fenceChar) {
        closeLen++;
        fencePos++;
      }

      // Valid closer if length >= opener length
      if (closeLen >= minFenceLen) {
        // Check that rest of line is empty or whitespace
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
        
        // If we got here with only whitespace, it's a valid closer
        if (validCloser) {
          // Content should include everything up to and including the newline before closer
          return {
            found: true,
            contentLength: newlinePos + 1 - contentStart,
            closeLength: closeLen
          };
        }
      }
    }
  }

  // No closing fence found - return content length to EOF
  return {
    found: false,
    contentLength: endOffset - contentStart
  };
}