// @ts-check

import { FrontmatterOpen, FrontmatterContent, FrontmatterClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * Frontmatter type constants (stored in bits 26-27 of the token)
 */
const FRONTMATTER_TYPE_YAML = 0;
const FRONTMATTER_TYPE_TOML = 1;
const FRONTMATTER_TYPE_JSON = 2;

/**
 * Scan front matter block (YAML, TOML, or JSON).
 * Front matter is only valid at the absolute start of the document (position 0).
 * 
 * YAML: --- ... ---
 * TOML: +++ ... +++
 * JSON: { ... }
 * 
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset - must be 0 for valid frontmatter
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
export function scanFrontmatter(input, startOffset, endOffset, output) {
  // Front matter is ONLY valid at absolute position 0
  if (startOffset !== 0) return 0;
  if (startOffset >= endOffset) return 0;

  const firstChar = input.charCodeAt(startOffset);
  
  // Check for YAML (---) or TOML (+++) or JSON ({)
  if (firstChar === 45 /* - */) {
    return scanYAMLorTOMLFrontmatter(input, startOffset, endOffset, output, 45, FRONTMATTER_TYPE_YAML);
  } else if (firstChar === 43 /* + */) {
    return scanYAMLorTOMLFrontmatter(input, startOffset, endOffset, output, 43, FRONTMATTER_TYPE_TOML);
  } else if (firstChar === 123 /* { */) {
    return scanJSONFrontmatter(input, startOffset, endOffset, output);
  }
  
  return 0;
}

/**
 * Scan YAML (---) or TOML (+++) front matter
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} fenceChar - 45 for -, 43 for +
 * @param {number} type - FRONTMATTER_TYPE_YAML or FRONTMATTER_TYPE_TOML
 * @returns {number}
 */
function scanYAMLorTOMLFrontmatter(input, startOffset, endOffset, output, fenceChar, type) {
  let pos = startOffset;
  
  // Count opening fence characters (must be exactly 3)
  let openLen = 0;
  while (pos < endOffset && input.charCodeAt(pos) === fenceChar) {
    openLen++;
    pos++;
  }
  
  // Must be exactly 3 characters
  if (openLen !== 3) return 0;
  
  // Track if there's a newline after the fence (to include in opening token length)
  let openingTotalLen = 3;
  
  // Must be followed by newline, space/tab, or EOF
  if (pos < endOffset) {
    const nextChar = input.charCodeAt(pos);
    // Allow newline, or spaces/tabs followed by newline
    if (nextChar === 10 /* \n */ || nextChar === 13 /* \r */) {
      // Valid - newline immediately after fence
      // Include newline in opening token
      if (nextChar === 13 /* \r */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 10 /* \n */) {
        openingTotalLen += 2; // CRLF
        pos += 2;
      } else {
        openingTotalLen += 1; // LF or CR
        pos += 1;
      }
    } else if (nextChar === 32 /* space */ || nextChar === 9 /* tab */) {
      // Allow trailing spaces/tabs, must find newline
      let tmpPos = pos;
      while (tmpPos < endOffset) {
        const ch = input.charCodeAt(tmpPos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) {
          // Found newline after spaces
          // Include spaces and newline in opening token
          const spaceCount = tmpPos - pos;
          openingTotalLen += spaceCount;
          if (ch === 13 /* \r */ && tmpPos + 1 < endOffset && input.charCodeAt(tmpPos + 1) === 10 /* \n */) {
            openingTotalLen += 2;
            pos = tmpPos + 2;
          } else {
            openingTotalLen += 1;
            pos = tmpPos + 1;
          }
          break;
        }
        if (ch !== 32 /* space */ && ch !== 9 /* tab */) return 0; // Invalid char after fence
        tmpPos++;
      }
      if (tmpPos >= endOffset) {
        // EOF after spaces - include spaces in opening token
        openingTotalLen += (tmpPos - pos);
        pos = tmpPos;
      }
    } else {
      // Invalid - content on same line as opening fence
      return 0;
    }
  }
  
  const contentStart = pos;
  
  // Scan for closing fence
  let closingPos = -1;
  let closingLen = 0;
  
  while (pos < endOffset) {
    // Check if we're at the start of a line
    const lineStart = pos;
    
    // Try to match closing fence at line start
    let fenceCount = 0;
    let testPos = pos;
    while (testPos < endOffset && input.charCodeAt(testPos) === fenceChar) {
      fenceCount++;
      testPos++;
    }
    
    // Check if this is a valid closing fence (exactly 3 characters)
    if (fenceCount === 3) {
      // Must be followed by newline, space/tab, or EOF
      let isValidCloser = false;
      if (testPos >= endOffset) {
        // EOF after fence - valid
        isValidCloser = true;
      } else {
        const afterFence = input.charCodeAt(testPos);
        if (afterFence === 10 /* \n */ || afterFence === 13 /* \r */) {
          isValidCloser = true;
        } else if (afterFence === 32 /* space */ || afterFence === 9 /* tab */) {
          // Trailing spaces - check rest of line
          let tmpPos = testPos;
          while (tmpPos < endOffset) {
            const ch = input.charCodeAt(tmpPos);
            if (ch === 10 /* \n */ || ch === 13 /* \r */) {
              isValidCloser = true;
              break;
            }
            if (ch !== 32 /* space */ && ch !== 9 /* tab */) break;
            tmpPos++;
          }
          if (tmpPos >= endOffset) isValidCloser = true; // EOF after spaces
        }
      }
      
      if (isValidCloser) {
        closingPos = lineStart;
        closingLen = 3;
        pos = testPos;
        
        // Include trailing newline/spaces in closing token length
        while (pos < endOffset) {
          const ch = input.charCodeAt(pos);
          if (ch === 10 /* \n */) {
            closingLen++;
            pos++;
            break;
          }
          if (ch === 13 /* \r */) {
            closingLen++;
            pos++;
            if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) {
              closingLen++;
              pos++;
            }
            break;
          }
          if (ch === 32 /* space */ || ch === 9 /* tab */) {
            closingLen++;
            pos++;
          } else {
            break;
          }
        }
        break;
      }
    }
    
    // Not a closing fence, advance to next line
    while (pos < endOffset) {
      const ch = input.charCodeAt(pos);
      pos++;
      if (ch === 10 /* \n */) break;
      if (ch === 13 /* \r */) {
        if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) pos++;
        break;
      }
    }
  }
  
  // Emit tokens
  const typeBits = (type & 0x3) << 26;
  
  if (closingPos >= 0) {
    // Balanced frontmatter
    output.push(FrontmatterOpen | typeBits | openingTotalLen);
    
    const contentLength = closingPos - contentStart;
    if (contentLength > 0) {
      output.push(FrontmatterContent | typeBits | contentLength);
    }
    
    output.push(FrontmatterClose | typeBits | closingLen);
    
    return pos - startOffset;
  } else {
    // Unbalanced - no closing fence found
    output.push(FrontmatterOpen | typeBits | ErrorUnbalancedToken | openingTotalLen);
    
    const contentLength = pos - contentStart;
    if (contentLength > 0) {
      output.push(FrontmatterContent | typeBits | ErrorUnbalancedToken | contentLength);
    }
    
    return pos - startOffset;
  }
}

/**
 * Scan JSON front matter ({ ... })
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number}
 */
function scanJSONFrontmatter(input, startOffset, endOffset, output) {
  let pos = startOffset;
  
  // Opening brace
  if (input.charCodeAt(pos) !== 123 /* { */) return 0;
  pos++;
  
  // Track opening token length (brace + newline if present)
  let openingTotalLen = 1;
  
  // Include newline after opening brace in the opening token
  if (pos < endOffset) {
    const ch = input.charCodeAt(pos);
    if (ch === 13 /* \r */ && pos + 1 < endOffset && input.charCodeAt(pos + 1) === 10 /* \n */) {
      openingTotalLen += 2;
      pos += 2;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      openingTotalLen += 1;
      pos += 1;
    }
  }
  
  const contentStart = pos;
  
  // Track brace balance to find closing }
  let braceDepth = 1;
  let inString = false;
  let escapeNext = false;
  let closingPos = -1;
  
  while (pos < endOffset && braceDepth > 0) {
    const ch = input.charCodeAt(pos);
    
    if (escapeNext) {
      escapeNext = false;
      pos++;
      continue;
    }
    
    if (ch === 92 /* \ */ && inString) {
      escapeNext = true;
      pos++;
      continue;
    }
    
    if (ch === 34 /* " */) {
      inString = !inString;
      pos++;
      continue;
    }
    
    if (!inString) {
      if (ch === 123 /* { */) {
        braceDepth++;
      } else if (ch === 125 /* } */) {
        braceDepth--;
        if (braceDepth === 0) {
          closingPos = pos;
        }
      }
    }
    
    pos++;
  }
  
  const typeBits = (FRONTMATTER_TYPE_JSON & 0x3) << 26;
  
  if (closingPos >= 0) {
    // Balanced
    output.push(FrontmatterOpen | typeBits | openingTotalLen);
    
    const contentLength = closingPos - contentStart;
    if (contentLength > 0) {
      output.push(FrontmatterContent | typeBits | contentLength);
    }
    
    // Closing token: brace + newline if present
    let closingLen = 1;
    pos = closingPos + 1; // After closing brace
    
    if (pos < endOffset) {
      const ch = input.charCodeAt(pos);
      if (ch === 10 /* \n */) {
        closingLen++;
        pos++;
      } else if (ch === 13 /* \r */) {
        closingLen++;
        pos++;
        if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) {
          closingLen++;
          pos++;
        }
      }
    }
    
    output.push(FrontmatterClose | typeBits | closingLen);
    
    return pos - startOffset;
  } else {
    // Unbalanced
    output.push(FrontmatterOpen | typeBits | ErrorUnbalancedToken | openingTotalLen);
    
    const contentLength = pos - contentStart;
    if (contentLength > 0) {
      output.push(FrontmatterContent | typeBits | ErrorUnbalancedToken | contentLength);
    }
    
    return pos - startOffset;
  }
}
