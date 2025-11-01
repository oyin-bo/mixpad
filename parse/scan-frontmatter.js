// @ts-check

import { FrontmatterOpen, FrontmatterContent, FrontmatterClose } from './scan-tokens.js';
import { ErrorUnbalancedToken } from './scan-token-flags.js';

/**
 * Frontmatter type identifiers stored in bits 26-27 of FrontmatterOpen token
 * @readonly
 * @enum {number}
 */
export const FrontmatterType = {
  YAML: 0,
  TOML: 1,
  JSON: 2
};

/**
 * Scan front matter block at the absolute start of a document.
 * Front matter must begin at position 0 (no leading content).
 * 
 * Supports three formats:
 * - YAML: --- ... ---
 * - TOML: +++ ... +++
 * - JSON: { ... }
 * 
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} startOffset - Must be 0 for valid frontmatter
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no frontmatter match
 */
export function scanFrontmatter(input, startOffset, endOffset, output) {
  // Front matter MUST start at position 0
  if (startOffset !== 0) return 0;
  if (startOffset >= endOffset) return 0;

  const firstChar = input.charCodeAt(startOffset);

  // Check for YAML (---) or TOML (+++)
  if (firstChar === 45 /* - */ || firstChar === 43 /* + */) {
    return scanDelimitedFrontmatter(input, startOffset, endOffset, output, firstChar);
  }

  // Check for JSON ({)
  if (firstChar === 123 /* { */) {
    return scanJSONFrontmatter(input, startOffset, endOffset, output);
  }

  return 0;
}

/**
 * Scan YAML (---) or TOML (+++) frontmatter
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} delimiter - Character code: 45 for '-' (YAML) or 43 for '+' (TOML)
 * @returns {number} characters consumed or 0 if no match
 */
function scanDelimitedFrontmatter(input, startOffset, endOffset, output, delimiter) {
  const isYAML = delimiter === 45;
  const type = isYAML ? FrontmatterType.YAML : FrontmatterType.TOML;

  // Count opening delimiter run (must be exactly 3)
  let pos = startOffset;
  let openLen = 0;
  while (pos < endOffset && input.charCodeAt(pos) === delimiter) {
    openLen++;
    pos++;
  }

  // Must be exactly 3 delimiters
  if (openLen !== 3) return 0;

  // After the 3 delimiters, must have newline, space/tab, or EOF
  if (pos < endOffset) {
    const ch = input.charCodeAt(pos);
    // Allow trailing spaces/tabs before newline
    let checkPos = pos;
    while (checkPos < endOffset) {
      const c = input.charCodeAt(checkPos);
      if (c === 32 /* space */ || c === 9 /* tab */) {
        checkPos++;
      } else if (c === 10 /* \n */ || c === 13 /* \r */) {
        break;
      } else {
        // Non-whitespace after fence = not valid frontmatter
        return 0;
      }
    }
  }

  // Find end of opening line (including newline)
  let openLineEnd = pos;
  while (openLineEnd < endOffset) {
    const ch = input.charCodeAt(openLineEnd);
    if (ch === 10 /* \n */) {
      openLineEnd++;
      break;
    }
    if (ch === 13 /* \r */) {
      openLineEnd++;
      if (openLineEnd < endOffset && input.charCodeAt(openLineEnd) === 10 /* \n */) {
        openLineEnd++;
      }
      break;
    }
    openLineEnd++;
  }

  const contentStart = openLineEnd;

  // Scan forward looking for closing fence
  pos = contentStart;
  while (pos < endOffset) {
    // Find start of next line
    const lineStart = pos;

    // Check if this line starts with the closing fence
    let fencePos = lineStart;
    let fenceLen = 0;
    while (fencePos < endOffset && input.charCodeAt(fencePos) === delimiter) {
      fenceLen++;
      fencePos++;
    }

    // Valid closer: exactly 3 delimiters at line start
    if (fenceLen === 3) {
      // Verify rest of line is whitespace or newline
      let validCloser = true;
      let checkPos = fencePos;
      while (checkPos < endOffset) {
        const ch = input.charCodeAt(checkPos);
        if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
        if (ch !== 32 /* space */ && ch !== 9 /* tab */) {
          validCloser = false;
          break;
        }
        checkPos++;
      }

      if (validCloser) {
        // Found valid closing fence
        const contentLength = lineStart - contentStart;

        // Find end of closing line (include newline)
        let closeLineEnd = checkPos;
        if (checkPos < endOffset) {
          const ch = input.charCodeAt(checkPos);
          if (ch === 13 /* \r */ && checkPos + 1 < endOffset && input.charCodeAt(checkPos + 1) === 10 /* \n */) {
            closeLineEnd = checkPos + 2;
          } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
            closeLineEnd = checkPos + 1;
          }
        }

        const openTokenLen = contentStart - startOffset;
        const closeTokenLen = closeLineEnd - lineStart;

        output.push(FrontmatterOpen | openTokenLen);
        if (contentLength > 0) output.push(FrontmatterContent | contentLength);
        output.push(FrontmatterClose | closeTokenLen);
        return closeLineEnd - startOffset;
      }
    }

    // Not a valid closer, skip to next line
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

  // No closing fence found - emit unbalanced tokens
  const contentLength = endOffset - contentStart;
  const openTokenLen = contentStart - startOffset;

  output.push(FrontmatterOpen | ErrorUnbalancedToken | openTokenLen);
  if (contentLength > 0) output.push(FrontmatterContent | ErrorUnbalancedToken | contentLength);
  return endOffset - startOffset;
}

/**
 * Scan JSON frontmatter ({ ... })
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @returns {number} characters consumed or 0 if no match
 */
function scanJSONFrontmatter(input, startOffset, endOffset, output) {
  const type = FrontmatterType.JSON;

  // startOffset points to '{'
  let pos = startOffset + 1;
  let braceDepth = 1;
  let inString = false;
  let escape = false;

  // Find the end of opening line (after the '{')
  // The opening token includes just the opening brace line
  let openLineEnd = startOffset + 1;
  while (openLineEnd < endOffset) {
    const ch = input.charCodeAt(openLineEnd);
    if (ch === 10 /* \n */) {
      openLineEnd++;
      break;
    }
    if (ch === 13 /* \r */) {
      openLineEnd++;
      if (openLineEnd < endOffset && input.charCodeAt(openLineEnd) === 10 /* \n */) {
        openLineEnd++;
      }
      break;
    }
    openLineEnd++;
  }

  const contentStart = openLineEnd;

  // Scan for matching closing brace
  pos = contentStart;
  while (pos < endOffset && braceDepth > 0) {
    const ch = input.charCodeAt(pos);

    if (escape) {
      escape = false;
      pos++;
      continue;
    }

    if (ch === 92 /* \ */) {
      escape = true;
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
          // Found closing brace
          // Check if it's at line start (or after whitespace)
          const closingBracePos = pos;

          // Find start of this line
          let lineStart = closingBracePos;
          while (lineStart > contentStart) {
            const prevCh = input.charCodeAt(lineStart - 1);
            if (prevCh === 10 /* \n */ || prevCh === 13 /* \r */) break;
            lineStart--;
          }

          // Check if only whitespace before the closing brace on this line
          let onlyWhitespace = true;
          for (let i = lineStart; i < closingBracePos; i++) {
            const c = input.charCodeAt(i);
            if (c !== 32 /* space */ && c !== 9 /* tab */) {
              onlyWhitespace = false;
              break;
            }
          }

          // Content ends just before this line (if closing brace is on its own line)
          // Otherwise, content includes up to the closing brace
          let contentEnd;
          if (onlyWhitespace && lineStart > contentStart) {
            contentEnd = lineStart;
          } else {
            contentEnd = closingBracePos;
          }

          const contentLength = contentEnd - contentStart;

          // Find end of closing line
          let closeLineEnd = closingBracePos + 1;
          while (closeLineEnd < endOffset) {
            const ch = input.charCodeAt(closeLineEnd);
            if (ch === 10 /* \n */) {
              closeLineEnd++;
              break;
            }
            if (ch === 13 /* \r */) {
              closeLineEnd++;
              if (closeLineEnd < endOffset && input.charCodeAt(closeLineEnd) === 10 /* \n */) {
                closeLineEnd++;
              }
              break;
            }
            // Allow trailing whitespace
            if (ch !== 32 /* space */ && ch !== 9 /* tab */) break;
            closeLineEnd++;
          }

          const openTokenLen = contentStart - startOffset;
          const closeTokenLen = closeLineEnd - closingBracePos;

          output.push(FrontmatterOpen | openTokenLen);
          if (contentLength > 0) output.push(FrontmatterContent | contentLength);
          output.push(FrontmatterClose | closeTokenLen);
          return closeLineEnd - startOffset;
        }
      }
    }

    pos++;
  }

  // No valid closing brace found - emit unbalanced
  const contentLength = endOffset - contentStart;
  const openTokenLen = contentStart - startOffset;

  output.push(FrontmatterOpen | ErrorUnbalancedToken | openTokenLen);
  if (contentLength > 0) output.push(FrontmatterContent | ErrorUnbalancedToken | contentLength);
  return endOffset - startOffset;
}

/**
 * Extract frontmatter type from FrontmatterOpen token
 * @param {number} token - FrontmatterOpen token
 * @returns {number} Type: 0=YAML, 1=TOML, 2=JSON
 */
export function getFrontmatterType(token) {
  return (token >> 26) & 0x3;
}

/**
 * Get frontmatter type name
 * @param {number} token - FrontmatterOpen token
 * @returns {'YAML' | 'TOML' | 'JSON'}
 */
export function getFrontmatterTypeName(token) {
  const type = getFrontmatterType(token);
  switch (type) {
    case FrontmatterType.YAML: return 'YAML';
    case FrontmatterType.TOML: return 'TOML';
    case FrontmatterType.JSON: return 'JSON';
    default: return 'YAML';
  }
}
