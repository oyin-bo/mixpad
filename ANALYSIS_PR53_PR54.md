# Analysis of PRs #53 and #54: ATX and Setext Heading Parsing

## Executive Summary

Both PR #53 and PR #54 attempt to implement Markdown heading parsing (ATX and Setext styles) for MixPad. However, **neither PR correctly implements the speculative parsing requirement for Setext headings** as specified in `parse/docs/11-headings.md`.

## The Speculative Parsing Requirement

### Why Setext Requires Speculative Parsing

Setext headings have a unique ambiguity:

```markdown
This is text
===========
```

When the scanner encounters "This is text", it cannot know if this is:
1. A regular paragraph line, OR
2. The text of a Setext heading (if the next line is an underline)

The scanner **must not emit tokens** for "This is text" until it checks the next line. This is **speculative parsing** - buffering tokens until enough context resolves the ambiguity.

### The Design Specification (from 11-headings.md)

The design document specifies:

1. **Module-level reusable buffer** to hold tokens during speculation
2. **Pre-scan the next line** when a qualifying line completes
3. **Apply heading depth flags** to buffered tokens if underline is valid
4. **Flush without flags** if underline is invalid
5. **Zero-allocation** constraint - buffer is reused, not reallocated

## Critical Analysis of PR #53

### What PR #53 Implements

**File: `parse/scan-setext-heading.js`**
- ✓ `checkSetextUnderline()` function validates underline syntax
- ✗ No buffering mechanism
- ✗ No module-level buffer
- ✗ No integration with scan0 for speculation

**File: `parse/scan0.js`**
```javascript
case 45 /* - hyphen-minus */: {
  // Try Setext underline first
  const setextResult = checkSetextUnderline(input, offset - 1, endOffset);
  if (setextResult.isValid) {
    output.push(SetextHeadingUnderline | setextResult.length);
    tokenCount++;
    offset += setextResult.consumedLength - 1;
    continue;
  }
  // ... falls through to bullet list marker
}
```

### The Problem with PR #53

**Eager emission**: When scan0 encounters `-` or `=`, it checks if it's a valid underline and emits `SetextHeadingUnderline` immediately. But:

1. The **previous line's tokens have already been emitted** without heading depth flags
2. There is **no mechanism to go back** and retroactively mark those tokens
3. The semantic layer would receive:
   - `InlineText "This is text"` with depth=0 (NOT in a heading)
   - `NewLine`
   - `SetextHeadingUnderline "==="` with depth=1 (IS in a heading)
   
This is **inconsistent** and violates the design specification that "all tokens within a heading carry heading depth flags."

## Critical Analysis of PR #54

### What PR #54 Implements

**File: `parse/scan-setext-heading.js`**
- ✓ Module-level buffer declared: `let setextBuffer = []`
- ✓ `flushSetextBuffer()` function to apply depth flags
- ✓ `bufferSetextToken()` function to add tokens
- ✓ Helper functions for buffer management
- ✗ **Never called from scan0.js**

**File: `parse/scan0.js`**
- Only implements ATX heading scanning
- NO integration for Setext buffering
- NO calls to `bufferSetextToken()` or `flushSetextBuffer()`

### The Problem with PR #54

PR #54 has the **infrastructure** for speculative parsing (the buffer and functions) but **never uses it**. The scan0 integration is missing entirely:

1. When scanning a potential Setext heading text line, tokens are emitted directly to output
2. The buffer functions are dead code
3. Setext headings cannot be recognized at all (no underline checking in scan0)

## Comparison Table

| Feature | Design Spec | PR #53 | PR #54 |
|---------|-------------|--------|--------|
| ATX heading recognition | ✓ | ✓ | ✓ |
| ATX depth encoding | bits 28-30 | ✗ No depth bits | bits 26-28 |
| Setext underline validation | ✓ | ✓ | ✓ |
| Module-level buffer | ✓ | ✗ Missing | ✓ Present but unused |
| Buffer token function | ✓ | ✗ Missing | ✓ Present but unused |
| Flush with depth flags | ✓ | ✗ Missing | ✓ Present but unused |
| scan0 integration for buffering | ✓ | ✗ Missing | ✗ Missing |
| Speculative line detection | ✓ | ✗ Missing | ✗ Missing |
| Pre-scan next line | ✓ | ✓ Partial | ✗ Missing |

## The Missing Implementation

Neither PR implements the critical scan0 logic:

```javascript
// MISSING FROM BOTH PRs:
// At end of line in scan0 main loop
if (isQualifyingLineForSetext(output, tokenStartIndex)) {
  // Buffer this line's tokens instead of leaving them in output
  const lineTokens = output.slice(tokenStartIndex);
  output.length = tokenStartIndex; // Remove from output
  
  // Add to Setext buffer
  for (const token of lineTokens) {
    bufferSetextToken(token);
  }
  
  // Pre-scan next line
  const setextResult = checkSetextUnderline(input, offset, endOffset);
  
  if (setextResult.isValid) {
    // Flush buffered tokens WITH heading depth
    flushSetextBuffer(output, setextResult.depth);
    // Emit underline token
    const depthBits = (setextResult.depth & 0x7) << 28;
    output.push(setextResult.length | SetextHeadingUnderline | depthBits);
    offset += setextResult.consumedLength;
  } else {
    // Flush buffered tokens WITHOUT heading depth
    flushSetextBuffer(output, 0);
  }
  
  clearSetextBuffer();
}
```

## Bit Position Discrepancy

The design doc specifies bits 28-30 for heading depth, but PR #54 uses bits 26-28:

```javascript
// PR #54:
const depthBits = (depth & 0x7) << 26; // bits 26-28

// Design doc says:
// "Bits 28-30: Heading depth (0 = not in heading, 1-6 = ATX levels)"
```

This discrepancy needs to be resolved. The design doc also shows the current token structure uses bits 29-30 for flags (`IsSafeReparsePoint`, `ErrorUnbalancedToken`), which would conflict with bits 28-30 for depth.

## Test Coverage Analysis

### PR #53 Tests (parse/tests/11-headings.md)
- 56 test cases total
- Comprehensive coverage of ATX and Setext syntax
- **But test expectations don't account for depth encoding**
- Example:
  ```markdown
  # Heading 1
  1
  @1 ATXHeadingOpen "#"
  @2 InlineText " Heading 1"
  ```
  
  Missing: depth=1 assertions on all tokens

### PR #54 Tests (parse/tests/9-atx-headings.md)
- 27 test cases
- Focuses only on ATX headings
- **Also missing depth assertions**

### Missing Test Case

Neither PR tests the **critical speculative behavior**:

```markdown
Text that could be heading
==========================

Text that is just text
Not an underline here
```

Expected behavior:
- First "Text that could be heading" gets depth=1 flags when underline is confirmed
- Second "Text that is just text" gets NO depth flags (no valid underline follows)

## Recommendations

### Immediate Fixes Required

1. **Implement speculative parsing in scan0.js**
   - Detect qualifying lines (plain text without block markers)
   - Buffer tokens instead of emitting
   - Pre-scan next line for underline
   - Apply depth flags conditionally

2. **Resolve bit position for depth**
   - Design doc says bits 28-30
   - scan-token-flags.js uses bits 29-30 for flags
   - **Suggest using bits 26-28 (as PR #54 does) to avoid conflict**
   - Update design doc to reflect this

3. **Add depth encoding to all tests**
   - Every token within a heading should show its depth
   - Tests should verify depth propagation

4. **Test speculative behavior**
   - Create tests showing lines that ARE promoted to headings
   - Create tests showing lines that are NOT promoted
   - Verify depth flags applied correctly

### Long-term Considerations

1. **Reparse points interaction**
   - Setext headings consume multiple lines
   - How does this affect safe reparse point detection?
   - Need to ensure reparse points aren't marked mid-heading

2. **Performance optimization**
   - Minimize buffering to only qualifying lines
   - Fast-path for obvious non-heading lines
   - Buffer should be cleared promptly

## Conclusion

**Neither PR #53 nor PR #54 correctly implements Setext heading parsing.** Both are missing the critical speculative/buffering mechanism that allows the scanner to retroactively apply heading depth flags to a line's tokens after seeing the next line.

PR #54 is closer to correct (it has the buffer infrastructure), but still lacks the scan0 integration. PR #53 has better test coverage but no infrastructure for speculation.

A correct implementation requires:
1. The buffer infrastructure from PR #54
2. New scan0 integration logic (not present in either PR)
3. Tests that verify speculative behavior (not present in either PR)
4. Resolution of the bit position conflict
