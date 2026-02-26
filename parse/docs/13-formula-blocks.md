% Formula Blocks — Implementation & Test Plan

This document describes the plan to implement formula (math) blocks in the scanner layer. Formula blocks use LaTeX-style `$$` delimiters for display math, similar to how code fences use triple backticks or tildes.

## Goals

- Recognize formula blocks delimited by runs of dollar signs (`$`) with a minimum run length of 2 (i.e., `$$`).
- Support both display math blocks (`$$...$$`) as a standard extension to Markdown.
- Emit provisional tokens suitable for the parser to reconstruct a formula block node: opener, content payload, and closer.
- Provide exhaustive annotated-markdown tests that serve as documentation and authoritative spec for scanner behaviour.
- Follow the zero-allocation architecture principles of MixPad.

## Constraints & Project Rules

- Plain JavaScript with JSDoc — no TypeScript.
- No build step. Tests run with `npm test`.
- All additions must fit the testing harness and annotated-markdown philosophy.
- No temporary helper scripts or non-committed debug files.

## Token Model (Provisional Tokens)

Formula blocks will use new token types following the pattern established by fenced code blocks:

- **FormulaOpen**: Encodes the opening `$$` delimiter (length typically 2).
- **FormulaContent**: Represents the raw content span length (no string allocations until parser requests content).
- **FormulaClose**: Encodes the closing `$$` delimiter (length matches or exceeds opener).
- Use existing **ErrorUnbalancedToken** flag for cases where opener exists but no balanced closer is found.

## Scanner Algorithm (Streaming, Allocation-Sparing)

### 1. Detection

- At each position where `input.charCodeAt(pos)` is `36` (dollar sign), attempt formula block parse only when at a line-start context that permits a block opener.
- Similar to fenced blocks, formula blocks must appear at the start of a line (allowing up to 3 leading spaces).
- The scanner must verify it's operating in a line-start context before treating `$$` as a block delimiter.

### 2. Opening Run

- Count consecutive dollar signs starting at `openerStart` to obtain `openLen`.
- Require `openLen >= 2` to be a valid block formula opener (single `$` is for inline math, not implemented here).
- If `openLen < 2`, do not treat as formula block.

### 3. Content Scan

- After the opening run, the content starts immediately (on the same line or the next line).
- Scan forward for a closing run: a run of dollar signs with length >= `openLen`, appearing at the start of a line (allowing up to 3 leading spaces).
- While scanning, all text (including lines with dollar signs) is content unless it matches a valid closer.
- Support both LF and CRLF line endings.

### 4. Balanced vs Unbalanced

- **Balanced:** If a closer is found, emit FormulaOpen, FormulaContent (length up to start of closer), and FormulaClose.
- **Unbalanced:** If no closer is found before EOF, emit FormulaOpen | ErrorUnbalancedToken and FormulaContent | ErrorUnbalancedToken. The parser will handle error recovery.

## Edge Cases and Policy Decisions

### Mixed Delimiter Counts

- An opener of length N (e.g., `$$`) must be closed by a run of at least N dollar signs.
- Longer closing runs are permitted (e.g., opener `$$`, closer `$$$` is valid).

### Interior Dollar Signs

- Single dollar signs or runs shorter than the opener length inside the content are treated as content, not closers.
- Runs that equal or exceed opener length but are not at line-start (or have more than 3 leading spaces) are content.

### Line-Start Context

- Formula blocks must begin at the start of a line (after up to 3 spaces).
- This distinguishes them from potential inline math (single `$`), though inline math is not implemented in this scanner.

### Content Span

- The content includes everything between the opener and closer, including newlines.
- The scanner records the content length without allocating substrings.
- Newlines are included in the content (similar to fenced blocks).

### Whitespace and Indentation

- Allow up to 3 leading spaces before opener and closer.
- Tabs count as single characters (project convention).
- No special column calculation at scanner level.

### CRLF vs LF

- Accept both line ending styles.
- Use character indices in the original input string.
- Leave normalization to higher layers.

### Nested Blocks

- Formula blocks do not nest. Interior `$$` runs that don't meet closer criteria are content.

## Annotated-Markdown Tests

Create comprehensive test cases under `parse/tests/12-formula-blocks.md`:

### Happy Path Cases

- Basic double dollar block:
  ```
  $$
  E = mc^2
  $$
  ```
- Single-line formula:
  ```
  $$x^2 + y^2 = z^2$$
  ```
- Multi-line formula with complex LaTeX:
  ```
  $$
  \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
  $$
  ```
- Triple dollar opener and closer:
  ```
  $$$
  formula content
  $$$
  ```

### Edge Cases

- Single dollar sign — should NOT parse as formula block (could be inline math or literal).
- Unclosed formula until EOF — should emit unbalanced tokens.
- Leading up to 3 spaces before opener and closer.
- Content containing dollar signs (e.g., `Money: $50 or $100`) that don't form a closer.
- Closer with more dollars than opener (e.g., opener `$$`, closer `$$$`).
- Windows CRLF line endings.
- Empty formula block (`$$\n$$`).

## Integration Steps

1. **Add token types** to `parse/scan-tokens.js`: FormulaOpen, FormulaContent, FormulaClose.
2. **Create annotated tests** in `parse/tests/12-formula-blocks.md` (specification-first approach).
3. **Implement scanner** in `parse/scan-formula.js` following the pattern from `scan-fences.js`.
4. **Wire into scan0.js** to call the new scanner when encountering dollar signs at potential opener positions.
5. **Run tests** with `npm test` and iterate.

## Implementation Pattern

The implementation will mirror `scan-fences.js`:

- Pattern B: complex scanner that pushes tokens and returns consumed length.
- Single forward pass, no backtracking.
- Index-based scanning, no string allocations.
- Consistent error handling with ErrorUnbalancedToken flag.

## Quality Gates

- All existing tests must continue to pass.
- New annotated tests must pass.
- Code style must match existing conventions (JSDoc, no trailing commas, T[] array syntax).

## Deliverables

1. `parse/docs/13-formula-blocks.md` (this file) — implementation plan and spec.
2. `parse/tests/12-formula-blocks.md` — comprehensive annotated test suite.
3. `parse/scan-formula.js` — scanner implementation.
4. Updates to `parse/scan-tokens.js` — new token types.
5. Updates to `parse/scan0.js` — integration of formula scanner.

## Notes

- This implementation handles block-level formulas only. Inline math (single `$`) is not in scope.
- The scanner is stateless and allocation-free during the hot path.
- Formula content is preserved verbatim; LaTeX processing is the responsibility of higher layers.
