# Formula Block PRs - Code Comparison

Side-by-side comparison of key code sections from PRs #56, #57, and #58.

## 1. Scanner Function Signature

### PR #56: scan-formula.js
```javascript
/**
 * Scanner for formula/math blocks delimited by double dollar signs ($$).
 * 
 * Formula blocks can be:
 * - Block mode: $$ on separate lines with content between them
 * - Display mode: $$content$$ all on one line
 */
export function scanFormulaBlock(input, startOffset, endOffset, output) {
```

### PR #57: scan-formula-block.js
```javascript
/**
 * A simple, always-forward scanner for formula blocks (display math).
 * It scans from the opener forward one time, captures the content span and
 * detects a valid closing delimiter.
 * 
 * Formula blocks use $$ delimiters (minimum 2 dollar signs).
 */
export function scanFormulaBlock(input, startOffset, endOffset, output) {
```

### PR #58: scan-formula.js
```javascript
/**
 * A simple, always-forward scanner for formula blocks (display math).
 * Formula blocks are delimited by `$$` (or longer runs of dollar signs).
 * It scans from the opener forward one time, captures the content span and
 * detects a valid closing delimiter.
 */
export function scanFormulaBlock(input, startOffset, endOffset, output) {
```

**Analysis:** All three use the same function signature. #56 explicitly mentions dual-mode support in the comment.

---

## 2. Opening Delimiter Detection

### PR #56
```javascript
// Must start with exactly two dollar signs
if (input.charCodeAt(startOffset) !== 36 /* $ */) return 0;
if (startOffset + 1 >= endOffset || input.charCodeAt(startOffset + 1) !== 36 /* $ */) return 0;

// Verify line-start context allowing up to 3 leading spaces
const lineStart = findLineStart(input, startOffset);
const leadingSpaces = startOffset - lineStart;
if (leadingSpaces > 3) return 0;

// We have a valid $$ opener at position startOffset
let pos = startOffset + 2; // position after $$

// Determine if this is block mode or display mode
let isBlockMode = false;
if (pos < endOffset) {
  const ch = input.charCodeAt(pos);
  if (ch === 10 /* \n */ || ch === 13 /* \r */) {
    isBlockMode = true;
  }
}
```

### PR #57
```javascript
const fenceChar = input.charCodeAt(startOffset);
if (fenceChar !== 36 /* $ */) return 0;

// Verify line-start context allowing up to 3 leading spaces.
const lineStart = findLineStart(input, startOffset);
const leadingSpaces = startOffset - lineStart;
if (leadingSpaces > 3) return 0;

// Count opening run length
let pos = startOffset;
let openLen = 0;
while (pos < endOffset && input.charCodeAt(pos) === fenceChar) {
  openLen++;
  pos++;
}

if (openLen < 2) return 0; // not a formula block opener (minimum 2 dollar signs)
```

### PR #58
```javascript
const dollarChar = 36; // '$'
if (input.charCodeAt(startOffset) !== dollarChar) return 0;

// Verify line-start context allowing up to 3 leading spaces.
const lineStart = findLineStart(input, startOffset);
const leadingSpaces = startOffset - lineStart;
if (leadingSpaces > 3) return 0;

// Count opening run length
let pos = startOffset;
let openLen = 0;
while (pos < endOffset && input.charCodeAt(pos) === dollarChar) {
  openLen++;
  pos++;
}

if (openLen < 2) return 0; // not a formula block opener (single $ is inline math)
```

**Analysis:** 
- #56 checks for exactly 2 dollar signs (hardcoded for dual-mode)
- #57 and #58 count the run length (supports $$, $$$, $$$$, etc.)
- #58 has clearer variable naming (`dollarChar` vs `fenceChar`)

---

## 3. Content Start Calculation

### PR #56 (Block Mode)
```javascript
function scanBlockFormula(input, startOffset, endOffset, output, afterOpener) {
  // Skip the newline after the opener
  let contentStart = afterOpener;
  if (contentStart < endOffset) {
    const ch = input.charCodeAt(contentStart);
    if (ch === 13 /* \r */ && contentStart + 1 < endOffset && 
        input.charCodeAt(contentStart + 1) === 10 /* \n */) {
      contentStart += 2; // CRLF
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      contentStart += 1; // LF or CR
    }
  }
```

### PR #57
```javascript
// Formula blocks don't have info strings like code fences
// Content starts immediately after the opener (possibly on the same line or next line)

// Find the end of the opener line
let contentStart = pos;
while (contentStart < endOffset) {
  const ch = input.charCodeAt(contentStart);
  if (ch === 10 /* \n */ || ch === 13 /* \r */) {
    // Move past the newline
    if (ch === 13 /* \r */ && contentStart + 1 < endOffset && 
        input.charCodeAt(contentStart + 1) === 10 /* \n */) {
      contentStart += 2;
    } else {
      contentStart += 1;
    }
    break;
  }
  contentStart++;
}
```

### PR #58
```javascript
// Formula blocks don't have an info string like code fences.
// Content starts immediately after the opening delimiter.
// If there's a newline right after opener, content starts after it.
let contentStart = pos;
if (pos < endOffset) {
  const ch = input.charCodeAt(pos);
  if (ch === 13 /* \r */ && pos + 1 < endOffset && 
      input.charCodeAt(pos + 1) === 10 /* \n */) {
    contentStart = pos + 2;
  } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
    contentStart = pos + 1;
  }
}
```

**Analysis:**
- All handle CRLF correctly
- #58 has the cleanest logic (no loop, direct check)
- #57 has unnecessary loop to find end of opener line

---

## 4. Closer Detection

### PR #56 (Block Mode)
```javascript
// Now at the start of a line; skip up to 3 leading spaces
let linePos = pos;
spaceCount = 0;
while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
  spaceCount++;
  linePos++;
}

// Check if we have $$ at this position
if (linePos + 1 < endOffset && 
    input.charCodeAt(linePos) === 36 /* $ */ && 
    input.charCodeAt(linePos + 1) === 36 /* $ */) {
  
  // Verify rest of line is whitespace or end
  let validCloser = true;
  let checkPos = linePos + 2;
  while (checkPos < endOffset) {
    const ch = input.charCodeAt(checkPos);
    if (ch === 10 /* \n */ || ch === 13 /* \r */) break;
    if (ch !== 32 /* space */ && ch !== 9 /* \t */) {
      validCloser = false;
      break;
    }
    checkPos++;
  }
```

### PR #57
```javascript
// Now at the start of a line; skip up to 3 leading spaces
let linePos = p;
let spaceCount = 0;
while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
  spaceCount++;
  linePos++;
}

// If we find a run of dollar signs here, count it
if (linePos < endOffset && input.charCodeAt(linePos) === fenceChar) {
  let closeLen = 0;
  let fencePos = linePos;
  while (fencePos < endOffset && input.charCodeAt(fencePos) === fenceChar) {
    closeLen++;
    fencePos++;
  }

  if (closeLen >= openLen) {
    // Ensure rest of line is only whitespace
    let validCloser = true;
    let checkPos = fencePos;
    while (checkPos < endOffset) {
      const nextCh = input.charCodeAt(checkPos);
      if (nextCh === 10 /* \n */ || nextCh === 13 /* \r */) break;
      if (nextCh !== 32 /* space */ && nextCh !== 9 /* \t */) {
        validCloser = false;
        break;
      }
      checkPos++;
    }
```

### PR #58
```javascript
// Now at the start of a line; skip up to 3 leading spaces
let linePos = p;
let spaceCount = 0;
while (linePos < endOffset && input.charCodeAt(linePos) === 32 /* space */ && spaceCount < 3) {
  spaceCount++;
  linePos++;
}

// If we find a run of dollar signs here, count it
if (linePos < endOffset && input.charCodeAt(linePos) === dollarChar) {
  let closeLen = 0;
  let dollarPos = linePos;
  while (dollarPos < endOffset && input.charCodeAt(dollarPos) === dollarChar) {
    closeLen++;
    dollarPos++;
  }

  if (closeLen >= openLen) {
    // Ensure rest of line is only whitespace or end of line
    let validCloser = true;
    let checkPos = dollarPos;
    while (checkPos < endOffset) {
      const nextCh = input.charCodeAt(checkPos);
      if (nextCh === 10 /* \n */ || nextCh === 13 /* \r */) break;
      if (nextCh !== 32 /* space */ && nextCh !== 9 /* \t */) {
        validCloser = false;
        break;
      }
      checkPos++;
    }
```

**Analysis:**
- #56 only checks for exactly `$$` (2 dollars), limiting flexibility
- #57 and #58 count the run (`closeLen >= openLen`), allowing `$$$`, `$$$$`, etc.
- Variable naming: #58 uses `dollarChar`/`dollarPos`, #57 uses `fenceChar`/`fencePos`

---

## 5. Token Emission (Balanced Case)

### PR #56
```javascript
output.push(FormulaBlockOpen | openTokenLen);
if (contentLength > 0) output.push(FormulaBlockContent | contentLength);
output.push(FormulaBlockClose | closeTokenLen);
return closeLineEnd - startOffset;
```

### PR #57
```javascript
output.push(FormulaBlockOpen | openTokenLen);
if (contentLength > 0) output.push(FormulaBlockContent | contentLength);
output.push(FormulaBlockClose | closeTokenLen);
return closeLineEnd - startOffset;
```

### PR #58
```javascript
output.push(FormulaOpen | openTokenLen);
output.push(FormulaContent | contentLength);
output.push(FormulaClose | closeTokenLen);
return closeLineEnd - startOffset;
```

**Analysis:**
- #56 and #57 use `FormulaBlock*` token names (more explicit)
- #58 uses `Formula*` token names (shorter)
- #58 always emits content token (even if empty), #56/#57 check `contentLength > 0`

---

## 6. Unbalanced Token Emission

### PR #56 (Block Mode)
```javascript
// No closing $$ found — unbalanced
const openLen = contentStart - startOffset;
const contentLength = endOffset - contentStart;
output.push(FormulaBlockOpen | ErrorUnbalancedToken | openLen);
if (contentLength > 0) output.push(FormulaBlockContent | ErrorUnbalancedToken | contentLength);
return endOffset - startOffset;
```

### PR #57
```javascript
// No closing delimiter found before EOF: fallback to unbalanced behavior
const contentLength = endOffset - contentStart;
output.push(FormulaBlockOpen | ErrorUnbalancedToken | openLen);
if (contentLength > 0) output.push(FormulaBlockContent | ErrorUnbalancedToken | contentLength);
return endOffset - startOffset;
```

### PR #58
```javascript
// No closing delimiter found before EOF: fallback to unbalanced behaviour.
const openTokenLen = contentStart - startOffset;
const contentLength = endOffset - contentStart;
output.push(FormulaOpen | ErrorUnbalancedToken | openTokenLen);
output.push(FormulaContent | ErrorUnbalancedToken | contentLength);
return endOffset - startOffset;
```

**Analysis:**
- All handle unbalanced case correctly with `ErrorUnbalancedToken` flag
- #58 always emits content token (simpler)
- #56 and #57 check for empty content first

---

## 7. Integration with scan0.js

### All Three PRs (Identical)
```javascript
case 36 /* $ dollar sign */: {
  // Try formula block first if we could be at line start
  const consumed = scanFormulaBlock(input, offset - 1, endOffset, output);
  if (consumed > 0) {
    // Formula block detected - line cannot be Setext text
    lineCouldBeSetextText = false;
    // Apply reparse flag to first token if needed
    if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
      output[tokenStartIndex] |= IsSafeReparsePoint;
    }
    tokenCount = output.length;
    return tokenCount; // Return after handling formula block
  }
  
  // Not a formula block; fall back to inline text handling
  const consumedText = scanInlineText(input, offset - 1, endOffset, output);
  if (consumedText > 0) {
    // Apply reparse flag to first token if needed
    if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
      output[tokenStartIndex] |= IsSafeReparsePoint;
    }
    tokenCount = output.length;
    offset += consumedText - 1;
  }
  continue;
}
```

**Analysis:** Integration is identical in all three PRs. Good!

---

## 8. Test Coverage Comparison

### PR #56: Most Comprehensive (258 LOC)
```markdown
## Basic Block Formulas
Simple block formula
$$
E = mc^2
$$

## Display Math (Single Line)
Display math on one line
$$E = mc^2$$

## Empty Formulas
Empty block formula
Empty display math

## Complex LaTeX Content
Greek letters and symbols
Fraction and superscript
Matrix notation

## Formulas with Dollar Signs in Content
## Leading Spaces
## Edge Cases with Three Dollar Signs
## Formulas at Document Boundaries
## Special Characters and Escaping
## Mixed Content Before and After
## Whitespace Preservation
## Multiline Complex Formula
```

### PR #57: Minimal but Complete (119 LOC)
```markdown
## Basic double dollar sign formula block
## Triple dollar sign formula block
## Multi-line formula
## Formula with longer closing delimiter
## Formula block with leading spaces (up to 3)
## Formula content with dollar signs not at line start
## Single dollar sign - NOT a formula block
## Closer with shorter run than opener - NOT a closer (unclosed)
## Quadruple dollar sign block
## Empty formula block
```

### PR #58: Balanced Edge Cases (172 LOC)
```markdown
## Basic double dollar formula block
## Multi-line formula
## Single-line formula (opener and closer on different lines)
## Triple dollar opener and closer
## Empty formula block
## Content with single dollar signs
## Content with interior dollar run shorter than opener
## Closer with more dollars than opener
## Multi-line with various LaTeX constructs

# Edge Cases
## Single dollar - NOT a formula block
## More than 3 leading spaces - NOT a formula block
## Unclosed formula block until EOF
## Dollar run not at line start is content
## Closer with insufficient length is content
```

**Analysis:**
- #56 has most test cases but 4 fail
- #57 has fewest tests but all pass
- #58 has best balance: comprehensive edge cases + 100% pass rate

---

## Summary

| Aspect | PR #56 | PR #57 | PR #58 |
|--------|--------|--------|--------|
| **Code Style** | Complex (dual-mode) | Clean (minimal) | Clean (balanced) |
| **Token Naming** | FormulaBlock* ✅ | FormulaBlock* ✅ | Formula* ⚠️ |
| **Delimiter Support** | Only `$$` | `$$`, `$$$`, etc. ✅ | `$$`, `$$$`, etc. ✅ |
| **Display Math** | ✅ `$$x$$` | ❌ | ❌ |
| **Code Clarity** | Medium | High ✅ | High ✅ |
| **Variable Naming** | OK | Good (`fenceChar`) | Best (`dollarChar`) ✅ |
| **Test Coverage** | Most (but 4 fail) | Minimal | Balanced ✅ |
| **Bug Count** | 4 whitespace issues | 0 ✅ | 0 ✅ |

## Recommendation

**Use PR #58** as base with these adjustments:
1. Rename tokens to `FormulaBlock*` (from #56/#57)
2. Add LaTeX test cases from #56 (Greek, matrices, fractions)
3. Consider display math as future feature (from #56)
