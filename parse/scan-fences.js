// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
import { FencedOpen, FencedContent, FencedClose } from './scan-tokens.js';

/**
 * Scan for a fenced code block starting at the given position.
 * This function scans the entire fenced block and returns how many tokens were emitted.
 * The caller (scan0) should advance its offset by the total length of consumed input.
 * 
 * @param {string} input
 * @param {number} startOffset - position where fence character starts
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} number of tokens pushed into output (0 if not a fence)
 */
export function scanFencedBlock(input, startOffset, endOffset, output) {
  if (startOffset >= endOffset) return 0;
  
  const ch = input.charCodeAt(startOffset);
  if (ch !== 96 /* ` */ && ch !== 126 /* ~ */) return 0;
  
  // Count the opening fence run
  let pos = startOffset;
  while (pos < endOffset && input.charCodeAt(pos) === ch) {
    pos++;
  }
  
  const openLength = pos - startOffset;
  
  // Require minimum 3 chars for a fence
  if (openLength < 3) return 0;
  
  // Consume info string until end of line
  let infoStart = pos;
  
  // Skip optional leading space
  if (pos < endOffset && input.charCodeAt(pos) === 32 /* space */) {
    pos++;
  }
  
  // Find end of info string (until newline)
  while (pos < endOffset) {
    const c = input.charCodeAt(pos);
    if (c === 10 /* \n */ || c === 13 /* \r */) break;
    pos++;
  }
  
  const infoLength = pos - infoStart;
  
  // Skip the newline after info string
  if (pos < endOffset) {
    const c = input.charCodeAt(pos);
    if (c === 13 /* \r */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 10 /* \n */) {
      pos += 2; // CRLF
    } else if (c === 10 /* \n */ || c === 13 /* \r */) {
      pos += 1; // LF or CR
    }
  }
  
  const contentStart = pos;
  
  // Now scan for closing fence
  let closingStart = -1;
  let closingLength = 0;
  
  while (pos < endOffset) {
    // At start of a line, check for closing fence
    let lineStart = pos;
    let spaces = 0;
    
    // Count leading spaces (max 3)
    while (lineStart < endOffset && input.charCodeAt(lineStart) === 32 /* space */ && spaces < 3) {
      lineStart++;
      spaces++;
    }
    
    // Skip lines with too much indentation or tabs
    if (lineStart < endOffset && (spaces >= 3 || input.charCodeAt(lineStart) === 9 /* \t */)) {
      // Skip to next line
      while (pos < endOffset) {
        const c = input.charCodeAt(pos);
        pos++;
        if (c === 10 /* \n */ || (c === 13 /* \r */ && pos < endOffset && input.charCodeAt(pos) !== 10)) {
          break;
        } else if (c === 13 /* \r */ && pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) {
          pos++; // skip LF in CRLF
          break;
        }
      }
      continue;
    }
    
    // Check if this could be a closing fence
    if (lineStart < endOffset && input.charCodeAt(lineStart) === ch) {
      // Count closing fence run
      let fenceEnd = lineStart;
      while (fenceEnd < endOffset && input.charCodeAt(fenceEnd) === ch) {
        fenceEnd++;
      }
      
      const fenceLen = fenceEnd - lineStart;
      
      // Valid closer if length >= opening length
      if (fenceLen >= openLength) {
        // Check that nothing follows except whitespace
        let afterFence = fenceEnd;
        let validCloser = true;
        while (afterFence < endOffset) {
          const c = input.charCodeAt(afterFence);
          if (c === 10 /* \n */ || c === 13 /* \r */) break;
          if (c !== 32 /* space */ && c !== 9 /* \t */) {
            validCloser = false;
            break;
          }
          afterFence++;
        }
        
        if (validCloser) {
          closingStart = lineStart;
          closingLength = fenceLen;
          break;
        }
      }
    }
    
    // Skip to next line
    while (pos < endOffset) {
      const c = input.charCodeAt(pos);
      pos++;
      if (c === 10 /* \n */ || (c === 13 /* \r */ && pos < endOffset && input.charCodeAt(pos) !== 10)) {
        break;
      } else if (c === 13 /* \r */ && pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) {
        pos++; // skip LF in CRLF
        break;
      }
    }
  }
  
  // Emit tokens
  if (closingStart >= 0) {
    // Balanced fence
    const contentLength = closingStart - contentStart;
    
    // FencedOpen token includes the fence chars, info string, and trailing newline
    const openTokenLength = contentStart - startOffset;
    output.push(FencedOpen | openTokenLength);
    
    // FencedContent token (may be zero length)
    if (contentLength > 0) {
      output.push(FencedContent | contentLength);
    }
    
    // FencedClose token just the closing fence chars
    output.push(FencedClose | closingLength);
    
    return contentLength > 0 ? 3 : 2;
  } else {
    // Unbalanced fence (no closer found)
    const contentLength = endOffset - contentStart;
    const openTokenLength = contentStart - startOffset;
    
    // Emit tokens with fallback flag
    output.push(FencedOpen | ErrorUnbalancedTokenFallback | openTokenLength);
    
    if (contentLength > 0) {
      output.push(FencedContent | ErrorUnbalancedTokenFallback | contentLength);
      return 2;
    } else {
      return 1;
    }
  }
}