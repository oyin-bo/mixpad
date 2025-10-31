# GFM Strikethrough

Strikethrough is a GitHub Flavored Markdown (GFM) extension that allows text to be marked with a line through it using double tildes (`~~`). This document describes MixPad's implementation of GFM strikethrough according to section 6.5 of the GFM specification.

## Token: TildeDelimiter

The scanner emits **TildeDelimiter** tokens for runs of two or more consecutive tilde characters (`~`). Single tildes are treated as plain text.

### Scanning Rules

1. **Minimum Length**: Only runs of 2 or more tildes create delimiter tokens. Single tildes (`~`) are treated as `InlineText`.

2. **Run Detection**: The scanner identifies consecutive tilde characters as a single delimiter run. For example:
   - `~~` → one TildeDelimiter of length 2
   - `~~~` → one TildeDelimiter of length 3
   - `~~~~` → one TildeDelimiter of length 4

3. **Pragmatic Demotions**: Similar to other emphasis delimiters, tilde runs are demoted to plain text when:
   - The run is flanked by whitespace on both sides (space-flanked runs cannot act as delimiters)

4. **No Intraword Restrictions**: Unlike underscores, tildes do not have special intraword handling. This is because strikethrough in GFM is only triggered by double tildes, which rarely occur naturally within words.

## GFM Strikethrough Specification

According to the GFM specification (section 6.5):

- **Syntax**: Text is struck through by wrapping it with double tildes: `~~text~~`
- **Minimum Marker Length**: Only pairs of tildes (`~~`) create strikethrough. Single tildes do not.
- **Delimiter Pairing**: The opening and closing `~~` must both be exactly 2 characters.
- **Flanking**: Like emphasis, strikethrough delimiters follow flanking rules (handled in semantic phase).

### Examples from GFM Spec

```markdown
~~Hi~~ Hello, world!
```
Renders as: <del>Hi</del> Hello, world!

```markdown
This ~~has a
new paragraph~~.
```
Renders with strikethrough across the line break.

## Implementation in MixPad

MixPad's strikethrough implementation follows the two-phase architecture:

### Phase 1: Scanning (scan0)

The `scanEmphasis` function in `scan-emphasis.js` handles tilde delimiters:

1. Detects runs of `~` characters
2. Emits TildeDelimiter tokens only for runs of length ≥ 2
3. Applies character-level demotions (whitespace-flanked runs)

### Phase 2: Semantic Resolution

The semantic resolver (future implementation) will:

1. Apply full flanking rules
2. Pair opening and closing `~~` delimiters
3. Verify both delimiters are exactly length 2
4. Handle nesting with other inline elements (bold, italic, code)
5. Demote unpaired delimiters back to plain text

## Edge Cases

### Single Tilde
Single tildes are always plain text:
```markdown
~text~ → plain text "~text~"
```

### Whitespace Flanking
Tildes flanked by whitespace on both sides are plain text:
```markdown
text ~ ~ text → plain text
```

### Nested Formatting
Strikethrough can contain other formatting:
```markdown
~~**bold struck**~~ → strikethrough containing bold
```

### Multiple Tildes
Runs of more than 2 tildes should still create strikethrough when paired:
```markdown
~~~text~~~ → may create strikethrough (semantic phase resolves)
```

## Related Files

- **Scanner**: `parse/scan-emphasis.js` - Handles tilde delimiter scanning
- **Tokens**: `parse/scan-tokens.js` - Defines TildeDelimiter token
- **Integration**: `parse/scan0.js` - Calls scanEmphasis for tilde characters
- **Tests**: `parse/tests/6-emphasis.md` - Basic emphasis tests including tildes
- **Tests**: `parse/tests/13-strikethrough.md` - Comprehensive strikethrough tests

## Testing Philosophy

Tests for strikethrough follow MixPad's annotated markdown approach, where test cases are written in markdown files with position markers and expected token assertions. See `parse/tests/13-strikethrough.md` for comprehensive test coverage of all GFM strikethrough scenarios.
