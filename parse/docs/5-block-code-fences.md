% Block Code Fences — Implementation & Test Plan

This document describes a concrete plan to implement block code fences in the scanner layer. It covers the token-level design, scanner algorithms, edge cases, annotated-markdown tests (as first-class specification), and the integration steps into the existing `scan0` flow.

Goals
- Recognize fenced code blocks delimited by runs of backticks (`` ` ``) or tildes (`~`) with a minimum run length of 3.
- Capture the info string following the opener (commonly a language name and optional attributes) without allocating substrings until we know the fence is balanced.
- Emit provisional tokens suitable for the parser to reconstruct a fenced code node: opener (with length and info-string length), content payload, and closer (with length). Use existing provisional token style and fallback flags when unbalanced.
- Provide an exhaustive set of annotated-markdown tests that serve as documentation and as the authoritative spec for scanner behaviour.

Constraints & Project Rules (explicit)
- The project uses plain JavaScript with JSDoc — no TypeScript. Follow existing code style (no trailing commas, use T[] style for arrays in JSDoc where applicable).
- There is no build step. Tests are run with `npm test`. All additions must fit the testing harness and the annotated-markdown philosophy in `parse/docs/1-annotated-markdown.md`.
- Don't create temporary helper scripts or non-committed debug files.

Token model (provisional tokens)
- Use existing pattern for provisional tokens (bit-packed integer where low bits may hold length). Provisional tokens to add or reuse:
  - FencedOpen: encodes fence char (backtick vs tilde), fence-length (number in lower bits), and info-string length (or offset) in higher bits if space allows.
  - FencedInfo: token that represents the info string (language/attributes) and its length. May be folded into FencedOpen if simpler.
  - FencedContent: represents the raw content span length (no slices until parser requests content).
  - FencedClose: encodes fence char and length for the closing run.
  - Use existing ErrorUnbalancedTokenFallback flag for cases where opener exists but no balanced closer is found; in that case scanner should emit opener(with flag) and FencedContent with fallback length (content up to EOF or permissible fallback length).

Scanner algorithm (streaming, allocation-sparing)
1. Detection
  - At each position `pos` where `input.charCodeAt(pos)` is ``96`` (backtick) or ``126`` (tilde) attempt a fence parse only when we can guarantee we are at a line-start context that permits a block opener. To make this robust we must update `scan0` so it never returns in the middle of a line: callers should only invoke token-start dispatchers at a syntactic line-start boundary. Practically, that means:
  - `scan0` will track a line-start state and ensure it does not call fence-detection when the cursor is mid-line. When `scan0` is called at a position, we can assume it is at the start of a line (or after up to 3 leading spaces).
  - Critically: `scan0` must stop returning early after producing an inline backtick token. Previously `scan0` sometimes returned to its caller mid-line after handling an inline backtick run; that behavior must be removed. Instead, `scan0` should continue its scanning loop until it reaches a line boundary (newline or end-of-input) or another safe dispatcher point. This guarantees that when a backtick or tilde is observed and `scan0` dispatches to fence detection, the scanner is operating in a deterministic line-start context and can apply the previous-token/whitespace rule reliably.
    - The block-fence check becomes: if the previous tokens are none, or there is only one previous token and it is whitespace of size 3 characters or less, then treat this backtick/tilde run as a possible block fence opener. Otherwise, treat it as inline: for tilde fallback to inline text; for backtick hand off to inline code handling.
    - If the project prefers to keep the scanner robust regardless of `scan0` behaviour, scanners may double-check by scanning backwards to the previous newline and applying the same rule, but the preferred design is to move line-start responsibility into `scan0`.
2. Opening run
   - Count consecutive identical fence characters starting at `openerStart` to obtain `openN`.
   - Require `openN >= 3` to be a valid opener. If less, do not treat as fence.
3. Info string
   - After the opening run, allow up to one space (typical) then capture the info string until end-of-line or first newline. The info string may contain the language identifier and optional attributes; scanner should record the info string length and postpone trimming or parsing until parser phase unless minimal normalization is cheap and safe.
   - Do not allocate substring for info yet; store its `start` and `length` as parts of provisional tokens.
4. Content scan
   - Starting at the first character after the newline following the opener, scan forward for a closing run. A valid closer is a run of the same fence character with length >= `openN`, appearing at the start of a line (allow up to 3 leading spaces). The closer's run may be longer than opener; spec requires length >= opener.
   - While scanning, treat all text as content (including lines beginning with fence chars) unless they match a valid closer as above.
   - Support both LF and CRLF line endings. Normalise positions accordingly without slicing strings.
5. Balanced vs unbalanced
   - If a closer is found: return or emit FencedOpen, FencedContent (length up to start of closer), and FencedClose (encoding closing length). Include info-string token (or embed info metadata in FencedOpen).
   - If no closer is found before EOF: emit FencedOpen | ErrorUnbalancedTokenFallback and FencedContent | ErrorUnbalancedTokenFallback. The parser or fallback logic will convert to literal backticks in inline content or other error handling.

Edge cases and policy decisions
- Mixed fence characters: an opener of backticks must be closed by backticks only. Tildes close only tildes.
- Fence runs inside code block: interior runs that equal or exceed openN but are not at line-start (or have more than 3 leading spaces) are content, not closers.
- Close with longer run: spec permits closer length >= opener. We will treat any longer closing run as valid and record its actual length.
- Info string whitespace: trim trailing spaces from the info string when recording its content length for convenience. Leading spaces after the opener up to one are allowed; multiple spaces are part of info string.
- Tabs and indentation: treat tabs as single characters; but the indentation rule (<=3 spaces) applies only to spaces, as per common Markdown practice. If we must be strict, treat a tab as equivalent to at least one column but avoid complex column math at scanner level — document this limitation.
- CRLF vs LF: accept both. When computing lengths/offsets, use character indices in the original `input` string; leave normalization to higher layers if needed.
- Nested fences: inside a fenced block, interior runs of the same fence char are allowed and do not close unless they appear on a line-start with allowed indentation and meet run-length.
- Fences inside list items: allow up to 3 leading spaces before opener; do not attempt to interpret further list structure at this scanner layer. Parser can later examine indentation context.

Annotated-markdown tests (required first)
The project mandates annotated Markdown tests as both spec and tests. Add test cases that cover:

- Happy path
  - Triple backticks opener, single-line content, triple backticks closer.
  - Triple tildes opener and closer.
  - Opener with language info: ```js
console.log(1)
```
  - Opener length 4, closer length 4; closer length greater than opener length.

- Edge cases
  - Opener with only 1-2 backticks — should NOT parse as fence; must be inline/backtick behaviour.
  - Unclosed fence until EOF — should emit unbalanced tokens and be handled by fallback.
  - Fences with leading up to 3 spaces.
  - Content that contains runs of fence characters shorter than opener and longer than opener but not at line start — should remain content.
  - Info string including attributes: ```python linenums="1"
print(42)
```
  - Windows CRLF line endings within content and around fences.
  - A closer with same char but less than open length (e.g., opener 4, closer 3) — not a closer.

Test format and wiring
- Create annotated markdown files under `parse/tests/` such as `fenced-backticks.md`, `fenced-tildes.md`, `fenced-edge-cases.md` with both input and expected provisional token annotations as the existing tests do. Follow the pattern used in `parse/tests/test-annotated.js` and other `parse/tests/*.md` files.
- Each annotated test must include the exact offsets or the token sequence expected, consistent with the project's test harness. Provide explicit examples for scanner-only expectations (token kinds and lengths) and full parse expectations (AST node types) where appropriate.

Integration steps (practical order)
1. Draft annotated-markdown tests (these act as specification) and add them to `parse/tests/`.
2. Implement `parse/scan-backtick-fences.js` (or `scan-fences.js`) exporting a `scanFencedBlock(input, start, end, output)` function that mirrors patterns in `scan-backtick-inline.js` (streaming, index-based, no allocations until close confirmed). Keep JSDoc and style consistent.
3. Wire `scan0.js` to call the new scanner when encountering a backtick or tilde at a potential opener position. Ensure scanner receives correct `start` (index where fence char appears) and `end`.
4. Update provisional token constants in `parse/scan-tokens.js` if needed, and reuse `ErrorUnbalancedTokenFallback` flag.
5. Run `npm test`, iterate on failures, and refine tests or implementation.

Quality gates and smoke checks
- Build: not applicable (JS no build), but run a lint/format check if project has one.
- Tests: `npm test` must run all existing tests including new annotated tests. Aim to have all pass.
- Smoke: run a few targeted test files and inspect provisional tokens emitted for representative cases.

Deliverables
- `parse/docs/5-block-code-fences.md` (this file) updated with the plan.
- Annotated-markdown tests added under `parse/tests/` (filenames and list included in the TODOs above).
- A new scanner module `parse/scan-fences.js` implementing the algorithm.
- `scan0.js` updated to delegate to the new scanner.

Next immediate steps
1. Implement `parse/tests/fenced-backticks.md` and `parse/tests/fenced-edge-cases.md` (annotated tests) as the top priority — these will drive the implementation.
2. Implement scanner module and wire into `scan0.js`.
3. Run `npm test` and fix issues.

Notes and assumptions
- Assumed the project's provisional token encoding allows adding a few new token kinds and using the existing flag bits. If token bit layout is constrained, prefer to emit separate tokens (FencedInfo, FencedContent) rather than overloading.
- Assumed `scan0.js` is the central dispatcher for single-character token starts and that delegating there is consistent with the project structure seen in `scan-backtick-inline.js`.
- Assumed annotated Markdown tests are discovered by the existing harness (see `parse/tests/test-annotated.js`) — if not, add test harness wiring.

Appendix: Example annotated test snippet (illustrative)
```
Input:
```js
console.log('hello')
```

Annotated expectations (scanner tokens):
- FencedOpen (char=backtick, length=3, infoLen=2)
- FencedContent (length=20)
- FencedClose (char=backtick, length=3)
```

End of plan.