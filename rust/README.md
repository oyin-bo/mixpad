# MixPad (Rust)

A Rust port of [MixPad](../README.md) — a blazingly fast, editor-grade,
low-allocation Markdown parser with **first-class HTML**.

This port preserves MixPad's core bet and architecture: keep the hot path free of
per-token heap allocation by working over packed integer tokens and arena-style
buffers, then resolve structure in a cheap second pass.

## Architecture

Three phases, mirroring the JavaScript implementation:

1. **`scan0`** ([src/scan0.rs](src/scan0.rs)) — a single forward walk over the
   input bytes emitting packed `u32` provisional tokens. Only cheap, local
   decisions are made here; no pairing, no string slicing.
2. **`semantic`** ([src/semantic.rs](src/semantic.rs)) — resolves the provisional
   stream chunk by chunk: flanking-aware emphasis/strong/strikethrough pairing
   (with the CommonMark mod-3 rule), link/image validation, and text coalescing.
   All work happens over compact integer records reused across chunks.
3. **AST build** ([src/ast.rs](src/ast.rs)) — streams the resolved tokens into an
   arena-backed node tree (`Vec<Node>` with `usize` child links). Source text is
   never copied into nodes; `Document::text` slices the original string lazily.

### Token model

Each token is a packed `u32`:

```text
bits  0..=15  length (bytes)
bits 16..=25  kind
bits 26..=28  heading depth
bits 29..=30  flags (safe-reparse-point, error-unbalanced)
```

Lengths count **bytes** (the JS original counts UTF-16 units). This is
self-consistent because tokens only ever split at ASCII boundaries, so every span
lands on a UTF-8 `char` boundary and slicing is always valid.

## Compliance intuition

Guided by CommonMark, but favouring natural expectations over its more surprising
corners, and treating HTML as native recursive syntax rather than opaque text:

- `<div class="box">…</div>` becomes an `HtmlElement` node with parsed
  attributes and child content — not an escaped string.
- HTML comments, CDATA, DOCTYPE, XML processing instructions, and raw-text
  elements (`script`, `style`, `textarea`) are recognised structurally.
- Links and images expose clean `text` and `url`; inline code exposes its content
  without the backtick fence; fenced blocks expose their info string as
  `language`.

## Usage

Library:

```rust
use mixpad::{parse, NodeType};

let doc = parse("# Hello\n\nWorld with *emphasis* and `code`.");
let heading = doc.nodes[doc.root].children[0];
assert_eq!(doc.nodes[heading].kind, NodeType::Heading);
assert_eq!(doc.text(heading), "Hello");
```

CLI (prints the AST):

```sh
cargo run -- path/to/file.md
# or
echo "# Hi" | cargo run
```

## Build & test

```sh
cargo build --release
cargo test
```

## Feature coverage

Implemented: paragraphs, ATX headings, setext headings, thematic breaks,
blockquotes, bullet/ordered/task lists, fenced code (with language), emphasis /
strong / strikethrough, inline code, links, images, angle / raw-URL / www
autolinks, entities, backslash escapes, the full HTML/XML family (tags with
attributes, comments, CDATA, DOCTYPE, processing instructions, raw-text
elements), GFM tables (with per-column alignment), YAML/TOML/JSON front matter,
and `$$` display-math formula blocks.

The module layout mirrors the JS project, so behaviour tracks the reference
implementation closely across the whole surface.
