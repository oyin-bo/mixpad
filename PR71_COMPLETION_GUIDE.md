# PR #71 Completion Guide

**Congratulations!** Your PR has been selected as the winner and will be taken forward for merging.

Your implementation was chosen for its **exceptional documentation** (498 lines of production-grade implementation details), **rigorous scan0 integration** (proper Setext heading state management), and overall **engineering quality**.

This document outlines the specific enhancements needed to complete the implementation before merge.

---

## Required Changes

### 1. Eliminate Code Duplication (Critical)

**Issue**: `scanYAMLFrontmatter()` and `scanTOMLFrontmatter()` are nearly identical functions (~180 lines each), differing only in the delimiter character. This violates DRY principles.

**Solution**: Refactor into a unified `scanDelimitedFrontmatter()` function that accepts the delimiter as a parameter.

**Reference Implementation** (from PR #70):

```javascript
/**
 * Scan YAML (---) or TOML (+++) frontmatter
 * @param {string} input
 * @param {number} startOffset
 * @param {number} endOffset
 * @param {import('./scan0.js').ProvisionalToken[]} output
 * @param {number} delimiter - Character code: 45 for '-' (YAML) or 43 for '+' (TOML)
 * @param {number} type - Frontmatter type: 0=YAML, 1=TOML
 * @returns {number} characters consumed or 0 if no match
 */
function scanDelimitedFrontmatter(input, startOffset, endOffset, output, delimiter, type) {
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

  // ... rest of unified logic (see full implementation in PR #70)
}
```

**How to Update**:

1. Keep your current logic structure (it's excellent)
2. Create a single `scanDelimitedFrontmatter(input, startOffset, endOffset, output, delimiter, type)` function
3. Delete `scanYAMLFrontmatter()` and `scanTOMLFrontmatter()`
4. Update `scanFrontmatter()` to call the unified function:

```javascript
export function scanFrontmatter(input, startOffset, endOffset, output) {
  // Front matter is only valid at absolute position 0
  if (startOffset !== 0) return 0;
  if (startOffset >= endOffset) return 0;

  const firstChar = input.charCodeAt(startOffset);

  // Detect frontmatter type by first character(s)
  if (firstChar === 45 /* - */) {
    // YAML frontmatter (---)
    return scanDelimitedFrontmatter(input, startOffset, endOffset, output, 45, 0);
  } else if (firstChar === 43 /* + */) {
    // TOML frontmatter (+++)
    return scanDelimitedFrontmatter(input, startOffset, endOffset, output, 43, 1);
  } else if (firstChar === 123 /* { */) {
    // JSON frontmatter ({...})
    return scanJSONFrontmatter(input, startOffset, endOffset, output);
  }

  return 0;
}
```

**Expected Outcome**: Reduce implementation from 402 lines to ~240 lines while maintaining all functionality.

---

### 2. Add Type Bits to Tokens (Critical)

**Issue**: Your implementation doesn't store frontmatter type information in the token bits. The semantic layer needs this to distinguish YAML from TOML from JSON without re-parsing.

**Solution**: Add type bits (26-27) to all emitted tokens.

**Reference Implementation** (from PR #72):

```javascript
// At the start of scanDelimitedFrontmatter:
const typeBits = (type & 0x3) << 26;

// When emitting tokens:
output.push(FrontmatterOpen | typeBits | openLength);
if (contentLength > 0) {
  output.push(FrontmatterContent | typeBits | contentLength);
}
output.push(FrontmatterClose | typeBits | closeLength);
```

**For JSON scanner**:

```javascript
function scanJSONFrontmatter(input, startOffset, endOffset, output) {
  const FRONTMATTER_TYPE_JSON = 2;
  const typeBits = (FRONTMATTER_TYPE_JSON & 0x3) << 26;
  
  // ... scanning logic ...
  
  // When emitting:
  output.push(FrontmatterOpen | typeBits | openLength);
  if (contentLength > 0) {
    output.push(FrontmatterContent | typeBits | contentLength);
  }
  output.push(FrontmatterClose | typeBits | closeLength);
  
  return pos - startOffset;
}
```

**Expected Outcome**: All frontmatter tokens carry type information in bits 26-27.

---

### 3. Export Type Utilities (Important)

**Issue**: The semantic layer needs an easy way to extract and identify frontmatter types from tokens.

**Solution**: Export a `FrontmatterType` enum and helper functions.

**Reference Implementation** (from PR #70):

```javascript
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
```

**Expected Outcome**: Export these three items from `scan-frontmatter.js`.

---

### 4. Add Missing Test Cases (Recommended)

**Issue**: PR #70 has 4 additional test cases covering edge cases you're missing:

1. **Multiline YAML description block** (tests complex YAML syntax)
2. **JSON with escaped quotes** (tests string escape handling)
3. **Fence-like sequences in content** (tests that `---` inside YAML content doesn't close the block)
4. **Invalid openers with content on same line** (tests `--- invalid` and `+++ invalid`)

**Tests to Add** (from PR #70):

```markdown
<--EOF
---
1
@1 FrontmatterOpen
title: "Test"
tags:
  - markdown
  - parser
description: |
  This is a multiline
  description block
1
@1 FrontmatterContent "title: \"Test\"\ntags:\n  - markdown\n  - parser\ndescription: |\n  This is a multiline\n  description block\n"
---
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "text": "She said \"hello\""
1
@1 FrontmatterContent "  \"text\": \"She said \\\"hello\\\"\"\n"
}
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
description: "---"
note: "This has --- in content"
1
@1 FrontmatterContent "description: \"---\"\nnote: \"This has --- in content\"\n"
---
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
description = "+++"
note = "This has +++ in content"
1
@1 FrontmatterContent "description = \"+++\"\nnote = \"This has +++ in content\"\n"
+++
1
@1 FrontmatterClose

<--EOF
--- invalid
1
@1 InlineText "--- invalid"

<--EOF
+++ invalid
1
@1 InlineText "+++ invalid"
```

**Where to Add**: Append these to `parse/tests/13-frontmatter.md`

**Expected Outcome**: Test count increases from 25 to 29 cases, matching best coverage.

---

## Summary Checklist

Before requesting merge approval, ensure:

- [ ] **Code duplication eliminated**: Single `scanDelimitedFrontmatter()` function for YAML/TOML
- [ ] **Type bits implemented**: All tokens include `typeBits = (type & 0x3) << 26`
- [ ] **Type utilities exported**: `FrontmatterType` enum, `getFrontmatterType()`, `getFrontmatterTypeName()`
- [ ] **Additional tests added**: 6 new test cases from PR #70
- [ ] **All tests passing**: Run `npm test` to verify
- [ ] **Documentation updated**: If needed, update docs to reflect unified function (your docs are already excellent)

---

## Why Your PR Was Chosen

Your implementation excelled in three critical areas:

1. **Documentation Excellence**: Your 498-line documentation file is production-grade, covering algorithm details, performance characteristics, edge cases, and resolved design decisions. This will be invaluable for future maintainers.

2. **Integration Rigor**: Your scan0 integration properly handles Setext heading state after frontmatter consumption:
   ```javascript
   lineStartOffset = offset;
   lineTokenStartIndex = output.length;
   lineCouldBeSetextText = false;
   ```
   This shows deep understanding of parser state interactions.

3. **Code Clarity**: Your separate functions for YAML/TOML/JSON make debugging easier, even though they create duplication. With the refactoring above, you'll have both clarity AND maintainability.

---

## Evidence of Issues

### Code Duplication Evidence

Lines 48-187 (`scanYAMLFrontmatter`) and lines 189-322 (`scanTOMLFrontmatter`) are structurally identical:

```javascript
// Both functions have this same structure:
// 1. Validate exactly 3 characters (lines 50-53 vs 200-202)
// 2. Check for newline/space/tab (lines 56-90 vs 206-234)  
// 3. Emit opening fence (lines 93-94 vs 237-238)
// 4. Scan for content and closing (lines 97-177 vs 241-313)
// 5. Emit content/closer or error (lines 149-186 vs 288-322)
```

The only differences are:
- Character code: `45` vs `43`
- Comment text: `---` vs `+++`

This is a textbook case for function parameterization.

### Missing Type Bits Evidence

Your current token emissions (e.g., line 94, 157, 162):

```javascript
output.push(FrontmatterOpen | openLength);
if (contentLength > 0) output.push(FrontmatterContent | contentLength);
output.push(FrontmatterClose | closeLength);
```

These lack type information. PR #72's approach includes it:

```javascript
output.push(FrontmatterOpen | typeBits | openLength);
if (contentLength > 0) output.push(FrontmatterContent | typeBits | contentLength);
output.push(FrontmatterClose | typeBits | closeLength);
```

The semantic layer needs this to avoid re-parsing the opener to determine type.

### Test Coverage Evidence

Your test file has 199 lines vs PR #70's 253 lines. Missing tests were identified by:
1. Line count comparison (199 vs 253 = 54 lines difference)
2. Content diff showing PR #70 has additional edge cases
3. Test case count: 25 (yours) vs 29 (PR #70)

The additional tests cover real-world scenarios that users will encounter.

---

## Questions or Concerns?

If you have questions about these changes or need clarification on any implementation details, please comment on PR #71. The reviewer who analyzed these three PRs will respond.

**Timeline**: Please complete these changes at your earliest convenience. The implementation is otherwise excellent and ready for merge once these enhancements are in place.

Thank you for your outstanding work on this feature!
