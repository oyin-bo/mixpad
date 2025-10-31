// @ts-check

import { FrontmatterOpen, FrontmatterContent, FrontmatterClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

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
    // Potential YAML frontmatter (---)
    return scanYAMLFrontmatter(input, startOffset, endOffset, output);
  } else if (firstChar === 43 /* + */) {
    // Potential TOML frontmatter (+++)
    return scanTOMLFrontmatter(input, startOffset, endOffset, output);
  } else if (firstChar === 123 /* { */) {
    // Potential JSON frontmatter ({...})
    return scanJSONFrontmatter(input, startOffset, endOffset, output);
  }

  return 0; // Not frontmatter
}

/**
 * Scan YAML frontmatter (--- ... ---)
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
function scanYAMLFrontmatter(input, startOffset, endOffset, output) {
  // Must start with exactly --- (3 dashes)
  if (startOffset + 3 > endOffset) return 0;
  if (input.charCodeAt(startOffset) !== 45 /* - */) return 0;
  if (input.charCodeAt(startOffset + 1) !== 45 /* - */) return 0;
  if (input.charCodeAt(startOffset + 2) !== 45 /* - */) return 0;

  // Check what follows the opening ---
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
      // Trailing spaces after --- are allowed, scan to newline
      while (pos < endOffset) {
        const ch = input.charCodeAt(pos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
        if (ch !== 32 && ch !== 9) return 0; // Non-whitespace after --- invalidates frontmatter
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
      // Content on same line as opening --- invalidates frontmatter
      return 0;
    }
  }

  // Emit opening fence
  const openLength = pos - startOffset;
  output.push(FrontmatterOpen | openLength);

  // Scan for content and closing ---
  const contentStart = pos;
  let contentEnd = contentStart;
  let foundCloser = false;

  while (pos < endOffset) {
    // Check if we're at the start of a line that could be the closing fence
    const lineStart = pos;
    
    // Check for closing --- at line start
    if (pos + 3 <= endOffset &&
        input.charCodeAt(pos) === 45 /* - */ &&
        input.charCodeAt(pos + 1) === 45 /* - */ &&
        input.charCodeAt(pos + 2) === 45 /* - */) {
      
      // Verify it's followed by newline, space, or EOF
      let closerEnd = pos + 3;
      let validCloser = true;

      if (closerEnd < endOffset) {
        const nextChar = input.charCodeAt(closerEnd);
        if (nextChar === 10 /* \n */) {
          closerEnd++;
        } else if (nextChar === 13 /* \r */) {
          closerEnd++;
          if (closerEnd < endOffset && input.charCodeAt(closerEnd) === 10 /* \n */) {
            closerEnd++;
          }
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
        foundCloser = true;
        
        // Emit content (may be empty)
        const contentLength = contentEnd - contentStart;
        if (contentLength > 0) {
          output.push(FrontmatterContent | contentLength);
        }
        
        // Emit closing fence
        const closeLength = closerEnd - lineStart;
        output.push(FrontmatterClose | closeLength);
        
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
    output.push((FrontmatterContent | contentLength) | ErrorUnbalancedToken);
  }
  
  return endOffset - startOffset;
}

/**
 * Scan TOML frontmatter (+++ ... +++)
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
function scanTOMLFrontmatter(input, startOffset, endOffset, output) {
  // Must start with exactly +++ (3 plus signs)
  if (startOffset + 3 > endOffset) return 0;
  if (input.charCodeAt(startOffset) !== 43 /* + */) return 0;
  if (input.charCodeAt(startOffset + 1) !== 43 /* + */) return 0;
  if (input.charCodeAt(startOffset + 2) !== 43 /* + */) return 0;

  // Check what follows the opening +++
  let pos = startOffset + 3;
  
  // Must be followed by newline, space/tab, or EOF
  if (pos < endOffset) {
    const nextChar = input.charCodeAt(pos);
    if (nextChar === 10 /* \n */) {
      pos++;
    } else if (nextChar === 13 /* \r */) {
      pos++;
      if (pos < endOffset && input.charCodeAt(pos) === 10 /* \n */) pos++;
    } else if (nextChar === 32 /* space */ || nextChar === 9 /* tab */) {
      while (pos < endOffset) {
        const ch = input.charCodeAt(pos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
        if (ch !== 32 && ch !== 9) return 0;
        pos++;
      }
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
      return 0;
    }
  }

  // Emit opening fence
  const openLength = pos - startOffset;
  output.push(FrontmatterOpen | openLength);

  // Scan for content and closing +++
  const contentStart = pos;
  let contentEnd = contentStart;
  let foundCloser = false;

  while (pos < endOffset) {
    const lineStart = pos;
    
    // Check for closing +++ at line start
    if (pos + 3 <= endOffset &&
        input.charCodeAt(pos) === 43 /* + */ &&
        input.charCodeAt(pos + 1) === 43 /* + */ &&
        input.charCodeAt(pos + 2) === 43 /* + */) {
      
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
        contentEnd = lineStart;
        foundCloser = true;
        
        const contentLength = contentEnd - contentStart;
        if (contentLength > 0) {
          output.push(FrontmatterContent | contentLength);
        }
        
        const closeLength = closerEnd - lineStart;
        output.push(FrontmatterClose | closeLength);
        
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
    output.push((FrontmatterContent | contentLength) | ErrorUnbalancedToken);
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

  let pos = startOffset + 1;
  
  // Emit opening brace
  output.push(FrontmatterOpen | 1);

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
            output.push(FrontmatterContent | contentLength);
          }
          
          // Emit closing brace (just the brace, not any following newline)
          pos++;  // Move past the }
          output.push(FrontmatterClose | 1);
          
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
    output.push((FrontmatterContent | contentLength) | ErrorUnbalancedToken);
  }
  
  return endOffset - startOffset;
}
