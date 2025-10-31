# GFM Table Scanning

This document describes the implementation of GitHub Flavored Markdown (GFM) table scanning in MixPad.

## Overview

GFM tables are a popular extension to CommonMark that allows creating tables using pipe characters (`|`) and hyphens (`-`). The MixPad parser implements table delimiter row scanning as part of the scan0 phase, emitting specialized tokens for table structure.

## Table Delimiter Row Syntax

A table delimiter row consists of:
- Optional leading pipe `|`
- One or more delimiter cells separated by pipes
- Optional trailing pipe `|`
- Each delimiter cell contains at least 3 hyphens with optional colons for alignment

### Alignment Markers

- `:---` - Left-aligned column
- `:---:` - Center-aligned column
- `---:` - Right-aligned column
- `---` - Default alignment (no colon)

### Examples

```markdown
| -------- | -------- |
```

```markdown
| :--- | :----: | ----: |
```

```markdown
-------- | --------
```

## Token Types

### TablePipe

Represents a pipe character (`|`) used as a column separator or table boundary.

- **Token Kind**: `0x2E0000`
- **Length**: Always 1
- **Flags**: None

### TableDelimiterCell

Represents a delimiter cell containing hyphens and optional alignment colons.

- **Token Kind**: `0x2F0000`
- **Length**: Variable (minimum 3 for `---`)
- **Flags**: Alignment information in bits 26-28
  - `AlignNone` (0): No alignment specified
  - `AlignLeft` (1): Left-aligned (`:---`)
  - `AlignCenter` (2): Center-aligned (`:---:`)
  - `AlignRight` (3): Right-aligned (`---:`)

### Whitespace

Standard whitespace tokens are emitted between table structure elements to maintain accurate position tracking.

## Scanner Implementation

The table scanner (`scan-table.js`) implements two main functions:

### checkTableDelimiterRow

Validates whether a line is a valid GFM table delimiter row without allocating memory.

**Validation Rules:**
1. Must contain at least one pipe character
2. Each cell must have at least 3 hyphens
3. Cannot be indented more than 3 spaces (would be a code block)
4. Must be at first non-whitespace position on the line

**Returns:**
- `isValid`: Boolean indicating if the line is a valid delimiter row
- `cells`: Array of cell information (start position, length, alignment)

### scanTableDelimiterRow

Scans a validated table delimiter row and emits tokens to the output array.

**Emission Pattern:**
1. Leading pipe (if present)
2. Whitespace after pipe
3. Delimiter cell
4. Whitespace after cell
5. Repeat from step 1 for each additional column
6. Trailing pipe (if present)

**Returns:**
- Number of characters consumed (including leading whitespace and delimiter row)

## Integration with scan0

The table scanner is invoked from scan0.js when a pipe character (`|`, char code 124) is encountered:

```javascript
case 124 /* | pipe */: {
  const tableConsumed = scanTableDelimiterRow(input, offset - 1, endOffset, output);
  if (tableConsumed > 0) {
    lineCouldBeSetextText = false;
    // ... handle token emission
    offset += tableConsumed - 1;
    continue;
  }
  // Fall back to inline text if not a table delimiter
}
```

## Limitations and Future Work

The current implementation scans **table delimiter rows only**. Full table support would require:

1. **Header row recognition**: Detecting that a line with pipes should be treated as a table header based on the next line being a delimiter row
2. **Data row scanning**: Parsing table rows that come after the delimiter row
3. **Cell content parsing**: Handling inline markdown within table cells
4. **Semantic phase processing**: Pairing header, delimiter, and data rows into a complete table structure

These features are intentionally deferred to maintain the separation between scan0 (provisional scanning) and semantic phases.

## Testing

Comprehensive tests for table delimiter rows are located in `parse/tests/12-tables.md`. The tests cover:

- Basic delimiter rows with and without outer pipes
- All alignment types (left, center, right, none)
- Minimum and maximum hyphen counts
- Single and multiple column tables
- Whitespace variations

All tests use the annotated markdown format, with position markers indicating exact token positions and assertions specifying expected token kinds, flags, and text.

## References

- [GFM Specification - Tables (Extension)](https://github.github.com/gfm/#tables-extension-)
- `parse/scan-table.js` - Scanner implementation
- `parse/tests/12-tables.md` - Comprehensive test suite
- `parse/scan-tokens.js` - Token type definitions
- `parse/scan-token-flags.js` - Alignment flag definitions
