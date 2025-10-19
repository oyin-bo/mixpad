# List Scanning in MixPad (scan0)

**Note:** List structure resolution (nesting, tight/loose, content belonging) is the semantic layer's responsibility. This document covers only the lexical scanning of list markers in `scan0`.

## Overview

`scan0`'s responsibility for lists is purely lexical: detect and tokenize list markers at the start of a line's content. That's it. Nothing more.

The semantic layer handles all structural decisions (which content belongs to which item, nesting hierarchy, tight vs loose rendering, lazy continuation validity, etc.).

## List Marker Token Types

```javascript
// From scan-tokens.js
const BulletListMarker      = 0x0500; // -, *, +
const OrderedListMarker     = 0x0600; // 1., 2., 1), 2), etc.
const TaskListMarker        = 0x0700; // [ ], [x], [X] after a bullet marker
```

## Bullet List Markers

**Patterns to recognize:**
- `-`, `*`, or `+` followed by a space or tab.

**What `scan0` does:**
1. Sees `-` (or `*` or `+`).
2. Checks the next character is a space or tab.
3. Emits a `BulletListMarker` token containing the marker character.
4. Returns the consumed length (e.g., 2 bytes for `- `).

**What `scan0` does NOT do:**
- Check indentation (that's for the semantic layer).
- Validate if this starts a list or continues one.
- Determine nesting level.
- Track tight/loose state.

**Implementation (`scan-list-bullet.js`):**
```javascript
/**
 * Scans for a bullet list marker: -, *, or +
 * @param {string} input The input string.
 * @param {number} start The starting position.
 * @param {number} end The end position.
 * @param {number[]} output The output array for tokens.
 * @returns {number} The number of characters consumed.
 */
export function scanBulletListMarker(input, start, end, output) {
  const char = input.charCodeAt(start);
  
  // Must be -, *, or +
  if (char !== 45 && char !== 42 && char !== 43) return 0;
  
  // Must be followed by a space or tab
  if (start + 1 >= end) return 0;
  const next = input.charCodeAt(start + 1);
  if (next !== 32 && next !== 9) return 0; // 32=space, 9=tab
  
  // Pack: length | type | marker_char
  // The marker character itself is stored for semantic analysis (e.g., to detect mixed markers).
  output.push(2 | BulletListMarker | (char << 16));
  
  return 2;
}
```

## Ordered List Markers

**Patterns to recognize:**
- 1 to 9 digits (`0-9`).
- Followed by `.` or `)`.
- Followed by a space or tab.

**What `scan0` does:**
1. Parses digits (up to 9).
2. Sees `.` or `)`.
3. Checks the next character is a space or tab.
4. Emits an `OrderedListMarker` token with the start number and delimiter type.
5. Returns the consumed length.

**What `scan0` does NOT do:**
- Check indentation.
- Validate the marker's position or ordering.
- Determine if this starts a new list.

**Implementation (`scan-list-ordered.js`):**
```javascript
/**
 * Scans for an ordered list marker: digits followed by . or )
 * @param {string} input The input string.
 * @param {number} start The starting position.
 * @param {number} end The end position.
 * @param {number[]} output The output array for tokens.
 * @returns {number} The number of characters consumed.
 */
export function scanOrderedListMarker(input, start, end, output) {
  let offset = start;
  let number = 0;
  let digitCount = 0;
  
  // Parse 1-9 digits
  while (offset < end && digitCount < 9) {
    const ch = input.charCodeAt(offset);
    if (ch >= 48 && ch <= 57) { // 0-9
      number = number * 10 + (ch - 48);
      digitCount++;
      offset++;
    } else {
      break;
    }
  }
  
  if (digitCount === 0 || digitCount > 9) return 0;
  
  // Must have . or ) delimiter
  if (offset >= end) return 0;
  const delim = input.charCodeAt(offset);
  if (delim !== 46 && delim !== 41) return 0; // 46=., 41=)
  offset++;
  
  // Must be followed by a space or tab
  if (offset >= end) return 0;
  const next = input.charCodeAt(offset);
  if (next !== 32 && next !== 9) return 0;
  offset++;
  
  const length = offset - start;
  const delimBit = delim === 46 ? 0 : 1; // 0 for '.', 1 for ')'
  
  // Pack: length | type | delimiter_bit | start_number
  // The number is shifted to leave room for the delimiter bit.
  output.push(
    length | 
    OrderedListMarker | 
    (delimBit << 16) |
    (number << 17)
  );
  
  return length;
}
```

## Task List Markers

**Patterns to recognize:**
- `[ ]`, `[x]`, or `[X]`.
- Must immediately follow a `BulletListMarker` token.
- Followed by a space or tab.

**What `scan0` does:**
1. After a `BulletListMarker` is found, checks if the following text is `[ ]`, `[x]`, or `[X]`.
2. Checks it's followed by a space or tab.
3. Emits a `TaskListMarker` token with the checked state.
4. Returns the consumed length (4 bytes).

**What `scan0` does NOT do:**
- Determine if a task list is valid in the current context.
- Track checkbox state across edits.

**Implementation (`scan-list-task.js`):**
```javascript
/**
 * Scans for a task list checkbox after a bullet marker.
 * @param {string} input The input string.
 * @param {number} start The starting position.
 * @param {number} end The end position.
 * @param {number[]} output The output array for tokens.
 * @returns {number} The number of characters consumed (0 if not a task marker).
 */
export function scanTaskListMarker(input, start, end, output) {
  if (start + 3 >= end) return 0;
  
  // Must start with [
  if (input.charCodeAt(start) !== 91) return 0; // 91=[
  
  const check = input.charCodeAt(start + 1);
  const isChecked = (check === 120 || check === 88); // 120=x, 88=X
  const isUnchecked = (check === 32); // 32=space
  
  if (!isChecked && !isUnchecked) return 0;
  
  // Must have ]
  if (input.charCodeAt(start + 2) !== 93) return 0; // 93=]
  
  // Must be followed by a space
  if (input.charCodeAt(start + 3) !== 32) return 0;
  
  // Pack: length | type | checked_bit
  const checkedBit = isChecked ? 1 : 0;
  output.push(4 | TaskListMarker | (checkedBit << 16));
  
  return 4;
}
```

## Token Encoding

List marker tokens are encoded as packed 32-bit integers. See `scan-tokens.js` for token kind values and `scan-token-flags.js` for bit shifts.

**Tokens carry minimal, context-free information:**
- `BulletListMarker`: The marker character (`-`, `*`, `+`).
- `OrderedListMarker`: The starting number and delimiter type (`.` or `)`).
- `TaskListMarker`: The checked state (`true`/`false`).

All positional and structural information (like indentation) is determined by the semantic layer by examining the token stream in its entirety.

## Invocation from `scan0`

List marker scanning happens in `scan0.js` when a line's content starts with characters that could indicate a list.

```javascript
// In scan0 main loop, at line start (after consuming indentation):
const char = input.charCodeAt(pos);

// Try bullet marker
// Note: Task lists can only follow bullet lists made with - or *.
const bulletMarkerChars = new Set(['-', '*']);
let len = scanBulletListMarker(input, pos, end, output);
if (len > 0) {
  pos += len;
  
  // Check for task list marker if applicable
  if (bulletMarkerChars.has(String.fromCharCode(char))) {
    const taskLen = scanTaskListMarker(input, pos, end, output);
    if (taskLen > 0) {
      pos += taskLen;
    }
  }
  continue; // Move to the next line/token
}

// Try ordered marker
len = scanOrderedListMarker(input, pos, end, output);
if (len > 0) {
  pos += len;
  continue; // Move to the next line/token
}
```

## What Happens Next (Semantic Layer)

After `scan0` emits list marker tokens, the semantic layer:

1.  **Determines marker validity** — Is this indentation valid for a list marker?
2.  **Builds list hierarchy** — Constructs a nesting structure from indentation patterns.
3.  **Assigns content** — Paragraphs, code blocks, etc., are assigned to list items based on indentation.
4.  **Computes rendering properties** — Detects blank lines to determine `tight` vs `loose`.
5.  **Validates continuation** — Determines if lazy continuation is allowed.
6.  **Handles interruption** — When does a list end? When does a new one start?

None of this is `scan0`'s concern.

## Summary

**`scan0`'s role for lists:**
- ✅ Recognize `-`, `*`, `+` + space as a bullet marker.
- ✅ Recognize digits + `.`/`)` + space as an ordered marker.
- ✅ Recognize `[ ]`/`[x]`/`[X]` + space as a task marker.
- ✅ Emit tokens with minimal, context-free marker data.
- ✅ Return the consumed length.
- ❌ Don't validate indentation.
- ❌ Don't determine structure.
- ❌ Don't track state.
- ❌ Don't make semantic decisions.

That's the complete scope. Everything else is semantic layer work, as detailed in `10-lists-semantic.md`.
