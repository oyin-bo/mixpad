# GFM Tables

GitHub Flavored Markdown (GFM) extends CommonMark with table support. This document describes MixPad's scanning approach for GFM tables.

## Table Structure

A GFM table consists of:
1. A header row with column headers
2. A delimiter row with column alignments
3. Zero or more data rows

Each row is a line of text with cells separated by pipe `|` characters.

## Basic Examples

### Simple Table

```
| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Table Without Outer Pipes

Leading and trailing pipes are optional:

```
Header 1 | Header 2 | Header 3
-------- | -------- | --------
Cell 1   | Cell 2   | Cell 3
Cell 4   | Cell 5   | Cell 6
```

### Column Alignment

Colons in the delimiter row specify alignment:
- `:---` or `---` = left align (default)
- `:---:` = center align
- `---:` = right align

```
| Left    | Center    | Right   |
| :------ |:--------: | ------: |
| L1      | C1        | R1      |
```

## Scanning Rules

### Indentation

Tables can be indented up to 3 spaces from the line start. Four or more spaces of indentation creates a code block, not a table.

### Delimiter Row Requirements

The delimiter row must:
- Follow immediately after the header row
- Contain at least one cell
- Each cell must have at least 3 hyphens (`---`)
- Cells are separated by pipes `|`
- Optional leading/trailing colons specify alignment
- Spaces around hyphens and colons are allowed and trimmed

### Cell Content

- Cells may contain inline Markdown (emphasis, links, code, entities, etc.)
- Block-level elements are not allowed inside cells
- Escaped pipes `\|` are treated as literal pipe characters, not cell separators
- Extra or missing cells in data rows are handled gracefully:
  - Missing cells are treated as empty
  - Extra cells are ignored

### Table Termination

A table ends at:
- A blank line
- A block-level element (heading, list, code block, etc.)
- End of document

## Token Types

MixPad uses the following token types for table scanning:

### `TablePipe`
Represents a pipe `|` character that separates table cells.
- Length: Always 1 (the pipe character)
- Used in header rows, delimiter rows, and data rows

### `TableDelimiterCell`
Represents the content of a cell in the delimiter row (hyphens and colons).
- Length: Variable (cell content including spaces)
- Carries alignment information in bits 26-27:
  - `0` = left align (default)
  - `1` = center align (both colons)
  - `2` = right align (trailing colon only)

## Implementation Strategy

### Phase 1: Provisional Scanning (scan0)

The scanner emits provisional tokens for table elements:
1. Pipe characters as `TablePipe` tokens
2. Delimiter cell content as `TableDelimiterCell` tokens with alignment metadata
3. Regular inline content tokens (text, entities, emphasis, etc.) for cell content

### Phase 2: Semantic Analysis

The semantic layer:
1. Identifies table structures by detecting delimiter rows
2. Groups tokens into table rows and cells
3. Applies column alignments from delimiter row to data rows
4. Validates table structure (matching column counts, proper termination)

### Speculative Parsing

Unlike Setext headings, table recognition does not require extensive backtracking. The delimiter row provides a clear signal that the previous line was a header row. However, some lookahead is needed:
1. When a potential table row is encountered, buffer its tokens
2. Check if the next line is a valid delimiter row
3. If yes, emit the buffered header row tokens and the delimiter row tokens as table tokens
4. If no, emit the buffered tokens as regular inline content

## Edge Cases

### Not a Table

These constructs are NOT recognized as tables:
- Lines with pipes but no valid delimiter row
- Delimiter rows with cells containing fewer than 3 hyphens
- Tables starting with 4+ spaces indentation (treated as code blocks)

### Uneven Column Counts

GFM allows flexibility in column counts:
- Data rows with fewer cells than headers: missing cells are empty
- Data rows with more cells than headers: extra cells are ignored

### Inline Markdown in Cells

Cells can contain:
- Emphasis (`*italic*`, `**bold**`)
- Code (`` `code` ``)
- Links (`[text](url)`)
- Entities (`&amp;`)
- Escaped characters (`\|`)

But NOT:
- Paragraphs
- Lists
- Code blocks
- Headings

## Performance Considerations

Table scanning maintains MixPad's zero-allocation philosophy:
- Pipe and delimiter tokens use packed integers (no string allocations)
- Alignment metadata stored in token bits (no objects)
- Delimiter row validation uses index-based scanning (no string slicing)
- Cell content parsed using existing inline scanners (entities, emphasis, etc.)

The table scanner integrates seamlessly with the existing scan0 architecture, maintaining the two-phase provisional-then-semantic model that enables incremental parsing and editor-grade precision.
