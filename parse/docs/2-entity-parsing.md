# Entity parsing implementation notes

These notes capture the exact generator and runtime rules we agreed on for named-entity parsing and validation. They are intentionally prescriptive so the generator, the generated artifact and the runtime scanner can be implemented independently and verified.

## High-level contract
- Source: [scan-entity-map.json](../scan-entity-map.json) (small, compact JSON produced from the WHATWG JSON).
- Runtime: load the JSON once at module init and build an in-memory two-level lookup:
  1. First-level: direct object keyed by a single ASCII letter (case-preserving). This is the bucket key.
  2. Second-level: for each bucket, a sorted array of key/value entries. Each entry's key begins with either the bucket's single letter (for normal one-letter buckets) or the second letter of a folded two-letter bucket (see "folding" below). Values are the replacement characters (possibly multi-codepoint strings).

## Entity Map parsing rules
Input strings in the JSON contain concatenated name/value pieces. The generator must parse these deterministically using the following priority:
  1. Semicolon (`;`) is a hard separator: if present, split name and value around it (the semicolon belongs to the name side in the flat file). The generator should then canonicalize the name by stripping the trailing `;` when producing the canonical key, but persist an explicit per-entry flag indicating whether the semicolon is required or optional at runtime.
  2. If no semicolon is present between items, fall back to the ASCII classification rule: split between runs using an ASCII alphanumeric boundary. Concretely, while scanning a bucket string left-to-right, when you detect that the next token starts with an ASCII `/[A-Za-z0-9]/` sequence that would be the start of a new name, treat that boundary as a separator between the previous entry's value and the next entry's name.

## Folding two-letter buckets
Two-letter buckets (for historical compactness) are allowed in the source. The generator will fold them into their parent first-letter bucket. Example: a bucket key `"fj"` is folded into the `"f"` bucket, and every name inside `fj` will have its key prefixed with the folded second letter (`j`). Concretely:
  - Source: bucket `fj` contains string `"lig;fj"` (example).
  - Generator moves those entries into bucket `f`, and each entry's key becomes `"j..."` (i.e. second-letter + remainder) so the full expected entity name is reconstructed at runtime by prefixing the parent bucket letter (`f`) to the parsed key (`j...` -> `fj...`).

## Per-entry metadata
For each parsed entry the generator must emit a compact record with:
  - keyRemainder: the remainder of the entity name after the first bucket letter (a short string) that may or may not have trailing semicolon.
  - replacement: the replacement string (can be one or multiple codepoints).
  - the values need to be re-sorted alphabetically with this extra rule:
    *for two strings if one of them startsWith another, the **longest goes first** in the list.*

## Runtime entity mapping data shape
At runtime the entity mapping data will look like:

```json
  {
    "a": [
        { k: "mp;", v: "&" }, // k are remainders, implicitly prefixed with 'a'
        { k: "mp", v: "&" }, 
        { k: "acute;", v: "á" },
        ...
    ],
    "f": [
      { k: "jlig", v: "fj" },
      ...
    ]
  }
```

## Runtime matching algorithm (zero-allocation)
1. When `scanEntity` sees a name-starting character `/[a-zA-Z]/`, it indicates named entity (as opposed to numeric).
2. Map the first code unit to the first-level bucket directly (object property access by single-letter key). If the bucket is absent, return 0 (in reality never happens, every Latin letter has a bucket).
3. Check all entries in the bucket in order:
   - Compare all the input characters to the entry's `k` (the key remainder) using charCode comparisons at corresponding offset (`input.charCodeAt(pos + offset)`), advancing an input index pointer as you compare.
   - Do not allocate any substrings or temporary strings; use integer indices and direct code-unit equality checks.
   - If a candidate's `k` fully matches the input prefix, don't check any others and consider it a correct entity token.
4. If no entries match, return 0 (entity not consumed) — callers will treat the ampersand as literal text.

## Performance notes
- First-level lookup is O(1) (object property). Second-level search is linear but the per-bucket entry count is in low digits; linear scan with inlined charCode comparisons is location-efficient and in practice nearly O(1).
- Implement code carefully to avoid bounds checks overhead: check remaining input length before character-by-character comparisons.

## Ambiguity & fallback
- If the generator during early memory population finds a bucket string that cannot be parsed unambiguously with the semicolon/AZ09 rule throw an Error with descriptive text, the code is broken.

## Validation and tests
- [Entity annotated Markdown test](../tests/2-entities.md) must verify whole of WHATWG JSON entity unvierse and assert:
  - Every name resolves to a valid entity token with correct kind (named)
  - Where semicolon is optional, include both with and without in the same test
  - Where semicolon is required, verify that omitting it produces an InlineText token.

## Implementation checklist
1. Entity map: implement parse rules (semicolon first, then AZ09), fold two-letter buckets, emit per-entry metadata and explicit-offset flags for ambiguous buckets.
2. Update `scanEntity` to use the zero-allocation lookup algorithm above and to return the right tokens with existing limited tests.
4. Add unit tests exercising representative subsets of the WHATWG list plus the `fjlig` edge-case.
5. Investigate and fix any bugs.

This plan lets us keep `entity-map.json` and the compact on-disk form tiny and human-editable, while producing a safe, allocation-free runtime lookup that exactly implements WHATWG entity semantics.
