# Formula Blocks — Implementation & Test Plan

This document describes the implementation plan for formula blocks (display math) in the scanner layer. Formula blocks follow the same general pattern as fenced code blocks but use `$$` delimiters instead of backticks or tildes.

## Goals

- Recognize formula blocks delimited by runs of dollar signs (`$`) with a minimum run length of 2.
- Support both block-level formulas (delimited by `$$...$$`) for display math.
- Emit provisional tokens suitable for the parser to reconstruct a formula block node: opener, content payload, and closer.
- Provide an exhaustive set of annotated-markdown tests that serve as documentation and as the authoritative spec for scanner behavior.

## Background

Formula blocks are a standard Markdown extension used for mathematical expressions, commonly rendered using LaTeX/KaTeX/MathJax. The most widely adopted convention is:
- `$$...$$` on separate lines for display math (block-level formulas)
- `$...$` for inline math (handled separately, not in this document)

This implementation focuses on block-level formula blocks (`$$`).

## Constraints & Project Rules

- The project uses plain JavaScript with JSDoc — no TypeScript. Follow existing code style (no trailing commas, use T[] style for arrays in JSDoc).
- There is no build step. Tests are run with `npm test`.
- All additions must fit the testing harness and the annotated-markdown philosophy in `parse/docs/1-annotated-markdown.md`.
- Don't create temporary helper scripts or non-committed debug files.

## Token Model (Provisional Tokens)

Use the existing pattern for provisional tokens (bit-packed integer where low bits hold length). Provisional tokens to add:
- **FormulaBlockOpen**: encodes the fence character (dollar sign), fence-length (number in lower bits, minimum 2).
- **FormulaBlockContent**: represents the raw content span length (no slices until parser requests content).
- **FormulaBlockClose**: encodes fence character and length for the closing run.
- Use existing **ErrorUnbalancedToken** flag for cases where opener exists but no balanced closer is found.

## Scanner Algorithm (Streaming, Allocation-Sparing)

### 1. Detection

At each position where `input.charCodeAt(pos)` is `36` (dollar sign `$`), attempt a formula block parse only when at a line-start context that permits a block opener.

Similar to fenced code blocks:
- Scanner must be at the start of a line (or after up to 3 leading spaces).
- The `scan0` function ensures it only dispatches to formula block detection at syntactic line-start boundaries.

Block-formula check: if the previous tokens are none, or there is only one previous token and it is whitespace of size 3 characters or less, then treat this dollar sign run as a possible block formula opener.

### 2. Opening Run

- Count consecutive dollar sign characters starting at `openerStart` to obtain `openN`.
- Require `openN >= 2` to be a valid block formula opener. If less, do not treat as formula block (single `$` may be inline math or literal text).

### 3. Content Scan

- Starting at the first character after the opening run (same line or next line), scan forward for a closing run.
- A valid closer is a run of dollar signs with length >= `openN`, appearing at the start of a line (allow up to 3 leading spaces).
- The closer's run may be longer than opener; we require length >= opener (same as fenced code blocks).
- While scanning, treat all text as content (including lines beginning with dollar signs) unless they match a valid closer.
- Support both LF and CRLF line endings.

### 4. Balanced vs Unbalanced

- If a closer is found: emit FormulaBlockOpen, FormulaBlockContent (length up to start of closer), and FormulaBlockClose (encoding closing length).
- If no closer is found before EOF: emit FormulaBlockOpen | ErrorUnbalancedToken and FormulaBlockContent | ErrorUnbalancedToken.

## Edge Cases and Policy Decisions

- **Single dollar sign**: `$` alone is NOT a formula block opener (requires minimum 2). Single dollar signs may be handled as inline math or literal text in a separate implementation.
- **Dollar signs inside formula block**: Interior runs that equal or exceed `openN` but are not at line-start (or have more than 3 leading spaces) are content, not closers.
- **Close with longer run**: Spec permits closer length >= opener. We treat any longer closing run as valid.
- **Tabs and indentation**: Treat tabs as single characters; the indentation rule (<=3 spaces) applies only to spaces.
- **CRLF vs LF**: Accept both. Use character indices in the original input string.
- **Nested formulas**: Inside a formula block, interior runs of dollar signs are allowed and do not close unless they appear on a line-start with allowed indentation and meet run-length requirement.
- **Formula blocks inside list items**: Allow up to 3 leading spaces before opener; do not attempt to interpret further list structure at this scanner layer.

## Annotated-Markdown Tests (Required First)

Add test cases under `parse/tests/` that cover:

### Happy Path
- Double dollar signs opener, single-line content, double dollar signs closer.
- Triple dollar signs opener and closer.
- Opener length 2, closer length 3 (longer closer is valid).
- Multi-line formula content.

### Edge Cases
- Opener with only 1 dollar sign — should NOT parse as formula block.
- Unclosed formula block until EOF — should emit unbalanced tokens.
- Formula blocks with leading up to 3 spaces.
- Content that contains runs of dollar signs shorter than opener and longer than opener but not at line start — should remain content.
- Windows CRLF line endings within content and around formula blocks.
- A closer with same char but less than open length (e.g., opener 3, closer 2) — not a closer.

## Test Format and Wiring

- Create annotated markdown file `parse/tests/12-formula-blocks.md` with both input and expected provisional token annotations.
- Follow the pattern used in `parse/tests/5-fences.md` and other test files.
- Each annotated test must include the exact offsets or token sequence expected.

## Integration Steps (Practical Order)

1. Draft annotated-markdown tests and add them to `parse/tests/`.
2. Implement `parse/scan-formula-block.js` exporting a `scanFormulaBlock(input, start, end, output)` function that mirrors patterns in `scan-fences.js`.
3. Wire `scan0.js` to call the new scanner when encountering a dollar sign at a potential opener position.
4. Update provisional token constants in `parse/scan-tokens.js`.
5. Run `npm test`, iterate on failures, and refine tests or implementation.

## Quality Gates and Smoke Checks

- Tests: `npm test` must run all existing tests including new annotated tests. Aim to have all pass.
- Smoke: Run a few targeted test files and inspect provisional tokens emitted for representative cases.

## Deliverables

- `parse/docs/13-formula-blocks.md` (this file) with the plan.
- Annotated-markdown tests added under `parse/tests/12-formula-blocks.md`.
- A new scanner module `parse/scan-formula-block.js` implementing the algorithm.
- `scan0.js` updated to delegate to the new scanner.
- `scan-tokens.js` updated with new token types.

## Example Annotated Test Snippet

```
Input:
$$
E = mc^2
$$

Annotated expectations (scanner tokens):
- FormulaBlockOpen (char=dollar, length=2)
- FormulaBlockContent (length depends on content)
- FormulaBlockClose (char=dollar, length=2)
```

## Similarity to Fenced Code Blocks

The formula block implementation closely follows the fenced code block pattern:
- Both use delimiter runs (backticks/tildes vs dollar signs)
- Both require minimum run length (3 for fences, 2 for formulas)
- Both allow longer closing runs
- Both handle balanced/unbalanced cases
- Both respect line-start context and leading indentation

The primary differences:
- Formula blocks use `$` (char code 36) instead of `` ` `` (96) or `~` (126)
- Formula blocks require minimum 2 delimiters instead of 3
- Formula blocks don't have "info strings" like language specifiers (though some implementations allow labels)

End of plan.
