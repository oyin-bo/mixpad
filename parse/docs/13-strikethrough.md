# GFM Strikethrough

This document describes the implementation of GitHub Flavored Markdown (GFM) strikethrough extension in MixPad.

## Overview

GFM strikethrough uses double tilde delimiters (`~~`) to mark deleted or struck-through text. The extension is part of GitHub Flavored Markdown and is not included in base CommonMark.

## Specification

According to the [GFM specification](https://github.github.com/gfm/#strikethrough-extension):

- Strikethrough text is delimited by double tildes (`~~`)
- Both opening and closing delimiters must use exactly two tildes
- Single tildes (`~`) are treated as plain text
- Strikethrough follows similar flanking delimiter rules as emphasis

## Implementation

### Scanner (`scan-emphasis.js`)

The strikethrough scanner is implemented as part of the emphasis delimiter scanner (`scanEmphasis`). Key behaviors:

1. **Tilde Run Detection**: Scans consecutive tilde characters (`~`)
2. **Length Requirement**: Only tilde runs of length 2 or more are considered as potential delimiters
3. **Flanking Rules**: Applies similar demotion rules as asterisk and underscore delimiters

```javascript
// For tildes, runs less than 2 are plain text
if (firstChar === 126 /* ~ */ && runLength < 2) {
  return 0;
}
```

### Token Type

Strikethrough delimiters are represented by the `TildeDelimiter` token kind (defined in `scan-tokens.js`).

## Interaction with Other Features

### Fenced Code Blocks

An important constraint: **three or more consecutive tildes (`~~~`) at the start of a line trigger fenced code block parsing**, which takes precedence over strikethrough.

This means:
- `~~text~~` → strikethrough delimiters
- `~~~text~~` → fenced code block (when at line start)
- `~~~~` → fenced code block (when at line start)

This behavior is by design and follows the GFM specification where fenced code blocks have higher precedence.

### Combining with Other Formatting

Strikethrough can be combined with other inline formatting:

- `~~**bold**~~` → nested bold within strikethrough
- `~~*italic*~~` → nested italic within strikethrough
- `**~~struck~~**` → nested strikethrough within bold

The scanner emits provisional delimiter tokens for all delimiters, and semantic resolution (not yet implemented) will determine proper nesting and pairing.

## Edge Cases

### Single Tildes

Single tilde characters are not valid strikethrough delimiters and are treated as plain text:
- `~text~` → treated as plain text `~text~`

### Whitespace Flanking

Following the general emphasis demotion rules, tilde runs flanked by whitespace on both sides are demoted to plain text:
- `~~ spaced ~~` → treated as plain text

### Unclosed Delimiters

Unclosed strikethrough delimiters remain as delimiter tokens for potential semantic resolution:
- `~~open` → emits `TildeDelimiter` and `InlineText`
- `close~~` → emits `InlineText` and `TildeDelimiter`

### Empty Strikethrough

Empty strikethrough (adjacent delimiters) is valid and emits two delimiter tokens:
- `~~~~` → emits two `TildeDelimiter` tokens (unless at line start, where it becomes a fence)

## Testing

Comprehensive tests for strikethrough are in `parse/tests/13-strikethrough.md`, covering:

- Basic strikethrough usage
- Single tilde handling
- Flanking rules
- Combination with other formatting
- Edge cases (empty, unclosed, adjacent to punctuation)
- Whitespace handling
- Interaction with other inline elements

## Limitations

1. **Semantic Resolution Not Implemented**: The current implementation only performs provisional scanning. Final pairing and nesting resolution requires the semantic layer (see `semantic.js`).

2. **Fence Precedence**: Three or more tildes at line start are interpreted as fence markers, not strikethrough. This is correct per GFM spec but means some edge cases with multiple tildes cannot be tested as pure strikethrough.

## References

- [GFM Specification - Strikethrough Extension](https://github.github.com/gfm/#strikethrough-extension)
- [CommonMark Flanking Delimiter Runs](https://spec.commonmark.org/0.30/#left-flanking-delimiter-run)
- [Line Emphasis Documentation](6-line-emphasis.md) - general emphasis delimiter handling
