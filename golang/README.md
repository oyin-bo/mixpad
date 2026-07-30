# MixPad — Go port

A Go implementation of [MixPad](../README.md)'s two-phase, low-allocation Markdown
parser. It mirrors the JavaScript reference architecture (`parse/`) while using
idioms that make the zero-allocation philosophy natural in Go.

## Why the architecture ports well

MixPad's design is effectively data-oriented systems programming written in JS:
packed integer tokens, index-based stacks, and lazy string materialisation. Those
same techniques are idiomatic — and faster — in Go:

| MixPad (JS) | Go port |
|---|---|
| 31-bit packed `number` tokens | `uint32` tokens, identical bit layout |
| `number[]` growing buffers reused across calls | reusable `[]uint32` / `[]int` slices on a state struct |
| Object AST nodes with `children` arrays | flat `[]Node` arena with `int32` child links |
| `substring` on demand via getters | zero-copy `string` slices (`src[start:end]`) |
| checkpoint/rollback via primitive indices | integer index state — same approach |

Byte-oriented scanning (Go strings are UTF-8) is both faithful and fast because
Markdown's structural grammar is ASCII; multi-byte runes fall through to
`InlineText` and are coalesced.

## Pipeline

```
Parse(src)
  └─ semanticScan(src)                 // Phase 1 + 2
        ├─ scan0(...)                  // provisional packed tokens (chunked)
        └─ processChunk(...)           // emphasis (mod-3) + link/image pairing, coalescing
  └─ buildAST(src, tokens)             // flat-arena tree
```

- `tokens.go` — packed token layout, kinds, flags (bit-identical to the JS build).
- `core.go` — ASCII character classification and line helpers.
- `scanners.go` — inline text, escapes, entities, emphasis, inline code, fences,
  ATX/Setext headings, thematic breaks, blockquotes, lists, links, table pipes.
- `html.go` — first-class HTML: tags, comments, CDATA, DOCTYPE, XML PIs, raw-text
  elements, and autolinks (angle / raw URL / `www.`).
- `scan0.go` — the Phase-1 dispatch loop.
- `semantic.go` — Phase-2 pairing and coalescing.
- `ast.go` / `inline.go` — the flat-arena builder.

## Compliance intuition

Guided by CommonMark but favouring natural expectations, and — per MixPad —
**HTML is native syntax**, not foreign text. Emphasis follows the flanking and
mod-3 rules; unmatched link/emphasis markers degrade to text.

## Usage

```go
import mixpad "mixpad"

doc := mixpad.Parse("# Hello\n\nSome *markdown* with <b>html</b>.")
root := doc.Root()
for _, child := range doc.Children(root) {
    n := doc.Node(child)
    fmt.Println(n.Kind, doc.Text(child))
}
```

## Test & benchmark

```
go test ./...
go test -bench=. -benchmem
```

## Coverage status

Full port of the JS reference (`parse/`): paragraphs, ATX + Setext headings,
thematic breaks, blockquotes (with nesting), bullet/ordered/task lists (with
nesting), fenced code (with info/language), front matter (YAML/TOML/JSON),
display-math formula blocks, GFM tables (with per-column alignment), emphasis /
strong / strikethrough, inline code, escapes, the full embedded WHATWG entity
map, links, images, autolinks (angle / raw URL / www.), and native HTML —
tags with attributes/namespaces/entities, element nesting, void elements,
comments, CDATA, DOCTYPE, XML PIs, and raw-text elements — all with MixPad's
heuristic error recovery.

Natural-expectation refinements over the reference: Setext underlines promote the
paragraph to a heading, `![](…)` produces a single Image node carrying the URL,
task markers flag the enclosing list item, fenced openers become the language
span (not body text), and bare `www.` links produce Autolink nodes.

### Scanner ⇄ file map

| Concern | Go file |
|---|---|
| Token model / flags | `tokens.go` |
| Char utils | `core.go` |
| Entity map (embedded) | `entities.go`, `scan-entity-map.json` |
| Inline / block scanners | `scanners.go` |
| HTML tag scanner | `html_tag.go` |
| HTML comment/CDATA/DOCTYPE/PI/raw-text | `html_blocks.go` |
| Autolinks | `autolink.go` |
| Front matter | `frontmatter.go` |
| Formula blocks | `formula.go` |
| Phase 1 dispatch | `scan0.go` |
| Phase 2 pairing/coalescing | `semantic.go` |
| AST types | `ast.go` |
| Builder helpers | `builder.go` |
| Streaming builder | `consume.go` |
