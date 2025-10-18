// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
import {
  EntityDecimal,
  EntityHex,
  EntityNamed,
  HTMLAttributeColon,
  HTMLAttributeEquals,
  HTMLAttributeName,
  HTMLAttributeQuote,
  HTMLAttributeValue,
  HTMLTagClose,
  HTMLTagName,
  HTMLTagOpen,
  HTMLTagSelfClosing,
  InlineText,
  PercentEncoding,
  Whitespace
} from './scan-tokens.js';
import { scanEntity } from './scan-entity.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Check if tag name matches a specific string (case-insensitive, lowercase expected).
 * @param {string} input
 * @param {number} start - Start position of tag name
 * @param {number} length - Length of tag name
 * @param {string} expected - Lowercase expected tag name
 * @returns {boolean}
 */
function matchesTagName(input, start, length, expected) {
  if (length !== expected.length) return false;
  for (let i = 0; i < length; i++) {
    const ch = input.charCodeAt(start + i);
    const exp = expected.charCodeAt(i);
    // Case-insensitive: ch should match exp or exp-32 (uppercase)
    if (ch !== exp && ch !== (exp - 32)) return false;
  }
  return true;
}

/**
 * Scan HTML tag (opening, closing, or self-closing).
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLTag(input, start, end, output) {
  if (input.charCodeAt(start) !== 60 /* < */) return 0;

  let offset = start + 1;
  if (offset >= end) return 0;

  // Check if this is a closing tag
  const isClosing = input.charCodeAt(offset) === 47 /* / */;
  if (isClosing) {
    offset++;
    if (offset >= end) return 0;
  }

  // Parse tag name
  const tagNameStart = offset;
  const firstCh = input.charCodeAt(offset);

  // Tag name must start with ASCII letter
  if (!((firstCh >= 65 && firstCh <= 90) ||   // A-Z
        (firstCh >= 97 && firstCh <= 122))) { // a-z
    return 0; // Not a valid tag
  }

  offset++;

  // Continue parsing tag name (letters, digits, hyphen, colon for XML namespaces)
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    if ((ch >= 65 && ch <= 90) ||   // A-Z
        (ch >= 97 && ch <= 122) ||  // a-z
        (ch >= 48 && ch <= 57) ||   // 0-9
        ch === 45 /* - */ ||
        ch === 58 /* : */) {        // colon for XML namespaces
      offset++;
    } else {
      break;
    }
  }

  const tagNameLength = offset - tagNameStart;
  if (tagNameLength === 0) return 0;

  // Emit opening token
  if (isClosing) {
    output.push(2 | HTMLTagOpen); // '</'
  } else {
    output.push(1 | HTMLTagOpen); // '<'
  }

  // Emit tag name
  output.push(tagNameLength | HTMLTagName);

  // For closing tags, just look for '>'
  if (isClosing) {
    // Skip whitespace
    const wsStart = offset;
    let hasNewline = false;
    while (offset < end) {
      const ch = input.charCodeAt(offset);
      if (ch === 9 || ch === 32 || ch === 10 || ch === 13) {
        if (ch === 10 || ch === 13) hasNewline = true;
        offset++;
      } else {
        break;
      }
    }
    const wsLength = offset - wsStart;
    if (wsLength > 0) {
      output.push(wsLength | Whitespace);
    }

    if (offset < end && input.charCodeAt(offset) === 62 /* > */) {
      if (hasNewline) {
        // Closing tag with newline before > - treat as error
        output.push(1 | HTMLTagClose | ErrorUnbalancedTokenFallback);
      } else {
        output.push(1 | HTMLTagClose);
      }
      return offset - start + 1;
    }

    // Unclosed closing tag - would emit error but zero-length tokens not allowed
    // Just return without emitting closing token
    return offset - start;
  }

  // Parse attributes for opening tags
  let hasError = false;
  while (offset < end) {
    // Skip whitespace
    const wsStart = offset;
    while (offset < end) {
      const ch = input.charCodeAt(offset);
      if (ch === 9 || ch === 32 || ch === 10 || ch === 13) {
        offset++;
      } else {
        break;
      }
    }
    const wsLength = offset - wsStart;
    if (wsLength > 0) {
      output.push(wsLength | Whitespace);
    }

    if (offset >= end) break;

    const ch = input.charCodeAt(offset);

    // Check for tag close or self-closing
    if (ch === 62 /* > */) {
      output.push(1 | HTMLTagClose);
      return offset - start + 1;
    }

    if (ch === 47 /* / */ && offset + 1 < end && 
        input.charCodeAt(offset + 1) === 62 /* > */) {
      output.push(2 | HTMLTagSelfClosing);
      return offset - start + 2;
    }

    // Parse attribute name (potentially with namespace)
    const attrNameStart = offset;
    
    // Attribute name must start with letter, underscore, or colon
    const firstAttrCh = input.charCodeAt(offset);
    if (!((firstAttrCh >= 65 && firstAttrCh <= 90) ||   // A-Z
          (firstAttrCh >= 97 && firstAttrCh <= 122) ||  // a-z
          firstAttrCh === 95 /* _ */ ||
          firstAttrCh === 58 /* : */)) {
      // Invalid attribute, treat as error and stop parsing
      hasError = true;
      break;
    }

    offset++;

    // Continue parsing until colon or end of attribute name
    let colonPos = -1;
    while (offset < end) {
      const attrCh = input.charCodeAt(offset);
      if ((attrCh >= 65 && attrCh <= 90) ||   // A-Z
          (attrCh >= 97 && attrCh <= 122) ||  // a-z
          (attrCh >= 48 && attrCh <= 57) ||   // 0-9
          attrCh === 45 /* - */ ||
          attrCh === 95 /* _ */ ||
          attrCh === 46 /* . */) {
        offset++;
      } else if (attrCh === 58 /* : */ && colonPos === -1) {
        colonPos = offset;
        offset++;
      } else {
        break;
      }
    }

    // Emit attribute name tokens (split on colon if present)
    if (colonPos !== -1) {
      // Namespace prefix
      const prefixLen = colonPos - attrNameStart;
      if (prefixLen > 0) {
        output.push(prefixLen | HTMLAttributeName);
      }
      // Colon
      output.push(1 | HTMLAttributeColon);
      // Local name
      const localLen = offset - colonPos - 1;
      if (localLen > 0) {
        output.push(localLen | HTMLAttributeName);
      }
    } else {
      // Single attribute name (no namespace)
      const attrNameLength = offset - attrNameStart;
      output.push(attrNameLength | HTMLAttributeName);
    }

    // Skip whitespace after attribute name
    const wsStart2 = offset;
    while (offset < end) {
      const wsCh = input.charCodeAt(offset);
      if (wsCh === 9 || wsCh === 32 || wsCh === 10 || wsCh === 13) {
        offset++;
      } else {
        break;
      }
    }
    const wsLength2 = offset - wsStart2;
    if (wsLength2 > 0) {
      output.push(wsLength2 | Whitespace);
    }

    if (offset >= end) break;

    // Check for '=' sign
    if (input.charCodeAt(offset) !== 61 /* = */) {
      // Standalone attribute (boolean)
      continue;
    }

    output.push(1 | HTMLAttributeEquals);
    offset++;

    // Skip whitespace after '='
    const wsStart3 = offset;
    while (offset < end) {
      const wsCh = input.charCodeAt(offset);
      if (wsCh === 9 || wsCh === 32 || wsCh === 10 || wsCh === 13) {
        offset++;
      } else {
        break;
      }
    }
    const wsLength3 = offset - wsStart3;
    if (wsLength3 > 0) {
      output.push(wsLength3 | Whitespace);
    }

    if (offset >= end) break;

    // Parse attribute value
    const quoteCh = input.charCodeAt(offset);
    
    if (quoteCh === 34 /* " */ || quoteCh === 39 /* ' */) {
      // Quoted value - emit opening quote as separate token
      output.push(1 | HTMLAttributeQuote);
      offset++;

      while (offset < end) {
        const valCh = input.charCodeAt(offset);
        
        if (valCh === quoteCh) {
          // Closing quote as separate token
          output.push(1 | HTMLAttributeQuote);
          offset++;
          break;
        }
        
        if (valCh === 10 || valCh === 13) {
          // Unclosed attribute value - close at newline without emitting quote token
          hasError = true;
          break;
        }
        
        if (valCh === 38 /* & */) {
          // Try to parse entity
          const entityToken = scanEntity(input, offset, end);
          if (entityToken) {
            output.push(entityToken);
            offset += entityToken & 0xFFFF; // length is in lower 16 bits
            continue;
          }
        }
        
        // Regular text - scan until next special char
        const textStart = offset;
        while (offset < end) {
          const ch = input.charCodeAt(offset);
          if (ch === quoteCh || ch === 38 /* & */ || ch === 10 || ch === 13) {
            break;
          }
          // Check for percent-encoding boundary (%XX)
          if (ch === 37 /* % */ && offset + 2 < end) {
            const hex1 = input.charCodeAt(offset + 1);
            const hex2 = input.charCodeAt(offset + 2);
            if (((hex1 >= 48 && hex1 <= 57) || (hex1 >= 65 && hex1 <= 70) || (hex1 >= 97 && hex1 <= 102)) &&
                ((hex2 >= 48 && hex2 <= 57) || (hex2 >= 65 && hex2 <= 70) || (hex2 >= 97 && hex2 <= 102))) {
              break; // Valid %XX sequence - stop text run here
            }
          }
          offset++;
        }
        const textLen = offset - textStart;
        if (textLen > 0) {
          output.push(textLen | HTMLAttributeValue);
        }
        
        // After emitting text, check if we stopped at a valid percent-encoding
        if (offset < end && input.charCodeAt(offset) === 37 /* % */ && offset + 2 < end) {
          const hex1 = input.charCodeAt(offset + 1);
          const hex2 = input.charCodeAt(offset + 2);
          if (((hex1 >= 48 && hex1 <= 57) || (hex1 >= 65 && hex1 <= 70) || (hex1 >= 97 && hex1 <= 102)) &&
              ((hex2 >= 48 && hex2 <= 57) || (hex2 >= 65 && hex2 <= 70) || (hex2 >= 97 && hex2 <= 102))) {
            output.push(3 | PercentEncoding);
            offset += 3;
          }
        }
      }

      if (offset >= end && input.charCodeAt(offset - 1) !== quoteCh) {
        // EOF without closing quote - emit error quote
        output.push(1 | HTMLAttributeQuote | ErrorUnbalancedTokenFallback);
        hasError = true;
      }
    } else {
      // Unquoted value
      const valueStart = offset;
      while (offset < end) {
        const valCh = input.charCodeAt(offset);
        // Unquoted values cannot contain whitespace, <, >, ", ', =, `
        if (valCh === 9 || valCh === 32 || valCh === 10 || valCh === 13 ||
            valCh === 60 /* < */ || valCh === 62 /* > */ ||
            valCh === 34 /* " */ || valCh === 39 /* ' */ ||
            valCh === 61 /* = */ || valCh === 96 /* ` */) {
          break;
        }
        offset++;
      }

      const valueLength = offset - valueStart;
      if (valueLength > 0) {
        output.push(valueLength | HTMLAttributeValue);
      }
    }
  }

  // Unclosed opening tag - don't emit zero-length close token
  if (hasError || offset >= end) {
    return offset - start;
  }

  // Shouldn't reach here, but safety fallback - don't emit zero-length token
  return offset - start;
}

/**
 * Check if a tag name is a void element (no allocation).
 * @param {string} input
 * @param {number} start - Start position of tag name
 * @param {number} length - Length of tag name
 * @returns {boolean}
 */
export function isVoidElement(input, start, length) {
  // Check against: area, base, br, col, embed, hr, img, input, link, meta, param, source, track, wbr
  switch (length) {
    case 2:
      return matchesTagName(input, start, length, 'br') ||
             matchesTagName(input, start, length, 'hr');
    case 3:
      return matchesTagName(input, start, length, 'col') ||
             matchesTagName(input, start, length, 'img') ||
             matchesTagName(input, start, length, 'wbr');
    case 4:
      return matchesTagName(input, start, length, 'area') ||
             matchesTagName(input, start, length, 'base') ||
             matchesTagName(input, start, length, 'link') ||
             matchesTagName(input, start, length, 'meta');
    case 5:
      return matchesTagName(input, start, length, 'embed') ||
             matchesTagName(input, start, length, 'input') ||
             matchesTagName(input, start, length, 'param') ||
             matchesTagName(input, start, length, 'track');
    case 6:
      return matchesTagName(input, start, length, 'source');
    default:
      return false;
  }
}

/**
 * Check if a tag name is a raw text element (no allocation).
 * @param {string} input
 * @param {number} start - Start position of tag name
 * @param {number} length - Length of tag name
 * @returns {boolean}
 */
export function isRawTextElement(input, start, length) {
  // Check against: script, style, textarea
  switch (length) {
    case 5:
      return matchesTagName(input, start, length, 'style');
    case 6:
      return matchesTagName(input, start, length, 'script');
    case 8:
      return matchesTagName(input, start, length, 'textarea');
    default:
      return false;
  }
}
