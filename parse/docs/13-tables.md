# GFM Table Scanning in MixPad (scan0)

**Note:** Table structure resolution (identifying valid tables, pairing header/delimiter rows, parsing cells) is the semantic layer's responsibility. This document covers only the lexical scanning of table-related tokens in `scan0`.

## Overview

`scan0`'s responsibility for tables is purely lexical: detect and tokenize pipe characters (`|`) that may be part of a table. That's it. Nothing more.

The semantic layer handles all structural decisions (which lines form a table, cell boundaries, column alignment, handling mismatched columns, etc.).

## GFM Table Structure

GitHub Flavored Markdown (GFM) tables consist of:

1. **Header row:** Pipe-separated cells containing header text
2. **Delimiter row:** Pipe-separated cells with dashes and optional colons for alignment
3. **Data rows (zero or more):** Pipe-separated cells containing data

Example:
```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

## Table Token Types

```javascript
// From scan-tokens.js
const TablePipe           = 0x2E0000; // | character
const TableDelimiterCell  = 0x2F0000; // Delimiter cell with alignment info
```

## Table Pipe Token

**Pattern to recognize:**
- Single pipe character `|` (ASCII 124)

**What `scan0` does:**
1. Sees `|` character
2. Emits a `TablePipe` token of length 1
3. Returns 1 (consumed length)

**What `scan0` does NOT do:**
- Determine if the pipe is part of a valid table
- Parse table cells or their content
- Track table structure or column count
- Validate table syntax

**Implementation (`scan-table.js`):**
```javascript
/**
 * Scan table pipe character |
 * @param {string} input - The input text
 * @param {number} start - Start index (position of |)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not a table pipe
 */
export function scanTablePipe(input, start, end, output) {
  if (start >= end) return 0;
  
  const char = input.charCodeAt(start);
  
  // Must be a pipe character
  if (char !== 124) return 0; // 124 = '|'
  
  output.push(1 | TablePipe);
  
  return 1;
}
```

**Token Structure:**
- Bits 0-15: Length (always 1 for pipe)
- Bits 16-25: Token type (TablePipe = 0x2E)
- Bits 26-31: Unused

## Table Delimiter Cell Token

**Pattern to recognize:**
- Optional leading whitespace
- Optional leading colon `:`
- **At least three dashes `-`** (GFM spec requirement)
- Optional trailing colon `:`
- Optional trailing whitespace

Valid delimiter patterns:
```
---       (minimum - default/left alignment)
:---      (explicit left alignment)
:---:     (center alignment)
---:      (right alignment)
 :---:    (center with whitespace)
-----     (more than 3 dashes allowed)
```

Invalid delimiter patterns:
```
-         (too few dashes)
--        (too few dashes)
```

**What `scan0` does:**
1. Parse optional leading whitespace
2. Check for optional leading colon
3. Count dashes (must have at least 3 per GFM spec)
4. Check for optional trailing colon
5. Parse optional trailing whitespace
6. Encode alignment information in token
7. Emit `TableDelimiterCell` token
8. Return consumed length

**What `scan0` does NOT do:**
- Validate that the cell is part of a delimiter row
- Check if it follows a header row
- Verify column count consistency
- Parse cell boundaries (that's determined by pipes)

**Implementation (`scan-table.js`):**
```javascript
/**
 * Scan table delimiter cell
 * @param {string} input - The input text
 * @param {number} start - Start index
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed
 */
export function scanTableDelimiterCell(input, start, end, output) {
  let pos = start;
  
  // Skip leading whitespace
  while (pos < end && (input.charCodeAt(pos) === 32 || input.charCodeAt(pos) === 9)) {
    pos++;
  }
  
  // Check for leading colon
  let hasLeadingColon = false;
  if (pos < end && input.charCodeAt(pos) === 58) { // ':'
    hasLeadingColon = true;
    pos++;
  }
  
  // Must have at least one dash
  let dashCount = 0;
  while (pos < end && input.charCodeAt(pos) === 45) { // '-'
    dashCount++;
    pos++;
  }
  
  if (dashCount === 0) return 0;
  
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
  let alignment = 3; // default
  if (hasLeadingColon && hasTrailingColon) {
    alignment = 1; // center
  } else if (hasLeadingColon) {
    alignment = 0; // left
  } else if (hasTrailingColon) {
    alignment = 2; // right
  }
  
  const length = pos - start;
  const alignmentBits = alignment << 26;
  
  output.push(length | TableDelimiterCell | alignmentBits);
  
  return length;
}
```

**Token Structure:**
- Bits 0-15: Length (total characters consumed)
- Bits 16-25: Token type (TableDelimiterCell = 0x2F)
- Bits 26-27: Alignment encoding:
  - `0` = left align (`:---`)
  - `1` = center align (`:---:`)
  - `2` = right align (`---:`)
  - `3` = default align (`---`)
- Bits 28-31: Unused

## Integration with scan0

The table scanner is integrated into the main `scan0` switch statement:

```javascript
case 124 /* | pipe */: {
  const pipeConsumed = scanTablePipe(input, offset - 1, endOffset, output);
  if (pipeConsumed > 0) {
    // Apply reparse flag if needed
    if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
      output[tokenStartIndex] |= IsSafeReparsePoint;
    }
    tokenCount = output.length;
    offset += pipeConsumed - 1;
    continue;
  }
  
  // Fall back to inline text if not recognized
  const consumed = scanInlineText(input, offset - 1, endOffset, output);
  // ... handle inline text
}
```

## GFM Specification Requirements

The implementation enforces the following GFM spec requirements:

### Minimum Dash Count
**Requirement:** Each delimiter cell must contain **at least 3 dashes**.

**Why:** The GFM spec explicitly states this requirement to avoid ambiguity with other constructs.

**Implementation:**
- `scanTableDelimiterCell`: Returns 0 if `dashCount < 3`
- `checkTableDelimiterRow`: Returns `{ isValid: false }` if any cell has fewer than 3 dashes

**Example:**
```markdown
| - |        ❌ Invalid (only 1 dash)
| -- |       ❌ Invalid (only 2 dashes)
| --- |      ✅ Valid (3 dashes - minimum)
| ----- |    ✅ Valid (5 dashes)
```

### Pipe Requirement
**Requirement:** A table delimiter row must contain **at least one pipe character** to distinguish it from Setext heading underlines.

**Why:** Without this requirement, a line like `---` could be ambiguous - it could be either a Setext heading underline or a table delimiter.

**Implementation:**
- `checkTableDelimiterRow`: Tracks `hasPipes` flag and returns `{ isValid: false }` if no pipes found

**Example:**
```markdown
---            ❌ Not a table (could be Setext heading)
--- | ---      ✅ Valid table delimiter (has pipe)
```

### Indentation Limit
**Requirement:** Tables can be indented up to **3 spaces maximum**. Four or more spaces of indentation indicates a code block.

**Why:** This is a core Markdown/GFM convention - 4+ spaces means code, not formatted content.

**Implementation:**
- `checkTableDelimiterRow`: Checks `countIndentation()` and returns `{ isValid: false }` if indentation > 3

**Example:**
```markdown
   | --- |    ✅ Valid (3 spaces)
    | --- |   ❌ Code block (4 spaces)
```

## Semantic Layer Responsibilities

The semantic layer (not yet implemented) will be responsible for:

1. **Table Detection:**
   - Identify lines that form a valid table structure
   - Match header rows with delimiter rows
   - Validate that delimiter row follows header row

2. **Cell Parsing:**
   - Use `TablePipe` tokens to determine cell boundaries
   - Extract cell content between pipes
   - Handle leading/trailing pipes (optional)

3. **Structure Validation:**
   - Verify minimum table requirements (header + delimiter)
   - Check column count consistency (or handle mismatches)
   - Apply alignment from delimiter cells to columns

4. **Edge Cases:**
   - Handle tables without leading/trailing pipes
   - Process escaped pipes within cells
   - Handle inline formatting within cells
   - Deal with empty cells

## Examples

### Basic Table Tokenization

Input:
```markdown
| Header 1 | Header 2 |
```

Tokens emitted by `scan0`:
```
TablePipe "|"
InlineText " Header 1 "
TablePipe "|"
InlineText " Header 2 "
TablePipe "|"
NewLine "\n"
```

### Delimiter Row Tokenization

Input:
```markdown
|:---|---:|
```

Tokens emitted by `scan0`:
```
TablePipe "|"
InlineText ":---"
TablePipe "|"
InlineText "---:"
TablePipe "|"
NewLine "\n"
```

Note: The delimiter cell scanning (`scanTableDelimiterCell`) is provided for future semantic layer use but is not currently invoked by `scan0`. The semantic layer will re-parse the content between pipes to extract alignment information.

### Without Pipes

Input:
```markdown
a|b
```

Tokens emitted by `scan0`:
```
InlineText "a"
TablePipe "|"
InlineText "b"
NewLine "\n"
```

The semantic layer determines whether this forms a valid table based on surrounding context (presence of delimiter row, etc.).

## Testing

Table scanning is tested using annotated Markdown format in `parse/tests/12-tables.md`:

```markdown
Single pipe:
|
1
@1 TablePipe "|"

Pipe in text:
a|b
12
@1 InlineText "a"
@2 TablePipe "|"
```

See `parse/tests/12-tables.md` for comprehensive test coverage.

## GFM Specification Reference

GFM tables follow the GitHub Flavored Markdown specification:
- Tables require a header row followed by a delimiter row
- Delimiter cells must contain at least one dash
- Alignment is indicated by colons in delimiter cells
- Leading and trailing pipes are optional
- Cells are separated by unescaped pipe characters

References:
- [GFM Spec: Tables](https://github.github.com/gfm/#tables-extension-)
- [GFM Spec: Table Structure](https://github.github.com/gfm/#table-structure)
