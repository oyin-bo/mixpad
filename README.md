# MixPad

**MixPad** is a blazingly fast, editor-grade Markdown parser built on an impossible bet: text parsing could be allocation-free.

Zero allocations during the hot path (all the arrays, objects, slicing and dicing of strings). Every Markdown parser leans into it. MixPad works against the grain.

MixPad treats HTML as native, supports all major extensions (tables, front matter, math), and delivers editor-grade precision with incremental parsing perfect for live editing and massive documents.

## Annotated Markdown

MixPad's tests are written as annotated Markdown files that double as documentation and executable specs. Tests live in `parse/tests/*.md` and use position markers plus token lines to assert lexer behavior directly in human-readable files.

Consider that snippet from [HTML entities docs](parse/tests/2-entities.md):

```markdown

5) On-disk encoding and generator notes
- At start the code parses a compact textual map (one- or two-letter buckets). Parsing of the map is a preparation for runtime matching.

## Simple examples

A simple named entity: &amp;
1                      2
@1 InlineText
@2 EntityNamed
```

Markers on the text line (`1 2`) map to `@` assertions that specify token kinds and attributes. The test runner reads these Markdown files, runs the scanner against them, and any failures are mapped back into the same format, highlighting exact positions and variations for easy debugging.

It serves both as an explainer for the tokens generated, and as an automated verification.

## Architecture: Two-Phase Zero-Allocation

MixPad's architecture emerged from the zero-allocation constraint, creating six core principles:

### HTML-Native Parsing
Following TypeScript's JSX contextual tokenization, HTML becomes recursive syntax rather than foreign text. While micromark delegates HTML to external parsers and markdown-it renders it as literal strings, MixPad commits to native integration that cuts impedance mismatch.

### Two-Phase Processing
Complexity demanded separation:
- **Phase 1 - scan0**: Provisional scanning with minimal decisions. 31-bit integers store length and basic flags. No string allocations, no semantic resolution.
- **Phase 2 - Semantic**: Span-level analysis over provisional records. Delimiter pairing, text materialization, structural recognition.

Hot path complexity stays constant while semantic richness grows independently.

### Speculative Parsing
Markdown ambiguities need decisions based on future context. TypeScript's `lookAhead()` checkpoint-rollback patterns let you backtrack through primitive parser state snapshots without allocation—state restoration uses primitive indices rather than object copying.

### Growing Number Buffer
A buffer of 31-bit integers packs position, length, flags, and semantic hints—the bridge between lexical analysis and syntactic parsing. String comparisons become bitwise operations. Context queries drop from O(n) to O(1).

## Performance Excellence

The absurd constraint pushes architectural innovation. Every design decision serves the zero-allocation goal:

🚀 **Zero-Allocation Operation**: Keep automaton state as primitives, speculate without heap allocation, use packed token flags instead of string comparisons. Parse at the speed of memory reads.

⚡ **Industry-Leading Speed**: Match or exceed lower-level language parsers. Benchmarking shows scaling advantages on medium documents, clear superiority on large documents.

🎯 **Incremental Precision**: Scanner statelessness keeps incremental capabilities while permissive recovery handles malformed input. Sub-millisecond updates to massive documents.

📐 **Editor-Grade Features**: Exact source positions, comprehensive error recovery, seamless HTML/Markdown unification. Built for the next generation of editing tools.

Performance comes from refusing to create problems rather than solving them efficiently.

## Contributing

We welcome suggestions, bug reports, and architectural discussions. This parser represents a fundamental rethinking of Markdown parsing—your insights help push the boundaries of what's possible in text processing performance.