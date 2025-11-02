// @ts-check

import { FrontmatterOpen, FrontmatterContent, FrontmatterClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * Frontmatter type identifiers stored in bits 26-27 of frontmatter tokens
 * @readonly
 * @enum {number}
 */
export const FrontmatterType = {
  YAML: 0,
  TOML: 1,
  JSON: 2
};

/**
 * Get frontmatter type from a FrontmatterOpen token
 * @param {number} token - FrontmatterOpen token
 * @returns {number} Frontmatter type (0=YAML, 1=TOML, 2=JSON)
 */
export function getFrontmatterType(token) {
  return (token >> 26) & 0x3;
}

/**
 * Get human-readable frontmatter type name from a FrontmatterOpen token
 * @param {number} token - FrontmatterOpen token
 * @returns {string} Type name: "YAML", "TOML", or "JSON"
 */
export function getFrontmatterTypeName(token) {
  const type = getFrontmatterType(token);
  switch (type) {
    case FrontmatterType.YAML: return 'YAML';
    case FrontmatterType.TOML: return 'TOML';
    case FrontmatterType.JSON: return 'JSON';
    default: return 'UNKNOWN';
  }
}

/**
 * Scan frontmatter at the absolute start of a document.
 * Supports YAML (---), TOML (+++), and JSON ({...}) formats.
 * Front matter is only valid at position 0 of the input.
 *
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset - must be 0 for valid frontmatter
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no frontmatter match
 */
export function scanFrontmatter(input, startOffset, endOffset, output) {
  // Front matter is only valid at absolute position 0
  if (startOffset !== 0) return 0;
  if (startOffset >= endOffset) return 0;

  const firstChar = input.charCodeAt(startOffset);

  // Detect frontmatter type by first character(s)
  if (firstChar === 45 /* - */) {
    // YAML frontmatter (---)
    return scanDelimitedFrontmatter(input, startOffset, endOffset, output, 45, FrontmatterType.YAML);
  } else if (firstChar === 43 /* + */) {
    // TOML frontmatter (+++)
    return scanDelimitedFrontmatter(input, startOffset, endOffset, output, 43, FrontmatterType.TOML);
  } else if (firstChar === 123 /* { */) {
    // JSON frontmatter ({...})
    return scanJSONFrontmatter(input, startOffset, endOffset, output);
  }

  return 0; // Not frontmatter
}

/**
 * Scan YAML (---) or TOML (+++) frontmatter with delimiter-based fences
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} delimiter - Character code: 45 for '-' (YAML) or 43 for '+' (TOML)
 * @param {number} type - Frontmatter type: 0=YAML, 1=TOML
 * @returns {number} characters consumed or 0 if no match
 */
function scanDelimitedFrontmatter(input, startOffset, endOffset, output, delimiter, type) {
  // Must start with exactly 3 delimiter characters
  if (startOffset + 3 > endOffset) return 0;
  if (input.charCodeAt(startOffset) !== delimiter) return 0;
  if (input.charCodeAt(startOffset + 1) !== delimiter) return 0;
  if (input.charCodeAt(startOffset + 2) !== delimiter) return 0;

  // Check what follows the opening fence
  let pos = startOffset + 3;
  
  // Must be followed by newline, space/tab, or EOF (not content on same line)
  if (pos < endOffset) {
    const nextChar = input.charCodeAt(pos);
    if (nextChar === 10 /* \n */) {
      pos++; // Consume newline
    } else if (nextChar === 13 /* \r */) {
      pos++;
      if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) {
        pos++; // Consume \r\n
      }
    } else if (nextChar === 32 /* space */ || nextChar === 9 /* tab */) {
      // Trailing spaces after fence are allowed, scan to newline
      while (pos < endOffset) {
        const ch = input.charCodeAt(pos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
        if (ch !== 32 && ch !== 9) return 0; // Non-whitespace after fence invalidates frontmatter
        pos++;
      }
      // Consume the newline
      if (pos < endOffset) {
        const ch = input.charCodeAt(pos);
        if (ch === 13 /* \r */) {
          pos++;
          if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) pos++;
        } else if (ch === 10 /* \n */) {
          pos++;
        }
      }
    } else {
      // Content on same line as opening fence invalidates frontmatter
      return 0;
    }
  }

  // Emit opening fence with type bits
  const typeBits = (type & 0x3) << 26;
  const openLength = pos - startOffset;
  output.push(FrontmatterOpen | typeBits | openLength);

  // Scan for content and closing fence
  const contentStart = pos;
  let contentEnd = contentStart;

  while (pos < endOffset) {
    const lineStart = pos;
    
    // Check for closing fence at line start
    if (pos + 3 <= endOffset &&
        input.charCodeAt(pos) === delimiter &&
        input.charCodeAt(pos + 1) === delimiter &&
        input.charCodeAt(pos + 2) === delimiter) {
      
      let closerEnd = pos + 3;
      let validCloser = true;

      if (closerEnd < endOffset) {
        const nextChar = input.charCodeAt(closerEnd);
        if (nextChar === 10 /* \n */) {
          closerEnd++;
        } else if (nextChar === 13 /* \r */) {
          closerEnd++;
          if (closerEnd < endOffset && input.charCodeAt(closerEnd) === 10 /* \n */) closerEnd++;
        } else if (nextChar === 32 /* space */ || nextChar === 9 /* tab */) {
          // Trailing spaces allowed
          while (closerEnd < endOffset) {
            const ch = input.charCodeAt(closerEnd);
            if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
            if (ch !== 32 && ch !== 9) {
              validCloser = false;
              break;
            }
            closerEnd++;
          }
          if (validCloser && closerEnd < endOffset) {
            const ch = input.charCodeAt(closerEnd);
            if (ch === 13 /* \r */) {
              closerEnd++;
              if (closerEnd < endOffset && input.charCodeAt(closerEnd) === 10 /* \n */) closerEnd++;
            } else if (ch === 10 /* \n */) {
              closerEnd++;
            }
          }
        } else {
          validCloser = false;
        }
      }

      if (validCloser) {
        // Found valid closer
        contentEnd = lineStart;
        
        // Emit content (may be empty)
        const contentLength = contentEnd - contentStart;
        if (contentLength > 0) {
          output.push(FrontmatterContent | typeBits | contentLength);
        }
        
        // Emit closing fence
        const closeLength = closerEnd - lineStart;
        output.push(FrontmatterClose | typeBits | closeLength);
        
        return closerEnd - startOffset;
      }
    }

    // Not a closer, advance to next line
    while (pos < endOffset) {
      const ch = input.charCodeAt(pos++);
      if (ch === 10 /* \n */) break;
      if (ch === 13 /* \r */) {
        if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) pos++;
        break;
      }
    }
  }

  // No closing fence found - emit error
  contentEnd = endOffset;
  const contentLength = contentEnd - contentStart;
  if (contentLength > 0) {
    output.push((FrontmatterContent | typeBits | contentLength) | ErrorUnbalancedToken);
  }
  
  return endOffset - startOffset;
}

/**
 * Scan JSON frontmatter ({...})
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
function scanJSONFrontmatter(input, startOffset, endOffset, output) {
  // Must start with {
  if (input.charCodeAt(startOffset) !== 123 /* { */) return 0;

  const FRONTMATTER_TYPE_JSON = FrontmatterType.JSON;
  const typeBits = (FRONTMATTER_TYPE_JSON & 0x3) << 26;

  let pos = startOffset + 1;
  
  // Emit opening brace with type bits
  output.push(FrontmatterOpen | typeBits | 1);

  // Track brace balance to find matching closer
  let braceDepth = 1;
  const contentStart = pos;
  let inString = false;
  let escapeNext = false;

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

    if (ch === 34 /* " */ && !escapeNext) {
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
          // Found closing brace
          const contentEnd = pos;
          const contentLength = contentEnd - contentStart;
          if (contentLength > 0) {
            output.push(FrontmatterContent | typeBits | contentLength);
          }
          
          // Emit closing brace (just the brace, not any following newline)
          pos++;  // Move past the }
          output.push(FrontmatterClose | typeBits | 1);
          
          return pos - startOffset;
        }
      }
    }

    pos++;
  }

  // No matching closer found - emit error
  const contentEnd = endOffset;
  const contentLength = contentEnd - contentStart;
  if (contentLength > 0) {
    output.push((FrontmatterContent | typeBits | contentLength) | ErrorUnbalancedToken);
  }
  
  return endOffset - startOffset;
}
