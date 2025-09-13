# HTML Entities parsing

HTML entity scanning facility is for `&amp;`, `&#38;`, `&#x26;` and similar sequences.

The logic is implemented in a dedicated scanner module [`scan-entity.ts`](../parser/scan-entity.ts) and is invoked from the scanner when an '&' is seen.

The `start` position passed to the entity scanner is guaranteed to point at '&' (the scanner ensures this).

1) Token kinds
- The scanner recognizes exactly three entity token kinds: `EntityNamed`, `EntityDecimal` and `EntityHex`.

2) Decimal and hex numeric references
- Decimal: the sequence is "&" "#" DIGITS ";" (example: "&#38;").
- Hex: the sequence is "&" "#" "x" HEXDIGITS ";" (case-insensitive hex digits; example: "&#x1F600;").
- Numeric references require the trailing ";". If the terminating ";" is missing the scanner does not emit a numeric-entity token.

3) Named references
- The runtime uses a canonical table of names (the WHATWG list) and matches case-sensitively.
- After seeing an initial "&" the scanner reads the longest run of name characters (ASCII letters and digits) and searches for the longest matching canonical name.
- This means certain entities are allowed not to be terminated by a ";" on case by case basis, but the longest run ensures that should semicolon be present it is consumed inside the entity.
- If no canonical name matches the characters after "&" (either with or without ";"), the scanner does not emit EntityNamed and must not consume the run as an entity (returns zero which is considered the length of the token with zero high-bits flags too).

4) Emitted token semantics
- For any emitted entity token the scanner provides the token kind and the consumed length in characters, n: the consumed length includes the leading "&" and the terminating ";" if present.

5) On-disk encoding and generator notes
- The generator parses a compact textual map (one- or two-letter buckets). Parsing of the map is independent of runtime matching; generator correctness is validated against the authoritative JSON. Ambiguous entries are resolved during generation (explicit offsets or two-letter buckets) so runtime lookup is an exact table lookup.

## Simple examples

A simple named entity: &amp;
1                      2
@1 InlineText
@2 EntityNamed

Decimal numeric entity: &#38; - note that numeric refs always require ';'.
1                       2
@1 InlineText
@2 EntityDecimal

Hex numeric entity, using lowercase 'x': smile &#x1F600; - note hex digits are case-insensitive.
1                                              2
@1 InlineText
@2 EntityHex


Named reference immediately stuck with text (no whitespace) - note semicolon&copy;included here.
1                                                                            2     3
@1 InlineText
@2 EntityNamed
@4 InlineText

Named reference surrounded by whitespace; verifies &copy; that scanner recognizes surrounding tokens.
1                                                 23     45
@1 InlineText
@2 Whitespace
@3 EntityNamed
@4 Whitespace
@5 InlineText

