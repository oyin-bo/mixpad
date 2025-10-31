# GFM Tables Scanning

GFM (GitHub Flavored Markdown) tables provide a way to create tables using pipe characters (`|`) and dashes.

## Table Structure

A valid GFM table consists of:

1. **Header row**: Pipe-separated cells containing header text
2. **Delimiter row**: Pipe-separated cells containing dashes (minimum 3 per cell) and optional colons for alignment
3. **Data rows**: Zero or more rows of pipe-separated cells

## Syntax Rules

### Basic Table Format

```
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

### Pipe Placement

- Outer pipes (at start and end of rows) are **optional**
- Inner pipes separate cells and are **required**
- At least one pipe must be present on each row

### Delimiter Row Requirements

The delimiter row must:
- Appear immediately after the header row
- Contain at least 3 dashes (`---`) per cell
- May contain colons for alignment:
  - `:---` = left-aligned (default)
  - `:---:` = center-aligned
  - `---:` = right-aligned
- May contain spaces around dashes and colons
- Must have the same structure (pipes) as other rows

### Escaping

- Backslash (`\`) can escape pipe characters: `\|`
- Escaped pipes do not count as cell separators

### Inline Content

Table cells can contain inline markdown elements:
- Emphasis (`*italic*`, `**bold**`)
- Code (`` `code` ``)
- Links (`[text](url)`)
- Entities (`&amp;`)

Block-level elements (headings, lists, code blocks) are not supported inside table cells.

## Table Recognition

A table is recognized when:
1. A line contains at least one unescaped pipe character
2. The next non-blank line is a valid delimiter row
3. The table is preceded by a blank line or start of file (block boundary)
4. The table ends at a blank line or end of file

## Token Types

The scanner emits the following token types for tables:

- `TablePipe`: The `|` character separating cells
- `TableDelimiterDash`: Dash characters in delimiter row (`-`)
- `TableDelimiterColon`: Colon characters for alignment (`:`)
- `TableCellContent`: Content within a cell (may contain inline elements)

## Examples

### Minimal Table

```
a|b
-|-
c|d
```

### Table Without Outer Pipes

```
Header 1 | Header 2
-------- | --------
Cell 1   | Cell 2
```

### Table With Alignment

```
| Left | Center | Right |
|:-----|:------:|------:|
| L    | C      | R     |
```

### Empty Cells

```
| A |   | C |
|---|---|---|
| 1 | 2 |   |
|   |   | 3 |
```

## Implementation Notes

The table scanner operates at the block level:
1. When a line with pipes is encountered at block start, scan ahead to check for delimiter row
2. If delimiter row is valid, mark the line as table start
3. Continue scanning rows until a blank line or incompatible content is found
4. Emit tokens for each structural element (pipes, delimiters, cell content)

The scanner integrates with existing inline scanning to handle content within cells.
