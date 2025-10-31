# GFM Strikethrough Extension

This document describes the implementation of GitHub Flavored Markdown (GFM) strikethrough extension in MixPad's scanner layer, following the official GFM specification section 6.5.

## Overview

Strikethrough is a GFM extension that allows marking text for deletion or strikethrough rendering using double tildes (`~~`). The feature is implemented at the scanner level through the `scanEmphasis` function in `scan-emphasis.js`, which handles delimiter detection for asterisks, underscores, and tildes.

## GFM Specification Rules

According to the official GFM specification (section 6.5), strikethrough follows these rules:

### Basic Syntax

- Strikethrough uses **double tildes** (`~~`) as delimiters
- Single tildes (`~`) are NOT valid strikethrough delimiters and are treated as plain text
- Text between matched `~~` delimiters is rendered with strikethrough (HTML `<del>` tag)

Example:
```markdown
This is ~~deleted text~~.
```
Renders as: This is <del>deleted text</del>.

### Delimiter Requirements

1. **Minimum Run Length**: Strikethrough requires exactly 2 consecutive tildes
   - `~single~` → plain text (not strikethrough)
   - `~~double~~` → strikethrough
   - `~~~triple~~~` → treated as `~~` delimiter with extra `~` as content

2. **No Spaces Between Delimiters and Content**: 
   - Delimiters must be adjacent to the text
   - `~~ text~~` or `~~text ~~` with spaces inside may not be parsed correctly
   - The GFM spec follows standard emphasis flanking rules

3. **Matching Pairs**: Opening `~~` must be closed with `~~`
   - `~~strikethrough~` → not matched (only one closing tilde)

### Flanking Rules

Strikethrough delimiters follow the same left-flanking and right-flanking rules as emphasis:

- **Left-flanking**: Not followed by whitespace AND (not followed by punctuation OR preceded by whitespace/punctuation)
- **Right-flanking**: Not preceded by whitespace AND (not preceded by punctuation OR followed by whitespace/punctuation)

- `~~can open~~` → valid (left-flanking opener, right-flanking closer)
- `word~~` → right-flanking only (can close)
- Space-flanked runs like ` ~~ ` are demoted to plain text

### Interaction with Other Markup

Strikethrough can be combined with other formatting:

1. **Nesting with Emphasis**:
   - `~~**bold and struck**~~` → strikethrough containing bold
   - `**~~bold with strikethrough~~**` → bold containing strikethrough
   - `~~*italic and struck*~~` → strikethrough containing italic

2. **With Links**:
   - `[~~strikethrough link~~](url)` → strikethrough inside link text
   - `~~[link](url)~~` → link inside strikethrough

3. **Escaped Tildes**:
   - `\~~not strikethrough~~` → backslash escapes the first tilde
   - Results in plain text: `~~not strikethrough~~`

4. **Multiple Strikethroughs**:
   - `~~one~~ and ~~two~~` → both segments get strikethrough
   - Each `~~` pair is independent

## Important: Fence Blocks vs Inline Strikethrough

A critical distinction in GFM: tildes at the **start of a line** with 3+ characters are treated as **fence block openers**, NOT inline strikethrough delimiters.

```markdown
~~~code fence~~~    ← This is a fence block (unbalanced)
text ~~strike~~     ← This is inline strikethrough
```

The first line above starts with `~~~` at line position 0, so `scan0` delegates to `scanFencedBlock` before checking `scanEmphasis`. The fence scanner consumes it as a fence opener, looking for a closing fence on its own line.

For inline strikethrough to work with 3+ tildes, the tildes must NOT be at line start:
- `text ~~~strike~~~` would be inline (though unusual - typically use `~~`)
- ` ~~~not fence~~~` with leading space might be inline depending on indent rules

This is correct GFM behavior and matches the specification's precedence rules.

## Implementation in MixPad

### Scanner Layer (`scan-emphasis.js`)

The `scanEmphasis` function handles strikethrough detection:

1. **Detection**: Recognizes runs of tilde characters (`~`, char code 126)
2. **Run Length Check**: Only runs of 2+ tildes are considered delimiters
   - Single tildes return 0 (treated as plain text by caller)
3. **Demotion Rules**: Applies character-level demotions:
   - Space-flanked runs (whitespace before AND after) → plain text
   - Note: Underscore-specific intraword demotion does NOT apply to tildes
4. **Token Emission**: Emits `TildeDelimiter` provisional tokens with length

### Provisional Tokens

The scanner emits these provisional tokens for strikethrough:

- **TildeDelimiter**: Represents a run of 2+ tildes
  - Encodes the run length in lower bits
  - Token kind: `TildeDelimiter` (0x0F0000)
  - May include flags: `IsSafeReparsePoint`, `CanOpen`, `CanClose`

### Semantic Resolution (Future)

The semantic phase (not yet implemented for strikethrough) would:

1. Apply complete flanking rules to determine opener/closer capability
2. Pair matching `~~` delimiters
3. Handle nesting conflicts with other emphasis
4. Promote matched pairs to actual strikethrough nodes
5. Demote unmatched delimiters to plain text

## Edge Cases and Behavior

### Valid Strikethrough Examples

- `~~standard~~` → strikethrough
- `word~~can close` → `~~` is right-flanking (can close)
- `~~can open~~word` → both `~~` are valid delimiters
- `~~nested **bold**~~` → valid nesting (semantic phase handles nesting)
- `~~a~~ and ~~b~~` → multiple independent strikethroughs on same line

### Not Strikethrough (Plain Text)

- `~single tilde~` → single tildes are plain text (run length < 2)
- ` ~~ ` → space-flanked runs are demoted to plain text
- `~~~triple~~~` → at line start, treated as fence block opener (not inline strikethrough)
- `~~~~quad~~~~` → at line start, treated as fence block opener (not inline strikethrough)
- `~~unmatched` → no closing delimiter (remains as unmatched opener in scan phase)

### Character-Level vs Semantic Demotions

MixPad's two-phase approach means:

1. **Scanner (Phase 1)**: Performs only provably-unambiguous demotions
   - Single tildes → plain text (run length < 2)
   - Space-flanked runs → plain text
   
2. **Semantic (Phase 2)**: Defers complex decisions
   - Full flanking analysis
   - Delimiter pairing
   - Nesting resolution
   - Unmatched delimiter handling

This separation allows the scanner to stay fast and allocation-free while preserving enough information for accurate semantic analysis.

## Testing

Strikethrough is tested through annotated Markdown files in `parse/tests/6-emphasis.md`. The test format follows MixPad's annotated markdown philosophy:

```markdown
~~word~~
1 2   3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~" CanClose
```

See `parse/tests/6-emphasis.md` for comprehensive test cases covering:
- Basic strikethrough (`~~text~~`)
- Multiple strikethroughs on same line (`~~one~~ and ~~two~~`)
- Right-flanking only cases (`text~~`)
- Left-flanking cases (`~~text more`)
- Single tilde demotion (`~text~` → plain text)
- Space-flanked demotion (` ~~ ` → plain text)
- Unmatched delimiters (`~~no closing`)
- Edge cases with mixed tilde counts (`~~a~`, `~a~~`)
- Whitespace handling (`text ~~strike~~ more` with proper token separation)

### Running Tests

Run all tests:
```bash
npm test
```

Run only strikethrough-related tests:
```bash
node --test --test-name-pattern="~~" parse/tests/test-produce-annotated.js
```

Run a specific test:
```bash
node --test --test-name-pattern="~~word~~" parse/tests/test-produce-annotated.js
```

## References

- [GFM Specification Section 6.5: Strikethrough](https://github.github.com/gfm/#strikethrough-extension)
- CommonMark Emphasis Specification (for flanking rules)
- MixPad docs: `parse/docs/6-line-emphasis.md` (general emphasis/delimiter handling)
- MixPad docs: `parse/docs/1-annotated-markdown.md` (testing philosophy)
