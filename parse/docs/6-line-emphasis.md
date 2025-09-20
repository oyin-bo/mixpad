# Line emphasis scanning plan

Purpose: a small, precise scanner-facing plan for surfacing emphasis-like delimiter tokens from `scan0`.
The scanner will only emit provisional tokens that represent delimiter runs and minimal contextual flags. Pairing and pairing rules are explicitly out of scope for this phase — the semantic scanner will be responsible for matching/open/close logic.

Goals (concise)
- Emit tokens for runs of: asterisk `*`, underscore `_`, tilde `~` (double-tilde `~~`).
- Avoid pairing, nesting, or any structural decisions at this stage.
- Provide minimal flanking/context flags that the semantic scanner needs to decide open/close later.
- Keep the implementation streaming, low-allocation, and defend against pathological runs.

Token kinds to add / emit
- `AsteriskToken` (single `*`)
- `AsteriskAsterisk` (pair `**`, consume 2 chars when run >= 2)
- `UnderscoreToken` (single `_`)
- `UnderscoreUnderscore` (pair `__`, consume 2 chars when run >= 2)
- `TildeTilde` (only emit for double-tilde `~~` runs)

Minimal flags to encode in provisional token payload
- CanOpen (boolean): likely can serve as an opener. Use existing token-flag bits.
- CanClose (boolean): likely can serve as a closer.
- PrecedingLineBreak / IsAtLineStart (reuse existing flags from `scan-core` context) if set.

Scanner behaviour rules (streaming and small)
- Count the run length of the delimiter char at the current position.
- For asterisks and underscores:
  - If `runLength >= 2`, emit a `**` or `__` token consuming exactly 2 characters.
  - Else emit the single-character token consuming 1 character.
  - Compute `CanOpen`/`CanClose` using local flanking test (left and right chars) but DO NOT pair tokens.
  - The flanking test should be conservative and fast: rely on `isAsciiAlphaNum()` and whitespace detection to set the flags as in old-parser's `computeFlankingFlags` (but keep it minimal).

- For tildes:
  - Only emit `TildeTilde` when there are at least two consecutive `~` characters.
  - Consume exactly 2 characters for the emitted token. If there are more (e.g. `~~~`), emit one `TildeTilde` and leave the remainder to be re-scanned.
  - Set `CanOpen`/`CanClose` using same flanking heuristics.


Edge-case and safety rules
- Cap run-length scanning at a safe limit (e.g. 1024 or a practical cap) to avoid pathological input cost; beyond the cap, treat as repeated tokens by emitting fixed-size tokens repeatedly instead of huge counters.
- Do not consume or convert characters inside code spans/fenced blocks: scanning for these delimiter tokens only happens when `scan0` is in inline-scannable mode.
- If a delimiter is adjacent to punctuation or other delimiter types, always emit tokens — the semantic layer will resolve ambiguous cases.

Token emission order and offsets
- The token length must be encoded in low bits (unchanged): low bits contain length consumed; token kind and flags set in higher bits as per current `scan-tokens.js` conventions.
- Emit exactly one provisional token per scanned delimiter run (or per pair when run >= 2 and we choose double token). Do not emit paired or closing tokens at this stage.

Tests to add (annotated markdown brief cases)
- `*x*` expecting `AsteriskToken` at both `*` positions with flanking flags.
- `**x**` expecting `AsteriskAsterisk` tokens consuming 2 chars each side.
- `a_b` and `_a_` to verify `CanOpen`/`CanClose` differences.
- `~~x~~` expecting `TildeTilde` tokens.
- Mixed runs `***x***` to verify emission policy (one double + one single on remainder).

Implementation notes (developer-friendly)
 - Implement as a small module `parse/scan-emphasis.js` exporting functions used by `scan0` (e.g. `scanAsterisk`, `scanUnderscore`, `scanTildeOrStrikethrough`).
- Keep flanking helper functions in `parse/scan-core.js` to reuse `isAsciiAlphaNum`.
- Add token constants in `parse/scan-tokens.js` for the new token kinds.
- Keep logic deterministic and streaming: use integer counters, no substring allocations during scanning.

Ownership and scope
- This file only prescribes scanner behaviour; pairing and structural parsing is for the semantic scanner.

