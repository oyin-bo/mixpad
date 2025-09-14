# Provisional token flag shifts — plan and migration

This document captures a pragmatic, step-by-step plan to shift the ProvisionalToken format from the current 24-bit-length/7-bit-flags design to a layout with a 16-bit length and 15 bits of flags/payload. It collects the concerns discussed, a suggested bit-field interpretation, migration blockers, testing and benchmark actions, and an ordered rollout plan.

## Goals

- Preserve hot-path performance for common text runs.
- Provide enough flag/payload space to index ~1.5k named HTML entities directly from the token stream.
- Keep downstream complexity manageable by offering small, fast helper accessors (`getLength`, `getOpcode`, `getPayload`, `getEntityIndex`) and a clear continuation/coalescing convention.
- Provide a clean upgrade path and a fallback mechanism for rare cases that exceed the compact encoding.

## Chosen high-level encoding

- Use a single 31-bit signed integer (the current token) to encode two fields:
  - Bits 0..15  (16 bits)  = length (0..65535)
  - Bits 16..30 (15 bits)  = flags / opcode / payload

Layout rationale: 16-bit length removes almost all run-splitting in normal text while releasing 15 bits to express token kind and per-kind metadata. The 15-bit region is interpreted conditionally based on a compact opcode so we can economically dedicate bits to entity indices when needed.

## Conditional interpretation (opcode + payload)

- Reserve 4 bits for a primary opcode (bits 16..19). This yields 16 opcode values; that should be sufficient for the scanner's core token kinds. The remaining 11 bits (bits 20..30) are a per-opcode payload.

Layout summary (bit indices):

- length: token & 0xFFFF
- opcode: (token >>> 16) & 0xF
- payload: token >>> 20  (0..2047)

Why 4-bit opcode + 11-bit payload?
- 11 payload bits let us index up to 2048 entities — enough for the ~1.5k entity table you mentioned.
- Conditional decoding means the same 11 bits are reused for different token kinds (flags for text runs, small payload for numeric entities, index for named entities) instead of wasting a flat partition.

## Suggested opcode table (example)

We should pick exact opcodes after auditing current scanner outputs, but a pragmatic starting table:

1. 0x0 — TextRun
2. 0x1 — Whitespace
3. 0x2 — Newline
4. 0x3 — Punctuation
5. 0x4 — EntityNamed
6. 0x5 — EntityNumeric
7. 0x6 — AttrName
8. 0x7 — AttrValue
9. 0x8 — PercentEncodedRun
10.0x9 — Comment
11.0xA — Doctype
12.0xB — Continuation / Follow-up marker (rare)
13.0xC — EOF / Sentinel
14.0xD — Error/Invalid
15.0xE — Reserved
16.0xF — Reserved / Extension

Notes:
- `EntityNamed` interprets payload as the entity index (0..2047). Implementations can treat a payload value of 0 as "no-index / reserved" if useful.
- `TextRun` uses payload bits as a small set of booleans and a subtype. For example: bit0=continuation, bit1=inside-attr-value, bit2=attr-unquoted, bits3..10 reserved for subtypes.
- `EntityNumeric` uses payload as a few validation flags (decimal/hex, range-valid) or a small inline decoded codepoint for the common low-range entities if desired.
- `Continuation` opcode is available for exotic extension sequences where payload alone is insufficient.

## Helper accessors (contract)

Add central helpers and use them everywhere the token format must be read. Examples (pseudocode):

```javascript
function getLength(token) { return token & 0xFFFF; }
function getOpcode(token) { return (token >>> 16) & 0xF; }
function getPayload(token) { return token >>> 20; }
function getEntityIndex(token) { if (getOpcode(token) !== OPCODE.EntityNamed) return -1; return getPayload(token); }
```

Keep these in a tiny shared module so only one place needs to change if we tweak the bit layout.

## Continuation / Coalescing rules

- Rare splitting (exceeding 65535) is unavoidable; the high-level scanner should coalesce contiguous tokens with identical opcodes and compatible payloads.
- Simple coalescing rule: if next token has the same opcode and the payload indicates it is a continuation (for `TextRun`: a continuation bit may be present in payload), simply sum the lengths logically for downstream consumers. No heap allocations required.
- A dedicated `Continuation` opcode may be used for complex extension sequences where payload alone is insufficient.

## Handling validation bits (semicolon, validated, ambiguous)

There are three ways to represent small validation flags associated with entity tokens:

1. Encode flags in the `EntityNamed` payload high bits by trading some index capacity. (Not recommended; we need ~1.5k indices.)
2. Use two opcode variants: `EntityNamed` and `EntityNamedSemi`/`EntityNamedNoSemi`, consuming one opcode value to carry the semicolon information. This uses opcode space but keeps index space intact.
3. Emit a rare follow-up metadata token for entities that need extra flags. The follow-up token is a second integer in the stream (opcode = `Continuation` or `Extension`) with a compact bitmask of validation flags. This keeps the common case compact and places complexity only in rare cases.

Recommendation: prefer approach (3). Most entities are common and can be fully represented with the index only; emit follow-up metadata tokens for the small fraction that need semicolon/no-semicolon disambiguation or extra warnings.

## Extension mechanism for overflow cases

- If the payload value is reserved (for example `payload === 0x7FF`) interpret that as "use extension": the scanner should immediately read one or more extension tokens that carry extra data (bigger indices, extra flags, or decoded codepoints).
- Extension tokens are intentionally rare and can use an agreed sub-format (opcode = `Continuation` or `Extension`) and one or more integers carrying arbitrary data.

## Migration and rollout plan (pragmatic)

1. Specification and tests
   - Finalize exact opcode list (resolve exact set of token kinds in scanner output).
   - Update `parse/docs/3-provisional-token-flag-shifts.md` (this document) with final opcodes.
   - Write unit tests for the helpers (`getLength`, `getOpcode`, `getPayload`, `getEntityIndex`).

2. Simulator & measurement (low risk, no runtime change)
   - Add a small simulator script that can re-emit token streams from existing scanner outputs using the new layout. This will allow counting token-stream length for realistic corpora and spotting pathological expansion.

3. Implementation (scanner side)
   - Implement helper accessors and new token emission in `scan0.js` behind a feature gate or branch flag.
   - Emit `EntityNamed` tokens with payload = entity index for the common case; use extension tokens only when index >= 2048 or extra flags are needed.

4. Semantic scanner integration
   - Update the semantic/scanner layer to use the new helpers and coalescing rules. Keep a compatibility shim that understands the old format until full migration is complete.

5. Gradual rollout
   - Run the simulator and tests on corpora.
   - Merge scanner changes behind a feature flag; run internal benchmarks and integration tests.
   - Turn on by default after measurement meets acceptance criteria.

## Blockers and how to handle them

- Downstream assumptions: If consumers assume "one token == one integer" in many places, the follow-up metadata scheme will require small changes. Mitigation: keep the follow-up metadata extremely rare and centralize handling in the semantic scanner layer so most code paths remain untouched.
- Opcode space: 4-bit opcode gives 16 kinds. If auditing shows we need more, we must choose between increasing opcode bits (to 5) and reducing entity payload from 11 to 10 bits (1024 indices) or using extension tokens for unusual opcodes. Mitigation: do an audit of current token kinds; many can be collapsed into a small set at the provisional layer and expanded at semantic layer.
- Entity table growth: if the entity set grows beyond ~2048, we need a simple extension. Mitigation: reserve a payload sentinel value indicating "extended entity index" and emit an extension token with a larger index.

## Acceptance criteria

- Unit tests for helpers pass.
- Simulator demonstrates acceptable token-stream growth (<~10–20% increase in integers for large document corpus typical of MixPad; threshold adjustable based on measured CPU tradeoffs).
- Real benchmarks show no meaningful regression in hot-path tasks (token iteration/scan). If regressions occur, evaluate 12-bit/19-bit split or extension strategies.

## Tests and benchmarks to run

- Corpus: a set of large markdown/HTML files used by current benchmarks (old-parser results, `parse/tests` corpus). Measure token counts and tokens-per-char.
- Microbenchmarks: iterate tokens and do a tight loop that reads length/opcode/payload to model rendering passes.
- Edge-case tests: extremely long unbroken text (>65k), very entity-heavy inputs, pathological tiny tokens.

## Tasks and owners (suggested)

- Finalize opcode table — owner: scanner author
- Implement helpers & simulator — owner: scanner author
- Run corpus simulator and produce report — owner: perf engineer
- Implement emission & extension tokens behind feature flag — owner: scanner author
- Update semantic scanner to coalesce runs and honor EntityNamed payload — owner: semantic scanner author
- Merge behind flag, run integration tests, flip flag — owner: maintainer

## Next steps (immediate)

1. Confirm opcode list (do a quick audit of current `scan0.js` token kinds). If you want, I can scan the code and propose a finalized opcode enum.
2. I can produce the simulator script that re-emits tokens using the new format and runs it on the `parse/tests` corpus to report token-count changes.

If you want me to proceed with either of those immediate next steps, say which one and I'll run it and report results.

---

This document is intentionally pragmatic — compact on the hot-path, flexible for rare cases, and guarded with a small extension mechanism. Helper accessors and a feature-gated rollout will make the migration low-risk while enabling much richer token metadata for entities and other scanner duties.
