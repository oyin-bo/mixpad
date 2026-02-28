# Semantic Scanner Specification (Version 1.1)

This specification defines the Semantic Scanner, the intermediate layer that consumes the raw, provisional token stream from `scan0` and produces a refined stream of semantic tokens for the later AST Parser.

---

## 1. System Architecture

The Semantic Scanner operates as a **chunk-aware, zero-allocation token transformer**. It provides a "lookahead window" over `scan0` to resolve inline ambiguities that a purely character-by-character scanner cannot. 

Crucially, **the Semantic Scanner is completely stateless between paragraphs (chunks)**. It does not track block-level hierarchies (like nested lists or blockquote closures), nor does it evaluate AST structures. Structure rules belong strictly to the Parser layer.

### 1.1. Core Responsibilities
1. **Intra-Paragraph Buffering:** Call `scan0` to consume text until a paragraph/chunk boundary is reached.
2. **Emphasis Resolution:** Traverse the buffered chunk to correctly pair `*`, `_`, and `~` delimiters.
3. **Link & Image Pairing:** Match `[` brackets with `]` and resolve them alongside `(` destinations.
4. **Token Coalescing:** Merge adjacent literal text and "demoted" delimiters into contiguous `InlineText` tokens, keeping allocations to strictly zero.

---

## 2. Invalidation and Chunking

The Semantic Scanner processes the file in isolated **Chunks**. 

### What is a Chunk?
A **chunk** is simply a block of text (usually a single paragraph) that the scanner buffers all at once before trying to resolve inline formatting. The scanner stops buffering the chunk whenever it hits a natural boundary like a blank line or a code fence.

This buffering is necessary because the system cannot know if a `*` or `[` is a formatting marker or just a plain text character without seeing the rest of the paragraph to find a matching pair. Processing text one chunk at a time keeps live editing extremely fast: typing inside one paragraph only requires the engine to re-read that specific chunk rather than the entire document.

### 2.1. Chunk Boundary Triggers
The scanner buffers `scan0` tokens until a definitive boundary is hit. Boundaries occur on:
1.  **Blank Lines:** Two consecutive `NewLine` tokens.
2.  **Structural Interruptions:** A `FencedOpen` code block token or `ThematicBreak` token.
3.  **End of Input (EOF).**

### 2.2. Error Isolation
Because the scanner clears its state buffer on every boundary, an unclosed `*` or `[` delimiter inside one chunk will never "leak" into the next chunk. This ensures single-line edits only ever invalidate parsing for their immediate paragraph chunk, maintaining editor performance.

---

## 3. Inline Resolution Rules

Once a chunk is buffered, the Semantic Scanner makes multiple fast passes over the numeric token array to resolve relationships.

### 3.1. Emphasis & Strikethrough
-   **Algorithm:** Implements the stack-based pairing from `semantic.js` matching standard CommonMark rules (left/right flanking, mod-3 runs).
-   **Promotion:** Paired tokens are converted to `EmphasisOpen`/`EmphasisClose`, `StrongOpen`/`StrongClose`, or `StrikethroughOpen`/`StrikethroughClose`.
-   **Demotion:** Any dangling `AsteriskDelimiter`, `UnderscoreDelimiter`, or `TildeDelimiter` tokens that fail to pair are marked as "demoted" to be treated as literal text.

### 3.2. Link and Image Resolution
-   **Brackets:** Tracks the nesting of `[` and `]` across the chunk.
-   **Destinations:** If a `]` immediately adjoins an `AngleLinkOpen` or raw URL tokens, it pairs them into `LinkOpen` and `LinkDestOpen`. 
-   **Priorities:** If a link contains embedded links, the outermost link takes precedence, and inner brackets are demoted to plain text.
-   *(Note: Reference links `[id]: url` are not processed during this phase. Map collection is handled by the final AST Builder).*

---

## 4. Text Coalescing (Zero-Allocation)

To keep memory pressure to an absolute minimum, the Semantic Scanner **does not decode strings or allocate objects**. It merely modifies the integer stream of token types and boundaries.

After structural resolution completes for the chunk:
1.  **Iterate** through the provisional tokens.
2.  **Identify** adjacent `InlineText`, `Whitespace`, `EntityNamed`, `EntityDecimal`, `EntityHex`, and "demoted" delimiter tokens.
3.  **Coalesce** them by outputting a single, consolidated token boundary in the final scanner stream that combines their total length. 
4.  *(Note: Entity decoding into literal characters is explicitly deferred to tree-generation or rendering).*

---

## 5. Pass-Through and Opaque Types

The Semantic Scanner respects the complex work already accomplished by `scan0`. 

### 5.1. HTML and Raw Text
The `scan0` layer is responsible for identifying HTML. The Semantic Scanner simply passes these along:
- **Opaque HTML:** `HTMLRawText` (representing `<script>`, `<style>`, inside boundaries) is passed through verbatim.
- **Normal HTML Tags:** `HTMLTagOpen`, `HTMLTagClose`, and their attributes are passed through verbatim. The scanner does *not* track whether these tags match or form blocks.

### 5.2. Block Markers
Tokens identifying block structure passed by `scan0` simply skip coalescing and pass through to the parser:
- `BlockquoteMarker`
- `BulletListMarker`, `OrderedListMarker`
- `ATXHeadingOpen`, `SetextHeadingUnderline`

It is up to the final **Parser layer** to look at these markers, assess indentation drops, and emit structural "Open/Close" AST nodes.
