# PR #67 Completion Guide: Final Steps to Merge

**Congratulations!** PR #67 has been selected as the winning implementation for GFM table scanning.

Your implementation was chosen for its:
- ✅ **Best architecture**: Clear scan0 vs semantic layer separation
- ✅ **Best documentation**: 321 lines of comprehensive, philosophy-aligned documentation  
- ✅ **Comprehensive tests**: 37 test assertions
- ✅ **Minimal scan0 footprint**: Clean, focused integration
- ✅ **Philosophy alignment**: Perfectly follows MixPad's zero-allocation, two-phase approach

This document outlines the **required fixes and enhancements** needed before merge.

---

## 🚨 Critical Bug Fix Required

### Issue: Minimum Dash Requirement

**Location**: `parse/scan-table.js`, line 95

**Current Code (WRONG):**
```javascript
// Must have at least one dash
let dashCount = 0;
while (pos < end && input.charCodeAt(pos) === 45) { // '-'
  dashCount++;
  pos++;
}

if (dashCount === 0) return 0;  // ❌ WRONG - accepts single dash!
```

**Required Fix:**
```javascript
// Must have at least one dash
let dashCount = 0;
while (pos < end && input.charCodeAt(pos) === 45) { // '-'
  dashCount++;
  pos++;
}

if (dashCount < 3) return 0;  // ✅ CORRECT - GFM requires minimum 3 dashes
```

**Why This Matters:**
- GFM specification requires **minimum 3 dashes** per delimiter cell
- Current code accepts invalid tables like `| - |` or `| -- |`
- This violates the spec and will cause interoperability issues

**Evidence from GFM Spec:**
> "Each cell must contain at least three hyphens (`---`)"

**Test Case to Add:**
```markdown
Too few dashes (invalid):
| - |
1
@1 InlineText

Two dashes (invalid):
| -- |
1
@1 InlineText

Three dashes (valid):
| --- |
1
@1 TablePipe
```

---

## ⚠️ Required Enhancements

### 1. Explicit Pipe Requirement Validation

**Issue**: GFM spec requires at least one pipe to distinguish from Setext headings, but this isn't explicitly validated.

**Location**: `parse/scan-table.js`, `checkTableDelimiterRow` function

**Current Implementation:**
Your code implicitly requires pipes through the parsing logic, but doesn't make this explicit.

**Add This Validation** (from PR #68):
```javascript
export function checkTableDelimiterRow(input, lineStart, end) {
  let pos = lineStart;
  let cellCount = 0;
  let hasPipes = false;  // ← ADD THIS
  let foundAnyDash = false;  // ← ADD THIS
  
  // ... existing parsing logic ...
  
  // Parse pipe separator
  if (ch === 124 /* | */) {
    hasPipes = true;  // ← TRACK PIPE PRESENCE
    pos++;
  }
  
  // ... continue parsing ...
  
  // Must have at least one dash, at least one pipe, and at least one column
  // A table delimiter MUST contain at least one pipe character
  if (!foundAnyDash || !hasPipes || cellCount === 0) {  // ← EXPLICIT CHECK
    return { isValid: false, cellCount: 0 };
  }
  
  return { isValid: hasPipes && cellCount > 0, cellCount };
}
```

**Why This Matters:**
Without explicit pipe requirement, `--- text ---` could be mistaken for a table delimiter when it should be a Setext heading underline.

**Test Cases to Add** (from PR #68):
```markdown
Dashes without pipes (not a table):
--- text ---
1
@1 InlineText

Single pipe required (valid):
--- | ---
1
@1 TableDelimiterRow

No pipes anywhere (invalid):
--- text --- more ---
1
@1 InlineText
```

---

### 2. Indentation Limit Validation

**Issue**: Tables indented 4+ spaces should be treated as code blocks, not tables.

**Location**: `parse/scan-table.js`, `scanTablePipe` or `checkTableDelimiterRow`

**Add This Check** (from PR #68):
```javascript
import { countIndentation, findLineStart } from './scan-core.js';

export function scanTableDelimiterRow(input, start, end, output) {
  if (start >= end) return 0;
  
  // Check line indentation (must be ≤ 3 spaces)
  const lineStart = findLineStart(input, start);
  const lineIndent = countIndentation(input, lineStart, start);
  if (lineIndent > 3) return 0;  // ← ADD THIS CHECK
  
  // Must be first non-whitespace character on line
  if (lineStart + lineIndent !== start) return 0;
  
  // ... rest of your existing code ...
}
```

**Why This Matters:**
- GFM spec: "Tables can be indented up to 3 spaces"
- 4+ spaces = code block, not a table
- Without this check, code examples containing pipes will be incorrectly parsed

**Test Cases to Add** (from PR #68):
```markdown
Too much indentation (4 spaces - code block):
    | --- | --- |
1   2
@1 Whitespace "    "
@2 InlineText "| --- | --- |"

Valid indentation (3 spaces):
   | --- | --- |
1  2
@1 Whitespace "   "
@2 TableDelimiterRow

Valid indentation (1 space):
 | --- | --- |
12
@1 Whitespace " "
@2 TableDelimiterRow
```

---

### 3. Additional Test Cases from Other PRs

Your test coverage is good (37 assertions), but these specific edge cases from other PRs should be added:

#### From PR #66: Entity Interaction
```markdown
Table cell with entity:
| &amp; |
1 2     3
@1 TablePipe "|"
@2 EntityNamed "&amp;"
@3 TablePipe "|"
```

#### From PR #66: Escaped Pipe
```markdown
Table cell with escaped pipe:
| a\| |
1 23  4
@1 TablePipe "|"
@2 InlineText "a"
@3 Escaped "\|"
@4 TablePipe "|"
```

#### From PR #68: Invalid Cases (Comprehensive)
```markdown
No dashes (invalid):
| | |
1
@1 InlineText "| | |"

Only pipes (invalid):
|||
1
@1 InlineText "|||"

Mixed with text (invalid):
| --- | text |
1
@1 InlineText "| --- | text |"

Colons without dashes (invalid):
| : | : |
1
@1 InlineText "| : | : |"
```

#### From PR #68: Dash Count Variations
```markdown
Minimum dashes (three per column):
| --- | --- |
1
@1 TableDelimiterRow

Many dashes (valid):
| ---------- | ---------- |
1
@1 TableDelimiterRow

Mixed dash counts (valid):
| --- | - | ---------- |
1
@1 TableDelimiterRow

Note: The second cell with single dash should FAIL with your bug fix!
```

#### From PR #69: Pipes in Code
```markdown
Pipe inside inline code (literal, not table):
`code|pipe`
12        3
@1 BacktickBoundary "`"
@2 InlineCode "code|pipe"
@3 BacktickBoundary "`"
```

---

## 📋 Complete Checklist

### Critical Fixes (MUST DO)
- [ ] Fix minimum dash requirement: `if (dashCount < 3) return 0;`
- [ ] Add explicit pipe requirement validation
- [ ] Add indentation limit check (≤ 3 spaces)
- [ ] Verify fix with test: `| - |` should be rejected
- [ ] Verify fix with test: `| -- |` should be rejected  
- [ ] Verify fix with test: `| --- |` should be accepted

### Enhanced Validation (SHOULD DO)
- [ ] Add test: dashes without pipes rejected
- [ ] Add test: 4+ space indentation rejected
- [ ] Add test: 3 space indentation accepted
- [ ] Add test: no dashes rejected
- [ ] Add test: only pipes rejected
- [ ] Add test: colons without dashes rejected

### Edge Case Coverage (SHOULD DO)
- [ ] Add test: entity in table cell (`| &amp; |`)
- [ ] Add test: escaped pipe in cell (`| a\| |`)
- [ ] Add test: pipe in inline code (not a table)
- [ ] Add test: mixed dash counts (after minimum 3 enforced)

### Verification (MUST DO)
- [ ] Run `npm test` - all tests pass
- [ ] Manually verify invalid cases are rejected
- [ ] Manually verify valid cases still work
- [ ] Check no regressions in other tests

---

## 🔍 Testing Your Changes

### Run Specific Table Tests
```bash
node --test --test-name-pattern="tables" parse/tests/test-produce-annotated.js
```

### Run All Tests
```bash
npm test
```

### Expected Results
- All 313 existing tests should still pass
- New invalid-case tests should show tokens as `InlineText`, not table tokens
- Valid table tests should show `TablePipe`, `TableDelimiterCell` tokens

---

## 📝 Code Snippets Library

### Complete `checkTableDelimiterRow` with All Fixes

```javascript
/**
 * Check if a line looks like a table delimiter row
 * 
 * A delimiter row consists of pipes and delimiter cells.
 * This is a lookahead function used by semantic analysis.
 * 
 * @param {string} input - The input text
 * @param {number} lineStart - Start of line
 * @param {number} end - End index (exclusive)
 * @returns {{ isValid: boolean, cellCount: number }} Whether line is a valid delimiter row
 */
export function checkTableDelimiterRow(input, lineStart, end) {
  let pos = lineStart;
  let cellCount = 0;
  let hasPipes = false;
  let foundAnyDash = false;
  
  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Check for leading pipe (optional)
  if (pos < end && input.charCodeAt(pos) === 124) { // '|'
    hasPipes = true;
    pos++;
  }
  
  // Process cells
  while (pos < end) {
    const ch = input.charCodeAt(pos);
    
    // Stop at newline
    if (ch === 10 || ch === 13) break;
    
    // Skip whitespace before cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    if (pos >= end || input.charCodeAt(pos) === 10 || input.charCodeAt(pos) === 13) break;
    
    // Parse delimiter cell
    const cellStart = pos;
    
    // Optional leading colon
    if (pos < end && input.charCodeAt(pos) === 58) pos++; // ':'
    
    // Must have at least 3 dashes (CRITICAL FIX)
    let dashCount = 0;
    while (pos < end && input.charCodeAt(pos) === 45) { // '-'
      dashCount++;
      pos++;
    }
    
    if (dashCount < 3) return { isValid: false, cellCount: 0 };  // ✅ FIXED
    foundAnyDash = true;
    
    // Optional trailing colon
    if (pos < end && input.charCodeAt(pos) === 58) pos++; // ':'
    
    cellCount++;
    
    // Skip whitespace after cell content
    while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
      pos++;
    }
    
    if (pos >= end) break;
    
    const nextCh = input.charCodeAt(pos);
    if (nextCh === 10 || nextCh === 13) break;
    
    // Expect pipe separator
    if (nextCh === 124) { // '|'
      hasPipes = true;
      pos++;
    } else {
      // No pipe - only valid if this is the last cell and no leading pipe was used
      return { isValid: false, cellCount: 0 };
    }
  }
  
  // Must have at least one dash, at least one pipe, and at least one column
  // A table delimiter MUST contain at least one pipe character
  if (!foundAnyDash || !hasPipes || cellCount === 0) {
    return { isValid: false, cellCount: 0 };
  }
  
  // Valid if we found at least one cell and at least one pipe
  return { isValid: hasPipes && cellCount > 0, cellCount };
}
```

### Complete `scanTableDelimiterCell` with Minimum Dash Fix

```javascript
/**
 * Scan table delimiter cell (part of delimiter row)
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a delimiter cell
 */
export function scanTableDelimiterCell(input, start, end, output) {
  if (start >= end) return 0;
  
  let pos = start;
  
  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  if (pos >= end) return 0;
  
  // Check for leading colon
  let hasLeadingColon = false;
  if (input.charCodeAt(pos) === 58) { // ':'
    hasLeadingColon = true;
    pos++;
  }
  
  if (pos >= end) return 0;
  
  // Must have at least 3 dashes (CRITICAL FIX)
  let dashCount = 0;
  while (pos < end && input.charCodeAt(pos) === 45) { // '-'
    dashCount++;
    pos++;
  }
  
  if (dashCount < 3) return 0;  // ✅ FIXED - was: if (dashCount === 0)
  
  // Check for trailing colon
  let hasTrailingColon = false;
  if (pos < end && input.charCodeAt(pos) === 58) { // ':'
    hasTrailingColon = true;
    pos++;
  }
  
  // Skip trailing whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Determine alignment
  // 0 = explicit left (:---), 1 = center (:---:), 2 = right (---:), 3 = default/unspecified (---)
  let alignment = 3; // default/unspecified
  if (hasLeadingColon && hasTrailingColon) {
    alignment = 1; // center
  } else if (hasLeadingColon) {
    alignment = 0; // explicit left
  } else if (hasTrailingColon) {
    alignment = 2; // right
  }
  
  const length = pos - start;
  const alignmentBits = alignment << 26;
  
  output.push(length | TableDelimiterCell | alignmentBits);
  
  return length;
}
```

---

## 🎯 Summary

Your PR #67 is architecturally sound and well-documented. The changes needed are:

1. **Critical**: Fix minimum dash count (1 line change)
2. **Important**: Add explicit pipe validation (a few lines)
3. **Important**: Add indentation limit check (a few lines)
4. **Enhancement**: Add comprehensive test cases (copy from snippets above)

Once these fixes are in place, your PR will be ready to merge as the definitive GFM table scanning implementation for MixPad.

---

## 📚 Reference

- **GFM Spec**: https://github.github.com/gfm/#tables-extension-
- **Your PR**: #67
- **Review Document**: `PR_REVIEW_ANALYSIS.md`
- **Test Format**: MixPad Annotated Markdown (`parse/tests/12-tables.md`)

---

**Questions?** The review document has detailed analysis and code samples from all five PRs that can help guide your implementation.
