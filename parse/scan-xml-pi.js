// @ts-check

import { ErrorUnbalancedTokenFallback } from './scan-token-flags.js';
import {
  XMLProcessingInstructionClose,
  XMLProcessingInstructionContent,
  XMLProcessingInstructionOpen,
  XMLProcessingInstructionTarget
} from './scan-tokens.js';

/**
 * Bitwise OR: length: lower 24 bits, flags: upper 7 bits.
 * @typedef {number} ProvisionalToken
 */

/**
 * Scan XML processing instruction.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanXMLProcessingInstruction(input, start, end, output) {
  // Must start with '<?'
  if (start + 2 > end) return 0;
  if (input.charCodeAt(start) !== 60 /* < */ ||
      input.charCodeAt(start + 1) !== 63 /* ? */) {
    return 0;
  }

  let offset = start + 2;
  if (offset >= end) return 0;

  // Emit opening token
  output.push(2 | XMLProcessingInstructionOpen);

  // Parse target name
  const targetStart = offset;
  const firstCh = input.charCodeAt(offset);

  // Target must start with letter or underscore (or could be PHP short tag)
  if ((firstCh >= 65 && firstCh <= 90) ||   // A-Z
      (firstCh >= 97 && firstCh <= 122) ||  // a-z
      firstCh === 95 /* _ */) {
    offset++;
    
    // Continue with valid name characters
    while (offset < end) {
      const ch = input.charCodeAt(offset);
      if ((ch >= 65 && ch <= 90) ||   // A-Z
          (ch >= 97 && ch <= 122) ||  // a-z
          (ch >= 48 && ch <= 57) ||   // 0-9
          ch === 45 /* - */ ||
          ch === 95 /* _ */ ||
          ch === 46 /* . */) {
        offset++;
      } else {
        break;
      }
    }
  } else {
    // PHP short tag case: <? without proper target
    // Treat single '?' as target for compatibility
    // Don't emit target token, go straight to content
  }

  const targetLength = offset - targetStart;
  if (targetLength > 0) {
    output.push(targetLength | XMLProcessingInstructionTarget);
  }

  // Parse content until '?>'
  const contentStart = offset;

  while (offset < end) {
    const ch = input.charCodeAt(offset);
    
    if (ch === 63 /* ? */ && offset + 1 < end &&
        input.charCodeAt(offset + 1) === 62 /* > */) {
      // Found '?>'
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | XMLProcessingInstructionContent);
      }
      output.push(2 | XMLProcessingInstructionClose);
      return offset - start + 2;
    }
    
    if (ch === 10 || ch === 13) {
      // Close at newline (restorative strategy - no error flag, successful recovery)
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | XMLProcessingInstructionContent);
      }
      // Don't emit close token, just return to allow newline to be tokenized
      return offset - start;
    }
    
    offset++;
  }

  // EOF without finding '?>' - this IS an error
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | XMLProcessingInstructionContent | ErrorUnbalancedTokenFallback);
  }
  // Don't emit zero-length close token
  return offset - start;
}
