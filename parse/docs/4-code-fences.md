% Inline code spans (backticks) — conventions and scanner guidance

This document defines the exact conventions MixPad follows for inline code spans (backtick-delimited code), highlights special cases and parsing difficulties, and gives implementation guidance for a fast and safe parsing approach in the `scan0` scanner.

1. Syntax summary

- A code span is delimited by a run of one or more backtick characters ("`). The same number of backticks must appear at both the opening and closing delimiter.
- The content of the code span is the characters between the opening and closing backtick runs, with the following normalization applied:
	- If the content begins or ends with a single space, and the content has at least one non-space character, a single leading and/or trailing space is removed. This implements the "one leading/trailing space removed" rule from commonmark for code spans.
	- All other spaces inside the span are preserved verbatim (no collapsing or trimming beyond the single-edge-space rule above).
- The opening/backtick run may be followed immediately by content (no mandatory space). The closing run must match the exact number of backticks used to open.

2. Delimiter detection rules and precedence

- The scanner must find the first opening backtick run and then search for the next backtick run of equal length that serves as the closing delimiter. The search must allow intervening backticks of different lengths (for example, an opening "``" may contain a single "`" character in its content) — these are treated as content and not delimiters.
- The closing delimiter is the first occurrence of the same-length backtick run that is not escaped (see escaping below) and that occurs after the opening delimiter. The scanner must not treat backticks inside fenced code blocks (triple backticks as block fences) as inline delimiters; however, this document focuses only on inline spans — the scanner's state machine must therefore respect higher-level block contexts when scanning in the general parser.

3. Escaping and literal backticks

- Backticks are not traditionally escapable as inline backtick delimiters via backslash in commonmark; instead, the delimiter length technique is used (use more backticks on the outside). MixPad follows the delimiter-length approach: to include backticks in the code content, the author uses a longer opening/closing run. For example:
	- To include a single backtick in content: use "`` ` ``" (opening and closing double backtick, content is a single backtick).
	- To include two consecutive backticks in content: use "``` `` ```".
- The scanner must therefore never treat a backslash before a backtick as making the backtick a delimiter or a literal — it should treat backslashes inside code spans as ordinary characters.

4. Special cases and gotchas

- Nested-looking delimiters: sequences like "``a ` b``" are legal: opening "``", closing "``", and content "a ` b". The scanner must not prematurely close on the inner single-backtick.
- Mixed runs: if the source contains something like "`code`` " where opening is single backtick and later there is a double-backtick, the double-run cannot close the single-run; only an exact-length run closes.
- Zero-length content: empty code spans are permitted if the opening and closing runs are adjacent, e.g. "````" (two pairs of double backticks with empty content). Normalization rules (trimming one leading/trailing space) apply only if there is at least one non-space character in the content; fully-empty content remains empty.
- Leading/trailing spaces: consider the input "` code `" — the content is "code" (outer single spaces trimmed). For content that is only spaces (e.g. "`  `" with two spaces inside single-backticks) trimming rule leaves a single space? According to the one-space trim applied only when the content contains at least one non-space character — so content that is only spaces preserves all spaces. MixPad follows the CommonMark rule: if the content is all spaces, it remains unchanged.
- Adjacent punctuation and backticks: sequences like "text`x`y" should be parsed as an inline code span `x` with trailing text `y`. The scanner must therefore allow code spans to be adjacent to other characters without whitespace.
- Unicode and combining characters: backticks are ASCII 0x60; any visually similar Unicode characters (e.g., modifier letter turned comma or grave accents) are not equivalent delimiters. The scanner must match exactly U+0060.

5. Performance considerations

- A naive algorithm that attempts to re-scan from every backtick for every potential closer can be O(n^2) on pathological inputs (e.g., extremely long documents with many repeated backticks). MixPad must remain fast on adversarial inputs.
- The scanner should therefore scan linearly: on seeing an opening run of N backticks, scan forward byte-by-byte until the next run of N backticks is found (ignoring shorter runs as content). This still can be O(n) per span and overall linear when implemented carefully because each character is visited a bounded number of times in a streaming scan.

6. Safety and correctness constraints

- Avoid unbounded lookahead: do not buffer the entire rest of the document when searching for a closer. Work in a streaming fashion. If the document is streamed, the scanner can maintain the current run length and a small buffer for potential content until the matching closer is found or the line ends.
- Defensive limits: for extremely long delimiter runs (e.g., thousands of backticks) the scanner should still behave deterministically; MixPad chooses to allow arbitrarily long runs but must avoid recursion and big allocations per-run. Use integer counters and streaming position markers instead of allocating temporary strings proportional to the whole rest of the document.

7. Implementation notes for `scan0` scanner

Overview: implement code span parsing as a small, stateful subroutine invoked when `scan0` encounters a backtick (U+0060) while in an inline-scannable context. The subroutine should return either a successful code-span token (with normalized content) or a literal backtick token if no closing delimiter is found.

- Entry preconditions:
	- `scan0` is currently scanning inline text (not inside a block-level code fence or other block contexts where inline spans are disabled).
	- The current character is a backtick. `scan0` must count the consecutive backticks to determine the opening delimiter length `N`.

- Procedure (streaming, linear, allocation-sparing):
	1. Record the start index (position after the opening delimiter) and set `openN = N`.
	2. Advance a cursor forward scanning characters. Maintain a small window for content (see normalization below). Do not copy content into a new string until a closing delimiter is confirmed.
	3. When you encounter a backtick, count the length `k` of this consecutive backtick run.
		 - If `k != openN`, this run is part of content: continue scanning (but treat the encountered backticks as content bytes). Important: when `k > openN`, it's still content — only exact matches close.
		 - If `k == openN`, this is a potential closer. Confirm that it is not part of a larger run that would change interpretation (exact matching semantics: the first exact-length run closes). Close immediately.
	4. If end-of-input is reached with no closer found, treat the opening backticks as literal characters: emit them as text (or a literal token) and rewind cursor to position after the opening delimiter for further scanning.

- Content extraction and normalization:
	- Once a closer is found, compute the content range between opening end and closing start. Now decide whether to normalize edge spaces. To avoid copying content prematurely, use the original buffer and indices: find first and last indices of non-space (0x20) within the content range.
	- If content contains at least one non-space character, and the first character is a space (0x20), increment the start index by one. If the last character is a space and there is at least one non-space character, decrement the end index by one. These index arithmetic ops avoid allocations until producing final token content.
	- Allocate the token content string once from the source buffer slice `[start, end)`.

- Token emission:
	- Emit a code-span token with metadata: delimiter length `openN`, raw content slice, normalized content slice, and start/end positions (for downstream tools and tests).
	- If no closer, emit a literal-text token containing the original backtick run followed by whatever content was scanned as plain text.

- Edge-case handling and tests to add:
	- Opening with N backticks where the only matching runs later are nested shorter runs — scanner must not match shorter runs. Add tests for "`a ` b`" vs "``a ` b``".
	- Input with very long runs of backticks: ensure no excessive memory allocations and that the scanner still completes linearly.
	- Content that is all spaces vs content that contains at least one non-space character: verify normalization correctness.
	- Backtick characters immediately followed or preceded by non-space punctuation: ensure adjacency parsing is correct.

8. Example behaviors (reference)

- Source: ``Here is ``code` inside``
	- Opening: double-backtick. Closing: the later double-backtick. Content: "Here is `code` inside" (any internal single-backticks are preserved as content).
- Source: ` simple ` -> Content normalized to "simple" (trimming single leading/trailing space because at least one non-space char exists).
- Source: `  ` -> Content stays as two spaces (all-space content preserved).

9. Notes on integration with the parser

- `scan0` must only run this inline backtick routine when the parser's block context allows inline spans. For example, inside a raw HTML block or a code block fence the scanner should not attempt to parse inline spans. This context is typically represented by a small state flag passed to `scan0`.
- Downstream stages (parser/renderer) should rely on tokens carrying both raw and normalized content plus delimiter-length metadata to reproduce original source or perform transformations.

10. Final remarks

The approach above favors a streaming, allocation-sparing, linear-time scan that implements the CommonMark code span semantics where sensible while keeping MixPad's constraints: pure JavaScript source, no heavy allocations, and suitability for annotated-markdown testing. Avoiding backslash-escape semantics and relying on delimiter-length for literal backticks simplifies the scanner and matches author expectations.


11. Orchestrated scanner API (recommended)

To support clear separation of concerns and to make the `scan0` implementation small and testable, MixPad adopts a three-function orchestration for inline backtick scanning. The responsibilities and calling sequence are:

- `scanBacktickOpen(input, start, end)`
	- Called when `scan0` encounters a backtick at `start` (where `input[start] === '\u0060'`).
	- Counts the consecutive opening backticks and returns a `BacktickBoundary` provisional token encoding the run length in its low bits (i.e. `BacktickBoundary | runLength`).
	- In the rare corner-case where the call site is at EOF the function may return `0` to indicate no meaningful run was produced and `scan0` should fall back to inline text handling.

- `scanInlineCode(input, openStart, openN, end)`
	- Invoked after a successful `scanBacktickOpen` and given the opening run length `openN` and its start index `openStart`.
	- Scans forward in a streaming way searching for the first backtick run whose length exactly equals `openN`. Shorter or longer runs are treated as content and skipped over. No allocation is performed while scanning — only integer indices are advanced.
	- If a closer is found, the function returns an `InlineCode` provisional token encoding the total consumed length (from `openStart` through the end of the closing run): `InlineCode | totalLength`.
	- If no closer is found, the function returns `0` to signal failure; calling code should revert to emitting the opening backticks as literal inline text.

- `scanBacktickClose(runLength)`
	- A convenience that encodes a closing backtick run as a `BacktickBoundary | runLength` token. It mirrors `scanBacktickOpen`'s encoding and is useful for symmetric token emission.

Calling sequence in `scan0` (high level):

1. On seeing a backtick, call `scanBacktickOpen(input, offset, end)`.
2. If it returns `0`, fall back to existing inline text scanning (`scanInlineText`).
3. Otherwise extract `openLen` from the returned token (low bits) and call `scanInlineCode(input, offset, openLen, end)`.
4. If `scanInlineCode` returns a non-zero `InlineCode` token, emit in this order: `BacktickBoundary | openLen`, then the `InlineCode` token, then `BacktickBoundary | openLen` (closing). Advance the scanning offset by the `InlineCode` token's length.
5. If `scanInlineCode` returns `0`, revert to `scanInlineText` behavior for the opening run (emit literal backticks as inline text) and continue scanning.

This orchestration keeps `scan0`'s loop readable, centralizes backtick/inline-code complexity in a small dedicated module, and lets unit tests target each piece independently.

