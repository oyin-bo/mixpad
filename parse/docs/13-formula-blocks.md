# Formula Blocks — Implementation & Test Plan

This document describes the implementation of formula/math blocks in the scanner layer. Formula blocks use double dollar sign (`$$`) delimiters and are commonly used for mathematical expressions in extended Markdown formats like GitHub Flavored Markdown and Jupyter notebooks.

## Goals

- Recognize formula blocks delimited by runs of `$$` (double dollar signs)
- Support both block-level formula blocks (delimiters on separate lines) and inline display math
- Capture the formula content without allocating substrings until parsing phase
- Emit provisional tokens suitable for the parser to reconstruct a formula node
- Provide exhaustive annotated-markdown tests as specification

## Syntax Overview

Formula blocks follow a similar pattern to fenced code blocks but use `$$` as the delimiter:

**Block formula** (delimiters on separate lines):
```
$$
E = mc^2
$$
```

**Display math** (all on one line):
```
$$E = mc^2$$
```

## Token Model (Provisional Tokens)

Following the existing pattern used for fenced code blocks, we define:

- **FormulaBlockOpen**: Marks the opening `$$` delimiter
- **FormulaBlockContent**: Represents the raw formula content span (LaTeX/TeX syntax)
- **FormulaBlockClose**: Marks the closing `$$` delimiter
- Use existing `ErrorUnbalancedToken` flag when opener exists but no balanced closer is found

## Scanner Algorithm

### Detection Rules

1. **Line-start context**: Formula block openers must appear at the start of a line (allowing up to 3 leading spaces, consistent with fence blocks)
2. **Delimiter**: Must be exactly two consecutive dollar signs (`$$`)
3. **Differentiation from inline math**: Single `$` is for inline math (separate scanner), `$$` is for block/display math

### Opening Delimiter

1. At a valid line-start position, detect `$$` (character code 36 repeated twice)
2. The opener can be:
   - On its own line (block formula) — content starts on next line
   - Followed by content on same line (display math) — content starts immediately after `$$`

### Content Scanning

- **Block mode**: If opener is followed by newline, scan forward line-by-line until finding a closing `$$` at line-start
- **Display mode**: If opener is followed by non-newline content, scan until finding `$$` before end of line
- Do not allocate content substring during scanning; store start position and length
- Support both LF and CRLF line endings

### Closing Delimiter

- **Block mode**: Closing `$$` must appear at start of a line (up to 3 leading spaces allowed)
- **Display mode**: Closing `$$` must appear on the same line as opener
- Closer must be exactly `$$` (two dollar signs)

### Balanced vs Unbalanced

- **Balanced**: Emit FormulaBlockOpen, FormulaBlockContent, FormulaBlockClose
- **Unbalanced**: Emit FormulaBlockOpen | ErrorUnbalancedToken and FormulaBlockContent | ErrorUnbalancedToken

## Edge Cases and Policy Decisions

- **Single dollar sign**: Not a formula block delimiter; handled separately for inline math
- **Three or more dollar signs**: Treated as `$$` delimiter followed by content starting with `$`
- **Dollar signs inside formula**: Interior `$$` that are not at valid delimiter positions are content
- **Empty formula**: Valid — `$$$$` on same line or `$$` followed by `$$` on next line
- **Nested formulas**: Not supported; first valid closer terminates the block
- **Whitespace**: Leading/trailing spaces in formula content are preserved (no normalization)
- **Indentation**: Up to 3 spaces allowed before opener and closer (consistent with fences)
- **Mixed line endings**: Accept both LF and CRLF

## Implementation Pattern

Following the existing `scan-fences.js` pattern:

1. Create `parse/scan-formula.js` with `scanFormulaBlock(input, startOffset, endOffset, output)` function
2. Entry point: when `scan0` encounters `$` at a potential block-start position
3. Check for double dollar sign (`$$`)
4. Determine block vs display mode based on content after opener
5. Scan for matching closer
6. Emit appropriate tokens

## Integration Steps

1. Add token constants to `parse/scan-tokens.js`
2. Create `parse/scan-formula.js` scanner module
3. Create annotated-markdown tests in `parse/tests/`
4. Wire scanner into `parse/scan0.js`
5. Run tests and iterate

## Test Coverage Required

The annotated Markdown tests must cover:

### Basic Cases
- Block formula with content on separate lines
- Display math (all on one line)
- Empty formula block
- Formula with simple LaTeX (e.g., `E = mc^2`)

### Edge Cases
- Unclosed formula block (EOF without closer)
- Formula with interior dollar signs
- Formula with special characters and symbols
- Formula with leading/trailing spaces
- Mixed content (formula with newlines, Greek letters, operators)
- Three dollar signs (should parse as `$$` + `$` in content)
- Formula at start of document
- Formula at end of document

### Error Cases
- Single `$` should not trigger formula block scanner
- Mismatched delimiters (block opener with display closer or vice versa)

## Example Token Sequences

**Block formula**:
```
Input:
$$
x = y + z
$$

Tokens:
FormulaBlockOpen (length: 3 including newline)
FormulaBlockContent (length: 10 "x = y + z\n")
FormulaBlockClose (length: 3 including newline)
```

**Display math**:
```
Input:
$$E = mc^2$$

Tokens:
FormulaBlockOpen (length: 2)
FormulaBlockContent (length: 8 "E = mc^2")
FormulaBlockClose (length: 2)
```

## Constraints

- JavaScript with JSDoc only (no TypeScript)
- No build step — direct execution
- Tests run with `npm test`
- Follow existing code style (no trailing commas, use T[] for arrays)
- Allocation-sparing: use indices and lengths, avoid substring allocation during scanning
- Linear time complexity: each character visited at most once

## Deliverables

1. `parse/docs/13-formula-blocks.md` (this document)
2. `parse/scan-formula.js` — scanner implementation
3. `parse/tests/12-formulas.md` — annotated test file
4. Updated `parse/scan-tokens.js` — token constants
5. Updated `parse/scan0.js` — integration

## Next Steps

1. Add token constants
2. Create annotated test file with comprehensive test cases
3. Implement scanner following fence scanner pattern
4. Wire into scan0
5. Run tests and iterate until all pass
