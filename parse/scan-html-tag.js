// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
import {
  HTMLAttributeEquals,
  HTMLAttributeName,
  HTMLAttributeValue,
  HTMLTagClose,
  HTMLTagName,
  HTMLTagOpen,
  HTMLTagSelfClosing,
  Whitespace
} from './scan-tokens.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/** Set of void elements that never have closing tags */
const voidElements = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/** Set of raw text elements that require special content parsing */
const rawTextElements = new Set(['script', 'style', 'textarea']);

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
  const tagName = input.slice(tagNameStart, offset).toLowerCase();
  output.push(tagNameLength | HTMLTagName);

  // For closing tags, just look for '>'
  if (isClosing) {
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

    if (offset < end && input.charCodeAt(offset) === 62 /* > */) {
      output.push(1 | HTMLTagClose);
      return offset - start + 1;
    }

    // Unclosed closing tag - close at newline or EOF
    while (offset < end) {
      const ch = input.charCodeAt(offset);
      if (ch === 10 || ch === 13) {
        output.push(0 | HTMLTagClose | ErrorUnbalancedTokenFallback);
        return offset - start;
      }
      offset++;
    }

    output.push(0 | HTMLTagClose | ErrorUnbalancedTokenFallback);
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

    // Parse attribute name
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

    // Continue parsing attribute name
    while (offset < end) {
      const attrCh = input.charCodeAt(offset);
      if ((attrCh >= 65 && attrCh <= 90) ||   // A-Z
          (attrCh >= 97 && attrCh <= 122) ||  // a-z
          (attrCh >= 48 && attrCh <= 57) ||   // 0-9
          attrCh === 45 /* - */ ||
          attrCh === 95 /* _ */ ||
          attrCh === 46 /* . */ ||
          attrCh === 58 /* : */) {
        offset++;
      } else {
        break;
      }
    }

    const attrNameLength = offset - attrNameStart;
    output.push(attrNameLength | HTMLAttributeName);

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
      // Quoted value
      const valueStart = offset;
      offset++;

      while (offset < end) {
        const valCh = input.charCodeAt(offset);
        if (valCh === quoteCh) {
          offset++;
          const valueLength = offset - valueStart;
          output.push(valueLength | HTMLAttributeValue);
          break;
        }
        if (valCh === 10 || valCh === 13) {
          // Unclosed attribute value - close at newline
          const valueLength = offset - valueStart;
          output.push(valueLength | HTMLAttributeValue | ErrorUnbalancedTokenFallback);
          hasError = true;
          break;
        }
        offset++;
      }

      if (offset >= end && input.charCodeAt(offset - 1) !== quoteCh) {
        // EOF without closing quote
        const valueLength = offset - valueStart;
        output.push(valueLength | HTMLAttributeValue | ErrorUnbalancedTokenFallback);
        hasError = true;
        break;
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

  // Unclosed opening tag
  if (hasError || offset >= end) {
    output.push(0 | HTMLTagClose | ErrorUnbalancedTokenFallback);
    return offset - start;
  }

  // Shouldn't reach here, but safety fallback
  output.push(0 | HTMLTagClose | ErrorUnbalancedTokenFallback);
  return offset - start;
}

/**
 * Check if a tag name is a void element.
 * @param {string} tagName - lowercase tag name
 * @returns {boolean}
 */
export function isVoidElement(tagName) {
  return voidElements.has(tagName);
}

/**
 * Check if a tag name is a raw text element.
 * @param {string} tagName - lowercase tag name
 * @returns {boolean}
 */
export function isRawTextElement(tagName) {
  return rawTextElements.has(tagName);
}
