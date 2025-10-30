# Implementation Recommendations for Correct Setext Heading Parsing

Based on the analysis of PRs #53 and #54, this document provides concrete recommendations for implementing Setext heading parsing with proper speculative parsing behavior.

## Critical Issues to Fix

### Issue 1: Bit Position Conflict

**Current State:**
- Design doc (`11-headings.md`) specifies bits 28-30 for heading depth
- But `scan-token-flags.js` uses bits 29-30 for flags (`IsSafeReparsePoint`, `ErrorUnbalancedToken`)
- PR #54 uses bits 26-28 (avoiding conflict)
- PR #53 doesn't use depth bits at all

**Resolution:**
Use bits 26-28 for heading depth (as PR #54 does):
```javascript
// Depth encoding (3 bits = 0-7, we use 0-6)
// Bits 26-28: Heading depth
//   0 = not in heading
//   1-6 = ATX levels 1-6, or Setext level 1-2
const depthMask = 0x7 << 26;  // 0x1C000000

// Extract depth
function getHeadingDepth(token) {
  return (token >> 26) & 0x7;
}

// Set depth
function setHeadingDepth(token, depth) {
  return (token & ~depthMask) | ((depth & 0x7) << 26);
}
```

Update design doc to reflect bits 26-28 instead of 28-30.

### Issue 2: Missing Speculative Parsing in scan0

**Required Implementation:**

```javascript
// parse/scan0.js

import { checkSetextUnderline, bufferSetextToken, flushSetextBuffer, clearSetextBuffer } from './scan-setext-heading.js';

// Inside the main while loop of scan0:

// After consuming a complete line (at newline)
case 10 /* \n */:
case 13 /* \r */: {
  // ... existing newline handling ...
  
  // Check if we should pre-scan for Setext
  if (shouldBufferForSetext) {
    // Move tokens from this line into buffer
    const lineTokens = output.slice(tokenStartOfLine);
    output.length = tokenStartOfLine;
    for (const token of lineTokens) {
      bufferSetextToken(token);
    }
    
    // Pre-scan next line for underline
    const setextCheck = checkSetextUnderline(input, offset, endOffset);
    
    if (setextCheck.isValid) {
      // Apply depth and flush
      flushSetextBuffer(output, setextCheck.depth);
      
      // Emit underline token
      const depthBits = (setextCheck.depth & 0x7) << 26;
      output.push(setextCheck.length | SetextHeadingUnderline | depthBits);
      
      // Skip the underline line
      offset = offsetAfterSetextLine;
    } else {
      // Flush without depth
      flushSetextBuffer(output, 0);
    }
    
    clearSetextBuffer();
  }
  
  break;
}
```

### Issue 3: Qualifying Line Detection

Need to track whether current line qualifies for Setext buffering:

```javascript
// parse/scan0.js

// Track if current line can be Setext heading text
let canBeSetextText = true;
let lineStartOffset = startOffset;

// Inside scan0 main loop:

// Disqualify conditions:
case 96 /* ` backtick */: {
  const consumed = scanFencedBlock(...);
  if (consumed > 0) {
    canBeSetextText = false; // Code fence
    // ...
  }
  break;
}

case 45 /* - hyphen */:
case 42 /* * asterisk */:
case 43 /* + plus */: {
  const listConsumed = scanBulletListMarker(...);
  if (listConsumed > 0) {
    canBeSetextText = false; // List item
    // ...
  }
  break;
}

case 35 /* # hash */: {
  const headingConsumed = scanATXHeading(...);
  if (headingConsumed > 0) {
    canBeSetextText = false; // ATX heading
    // ...
  }
  break;
}

case 60 /* < less-than */: {
  const htmlConsumed = scanHTMLTag(...);
  if (htmlConsumed > 0) {
    canBeSetextText = false; // HTML tag
    // ...
  }
  break;
}

// At start of line, check indentation
if (offset === lineStartOffset) {
  const indent = countIndentation(input, lineStartOffset, offset);
  if (indent >= 4) {
    canBeSetextText = false; // Code block
  }
}

// At newline, decide whether to buffer
case 10 /* \n */: {
  shouldBufferForSetext = canBeSetextText;
  // ... buffering logic from Issue 2 ...
  
  // Reset for next line
  canBeSetextText = true;
  lineStartOffset = offset;
  break;
}
```

## Recommended Implementation Order

### Phase 1: Fix Bit Positions

1. Update `parse/docs/11-headings.md` to specify bits 26-28 (not 28-30)
2. Ensure all scanner code uses bits 26-28 for depth
3. Verify no conflicts with existing flag bits (29-30)

### Phase 2: ATX Heading Depth Propagation

1. Fix PR #54's ATX scanner to apply depth to ALL inline tokens, not just text
2. Currently it only applies depth to tokens it emits directly
3. Need to apply depth to tokens emitted by inline scanners (emphasis, entities, etc.)

**Current PR #54 approach (incorrect):**
```javascript
// PR #54: scanATXHeading emits tokens with depth directly
output.push(contentLength | InlineText | depthBits);
```

**Problem:** If content has emphasis, entities, etc., those tokens are scanned by their own scanners which don't know about heading depth.

**Correct approach:**
```javascript
// Option A: Set a "current heading depth" context variable in scan0
let currentHeadingDepth = 0;

// ATX scanner sets it:
currentHeadingDepth = hashCount; // 1-6

// All scanners check it when emitting:
function emitToken(type, length) {
  const depthBits = (currentHeadingDepth & 0x7) << 26;
  output.push(length | type | depthBits);
}

// Reset when line ends:
case 10 /* \n */: {
  currentHeadingDepth = 0;
  // ...
}
```

### Phase 3: Setext Buffering Infrastructure

Use PR #54's buffer infrastructure:

1. Keep module-level buffer in `scan-setext-heading.js`
2. Keep `bufferSetextToken()`, `flushSetextBuffer()`, `clearSetextBuffer()`
3. Fix depth bit positions to use 26-28

### Phase 4: scan0 Integration for Setext

Implement the buffering logic in scan0:

1. Add `canBeSetextText` tracking
2. Add `shouldBufferForSetext` decision at newline
3. Implement buffer-and-pre-scan logic
4. Handle successful and failed underline validation

### Phase 5: Testing

1. Add test cases from `SPECULATIVE_PARSING_TEST.md`
2. Verify depth flags on ALL tokens in headings
3. Test qualifying vs non-qualifying lines
4. Test interaction with other constructs

## Detailed Code Changes

### File: `parse/scan0.js`

```javascript
// Add imports
import { checkSetextUnderline, bufferSetextToken, flushSetextBuffer, clearSetextBuffer } from './scan-setext-heading.js';
import { SetextHeadingUnderline } from './scan-tokens.js';

// Add state variables inside scan0 function
let currentHeadingDepth = 0; // Current ATX heading depth (0 if not in heading)
let canBeSetextText = true;  // Can current line be Setext heading text?
let lineStartTokenIndex = 0; // Index of first token on current line

// Modify token emission to include depth
// (This is a bigger refactor - may need to pass depth to all scanners)

// At newline handling:
case 10 /* \n */:
case 13 /* \r */: {
  // Emit newline token
  // ... existing code ...
  
  // Check for Setext buffering
  if (canBeSetextText && output.length > lineStartTokenIndex) {
    // Buffer tokens from this line
    const lineTokens = output.slice(lineStartTokenIndex);
    output.length = lineStartTokenIndex;
    
    for (const token of lineTokens) {
      bufferSetextToken(token);
    }
    
    // Pre-scan next line
    const setextCheck = checkSetextUnderline(input, offset, endOffset);
    
    if (setextCheck.isValid) {
      // Flush with depth
      flushSetextBuffer(output, setextCheck.depth);
      
      // Emit underline token
      const depthBits = (setextCheck.depth & 0x7) << 26;
      const underlineLength = /* count underline chars */;
      output.push(underlineLength | SetextHeadingUnderline | depthBits);
      
      // Skip underline line
      offset += setextCheck.consumedLength;
      tokenCount = output.length;
    } else {
      // Flush without depth
      flushSetextBuffer(output, 0);
    }
    
    clearSetextBuffer();
  }
  
  // Reset line state
  canBeSetextText = true;
  currentHeadingDepth = 0;
  lineStartTokenIndex = output.length;
  
  break;
}
```

### File: `parse/scan-setext-heading.js` (from PR #54)

Fix bit positions:

```javascript
export function flushSetextBuffer(output, depth) {
  for (let i = 0; i < setextBuffer.length; i++) {
    let token = setextBuffer[i];
    if (depth > 0) {
      // Apply heading depth to bits 26-28 (not 28-30)
      token = (token & ~(0x7 << 26)) | ((depth & 0x7) << 26);
    }
    output.push(token);
  }
  setextBuffer.length = 0;
}
```

### File: `parse/scan-atx-heading.js`

Simplify to just emit the marker and return:

```javascript
export function scanATXHeading(input, start, end, output) {
  // Validate opening sequence
  // ... existing validation ...
  
  // Emit ATXHeadingOpen with depth
  const depth = hashCount; // 1-6
  const depthBits = (depth & 0x7) << 26;
  output.push(hashCount | ATXHeadingOpen | depthBits);
  
  // Return depth so scan0 can set currentHeadingDepth
  // Or use a different mechanism to communicate depth
  return { consumed: hashCount, depth: depth };
}
```

Then scan0 handles the rest of the line with `currentHeadingDepth` set.

## Alternative: Context-Aware Scanners

Instead of passing depth to every scanner, use a context object:

```javascript
// parse/scan-context.js
export class ScanContext {
  constructor() {
    this.headingDepth = 0;
  }
  
  applyContext(token) {
    if (this.headingDepth > 0) {
      const depthBits = (this.headingDepth & 0x7) << 26;
      return token | depthBits;
    }
    return token;
  }
}

// In scan0:
const context = new ScanContext();

// When ATX heading found:
context.headingDepth = 3; // For example

// All scanners do:
function scanSomething(input, start, end, output, context) {
  const token = makeToken();
  output.push(context.applyContext(token));
}
```

## Testing Strategy

### Unit Tests for Buffering

Test `bufferSetextToken()` and `flushSetextBuffer()` in isolation:

```javascript
import { bufferSetextToken, flushSetextBuffer, clearSetextBuffer } from './scan-setext-heading.js';

// Test 1: Flush with depth applies flags
clearSetextBuffer();
bufferSetextToken(0x010005); // InlineText, length 5, no depth
bufferSetextToken(0x020003); // Whitespace, length 3, no depth
const output = [];
flushSetextBuffer(output, 1); // Depth 1
assert(output[0] === (0x010005 | (1 << 26))); // Depth applied
assert(output[1] === (0x020003 | (1 << 26)));

// Test 2: Flush without depth preserves tokens
clearSetextBuffer();
bufferSetextToken(0x010005);
const output2 = [];
flushSetextBuffer(output2, 0); // No depth
assert(output2[0] === 0x010005); // Unchanged
```

### Integration Tests

Use annotated markdown format:

```markdown
Simple Setext
=============
1            23
@1 InlineText "Simple Setext" depth=1
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "=============" depth=1
```

Add assertions for depth values.

## Performance Considerations

### Fast-Path Optimization

Most lines don't need buffering:

```javascript
// Quick checks before considering buffering:
if (!canBeSetextText) {
  // No buffering needed
  continue;
}

if (lineIsBlank) {
  canBeSetextText = false; // Blank lines can't be heading text
  continue;
}

// Only buffer if we have tokens and next char could be underline
if (output.length > lineStartTokenIndex) {
  const nextChar = input.charCodeAt(offset);
  if (nextChar !== 61 /* = */ && nextChar !== 45 /* - */) {
    // Next line doesn't start with underline char
    // Still could be after whitespace, but that's rare
    // For most cases, skip buffering
  }
}
```

### Lookahead Window

Only look ahead 1-80 characters for underline validation:

```javascript
export function checkSetextUnderline(input, underlineStart, end) {
  // Limit scan to reasonable heading width
  const scanLimit = Math.min(end, underlineStart + 80);
  // ...
}
```

### Buffer Reuse

The module-level buffer is reused across all lines:
- Clear it after each use
- Never reallocate
- Minimal GC pressure

## Edge Cases to Handle

1. **EOF without newline:** Line might be Setext text but no newline follows
2. **Consecutive headings:** ATX followed by Setext should both work
3. **Empty Setext text:** Just whitespace + underline
4. **Very long underlines:** Ensure token length field doesn't overflow
5. **Underline with trailing spaces:** Should be valid
6. **Mixed underline chars:** `=-=` should fail validation
7. **Single char underline:** `-` is valid Setext (and thematic break - need disambiguation)

## Disambiguation Rules

From design doc:

### Setext vs Thematic Break

```markdown
Text
---
```

- If preceded by text (non-blank line): Setext heading level 2
- If preceded by blank line: Thematic break

**Implementation:** Setext pre-scan only triggers if previous line had buffered tokens.

### Setext vs List Marker

```markdown
Text
- item
```

- Single `-` followed by space = list marker, not Setext
- Require 2+ dashes for Setext underline when it could be list marker

**Implementation:** More complex, may need lookahead after the `-`.

## Summary

To correctly implement Setext heading parsing:

1. **Fix bit positions** to use 26-28 (avoid conflict with flags)
2. **Add depth propagation** to ATX headings (all inline tokens)
3. **Implement buffering logic** in scan0 (detect qualifying lines, buffer tokens)
4. **Pre-scan next line** when buffering (check for underline)
5. **Apply depth flags** when flushing buffer (if valid underline)
6. **Test thoroughly** with speculative test cases

Neither PR #53 nor PR #54 currently does this correctly. Both need significant refactoring to achieve the design specification.
