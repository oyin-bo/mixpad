# Semantic Scanner and Parser Design

This document outlines the high-level design for the semantic scanner and parser layers. The design adheres to the project's principles of zero-allocation, incremental processing, and clear separation of concerns.

## High-Level Architecture

The system is designed as a two-stage pipeline where the "paragraph" is the fundamental unit of work passed between stages.

1.  **Semantic Scanner (Producer):** This layer consumes raw text and produces streams of resolved semantic tokens. It encapsulates the complexity of the initial `scan0` provisional tokenization and ambiguity resolution.
2.  **Parser (Consumer):** This layer consumes the streams of semantic tokens and constructs a frugal, tight-shaped Abstract Syntax Tree (AST). It is completely shielded from the mechanics of the underlying scanner.

This architecture ensures that processing is stateless between paragraphs, enhancing robustness and memory efficiency.

## Semantic Scanner

The semantic scanner's primary responsibility is to transform the ambiguous, low-level provisional tokens from `scan0` into a definitive stream of semantic tokens for a single paragraph.

### Chunking and Resolution

The scanner operates on a "paragraph" as its fundamental unit of resolution.

-   **Buffering:** It will invoke `scan0` repeatedly, buffering the resulting provisional tokens in an internal array.
-   **Boundary Triggers:** A chunk is considered complete and ready for resolution when a paragraph-breaking condition is met. Decided boundary triggers are:
    1.  A blank line (two consecutive `NewLine` tokens).
    2.  A `FencedCodeBlock` token.
    3.  The end of the input stream.
-   **Resolution:** Once a complete paragraph chunk is buffered, the scanner will process the provisional tokens to resolve ambiguities. This includes pairing emphasis delimiters (`*`, `_`, `~`) according to the flanking and nesting rules. Provisional tokens are either promoted to semantic emphasis tokens or demoted to plain text.

### Output

The output of the semantic scanner for each chunk is a complete, fully resolved array of semantic tokens for that paragraph. This array is the "increment" that is passed to the parser.

## Parser

The parser's role is to efficiently build an AST from the semantic token stream provided by the scanner. It processes one paragraph-sized chunk of tokens at a time.

### AST Construction Logic

The parser will use a stack to manage the hierarchy of open AST nodes and an "in-place decoration" strategy for node creation.

1.  **Node Creation on "Open":** When an opening semantic token (e.g., `EmphasisOpen`) is encountered, the parser creates a minimal "provisional" AST node. This initial object contains only the `type` and the `start` offset. This new node is pushed onto the parser's stack.
2.  **Appending Children:** Content tokens (e.g., `Text`) or nested structures result in new leaf nodes being created and appended to the `children` array of the node currently at the top of the stack.
3.  **Node Finalization on "Close":** When a closing token (e.g., `EmphasisClose`) is encountered, the parser finds the corresponding provisional node on the stack. It finalizes this node by decorating it in-place with the `end` offset from the closing token, and then pops it from the stack.

This method avoids creating temporary or intermediate objects for a single conceptual node, aligning with the project's efficiency goals.

## Areas Requiring Future Decision

-   **Complex Block Interactions:** The precise rules for how block-level elements like lists and blockquotes terminate paragraphs need to be defined. The initial implementation will focus on simpler boundaries.
-   **Complete Semantic Token Set:** The full vocabulary of semantic tokens (e.g., for links, headers) will be designed as those features are implemented.
-   **AST Node Shape for Blocks:** The specific structure for block-level AST nodes (`Paragraph`, `FencedCode`, etc.) and how they are assembled into the final document tree needs to be determined.
-   **Cross-Paragraph State:** Features that span paragraphs, such as list continuation, may require a minimal state to be passed between parser increments. The design of this state is deferred.
