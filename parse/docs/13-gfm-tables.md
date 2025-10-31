# GFM Tables

GitHub Flavored Markdown (GFM) tables provide a way to create structured tabular data using plain text formatting with pipes (`|`) and dashes (`-`).

## Table Structure

A GFM table consists of three parts:
1. **Header row**: Column headers separated by pipes
2. **Delimiter row**: Column separators using dashes and pipes, with optional alignment indicators
3. **Data rows**: Data cells separated by pipes

## Syntax Rules

### Basic Table
```
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

### Delimiter Row Requirements
- Must appear immediately after the header row
- Contains at least one dash (`-`) per column
- Columns are separated by pipes (`|`)
- **At least one pipe (`|`) is required** to distinguish from Setext headings
- Leading and trailing pipes are optional, but at least one pipe must be present somewhere
- Whitespace around pipes and dashes is allowed

### Alignment Indicators
The delimiter row can specify column alignment:
- `:---` or `---` = left-aligned (default)
- `:---:` = center-aligned
- `---:` = right-aligned

Examples:
```
| Left | Center | Right |
| :--- | :----: | ----: |
| A    | B      | C     |
```

### Edge Cases and Flexibility
- Leading and trailing pipes are optional, but at least one pipe must be present
- Example with inner pipes only: `--- | ---`
- Cells can contain inline formatting (emphasis, code, links, etc.)
- Empty cells are allowed: `| A | | C |`
- Pipes inside cells must be escaped: `\|`
- Tables can be indented up to 3 spaces
- Rows with different numbers of cells are allowed (missing cells are empty)

## Scanner Implementation

### Token Types
The scanner emits the following tokens for tables:
- `TableDelimiterRow`: The delimiter row itself (e.g., `| --- | --- |`)
- Inline tokens (InlineText, EntityNamed, etc.) for cell content

### Scanning Strategy

The table scanner is invoked when a pipe (`|`) is detected at the start of a line or after minimal indentation. The scanner:

1. **Checks if current line could be a delimiter row**:
   - Scans for pattern of pipes, dashes, colons, and whitespace
   - Validates at least one dash per column
   - Records alignment indicators

2. **If valid delimiter row found**:
   - Emits `TableDelimiterRow` token with alignment metadata
   - Subsequent rows are treated as table rows until a blank line or incompatible construct

3. **Token encoding** (31 bits):
   - Bits 0-15: Length of delimiter row
   - Bits 16-25: Token type (`TableDelimiterRow`)
   - Bits 26-31: Column count and metadata

### Non-Table Cases
Not every pipe creates a table:
- Single line with pipes but no valid delimiter = not a table
- Pipe inside code block or HTML = not a table
- Indented 4+ spaces = code block, not a table

## Integration with scan0

The table scanner is invoked when:
1. Scanner encounters `|` at line start (or after ≤3 spaces indentation)
2. Current line is not inside a code block, HTML tag, or other construct
3. Look-ahead to check if this could be a header row with delimiter following

## Examples

### Simple table
```
| Name  | Age |
| ----- | --- |
| Alice | 30  |
| Bob   | 25  |
```

### Table with alignment
```
| Left | Center | Right |
| :--- | :----: | ----: |
| A    | B      | C     |
```

### Table without outer pipes
```
Name  | Age
----- | ---
Alice | 30
Bob   | 25
```

Note: At least one pipe character must be present in the delimiter row to distinguish it from a Setext heading underline.

### Table with inline formatting
```
| **Name** | `Code` |
| -------- | ------ |
| *Alice*  | `foo`  |
```

## Implementation Notes

- The scanner is allocation-free and stateless
- Table parsing happens in two phases:
  1. scan0 identifies delimiter rows and emits provisional tokens
  2. Semantic phase pairs headers with delimiters and builds table structure
- Cell content is scanned using existing inline scanners
- Table rows are identified by presence of pipes and valid structure

## Testing

Tests cover:
- Basic tables with all components
- Tables with various alignment indicators
- Tables with and without outer pipes
- Tables with inline formatting
- Edge cases: empty cells, escaped pipes, varying column counts
- Non-table cases: single pipe, indented, inside code blocks
