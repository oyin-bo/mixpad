# HTML Entities parsing

HTML entity scanning facility is for `&amp;`, `&#38;`, `&#x26;` and similar sequences.

The logic is implemented in a dedicated scanner module [`scan-entity.ts`](../parser/scan-entity.ts) and is invoked from the scanner when an '&' is seen.

The `start` position passed to the entity scanner is guaranteed to point at '&' (the scanner ensures this).

1) Token kinds
- The scanner recognizes exactly three entity token kinds: `EntityNode`, `EntityNode` and `EntityNode`.

2) Decimal and hex numeric references
- Decimal: the sequence is "&" "#" DIGITS ";" (example: "&#38;").
- Hex: the sequence is "&" "#" "x" HEXDIGITS ";" (case-insensitive hex digits; example: "&#x1F600;").
- Numeric references require the trailing ";". If the terminating ";" is missing the scanner does not emit a numeric-entity token.

3) Named references
- The runtime uses a canonical table of names (the WHATWG list) and matches case-sensitively.
- After seeing an initial "&" the scanner reads the longest run of name characters (ASCII letters and digits) and searches for the longest matching canonical name.
- This means certain entities are allowed not to be terminated by a ";" on case by case basis, but the longest run ensures that should semicolon be present it is consumed inside the entity.
- If no canonical name matches the characters after "&" (either with or without ";"), the scanner does not emit EntityNode and must not consume the run as an entity (returns zero which is considered the length of the token with zero high-bits flags too).

4) Emitted token semantics
- For any emitted entity token the scanner provides the token kind and the consumed length in characters, n: the consumed length includes the leading "&" and the terminating ";" if present.

5) On-disk encoding and generator notes
- At start the code parses a compact textual map (one- or two-letter buckets). Parsing of the map is a preparation for runtime matching.

## Simple examples

A simple named entity: &amp;
1                      2
@1 TextNode
@2 EntityNode

Decimal numeric entity: &#38; - note that numeric refs always require ';'.
1                       2     3
@1 TextNode
@2 EntityNode
@3 TextNode

Hex numeric entity, using lowercase 'x': smile &#x1F600; - note hex digits are case-insensitive.
1                                              2         3
@1 TextNode
@2 EntityNode
@3 TextNode


Named reference immediately stuck with text (no whitespace) - note semicolon&copy;included here.
1                                                                           2     3
@1 TextNode
@2 EntityNode
@4 TextNode

Named reference surrounded by whitespace; verifies &copy; that scanner recognizes surrounding tokens.
1                                                 23     45
@1 TextNode
@2 TextNode
@3 EntityNode
@4 TextNode
@5 TextNode

## Additional WHATWG named-entity checks (representative)

Representative single-entity checks (one entity per line)

Ampersand: &amp;
1          2
@1 TextNode
@2 EntityNode

Less-than: &lt;
1          2
@1 TextNode
@2 EntityNode

Greater-than: &gt;
1             2
@1 TextNode
@2 EntityNode

Double quote: &quot;
1             2
@1 TextNode
@2 EntityNode

Apostrophe: &apos;
1           2
@1 TextNode
@2 EntityNode

Copyright: &copy;
1          2
@1 TextNode
@2 EntityNode

Registered: &reg;
1           2
@1 TextNode
@2 EntityNode

Trademark: &trade;
1          2
@1 TextNode
@2 EntityNode

Ellipsis: &hellip;
1         2
@1 TextNode
@2 EntityNode

Em dash: &mdash;
1        2
@1 TextNode
@2 EntityNode

En dash: &ndash;
1        2
@1 TextNode
@2 EntityNode

No-break space: &nbsp;
1               2
@1 TextNode
@2 EntityNode

Euro: &euro;
1     2
@1 TextNode
@2 EntityNode

Pound: &pound;
1      2
@1 TextNode
@2 EntityNode

Yen: &yen;
1    2
@1 TextNode
@2 EntityNode

Cent: &cent;
1     2
@1 TextNode
@2 EntityNode

Plus-minus: &plusmn;
1           2
@1 TextNode
@2 EntityNode

Multiplication: &times;
1               2
@1 TextNode
@2 EntityNode

Division: &divide;
1         2
@1 TextNode
@2 EntityNode

One quarter: &frac14;
1            2
@1 TextNode
@2 EntityNode

One half: &frac12;
1         2
@1 TextNode
@2 EntityNode

Three quarters: &frac34;
1               2
@1 TextNode
@2 EntityNode

Micro: &micro;
1      2
@1 TextNode
@2 EntityNode

Alpha: &alpha;
1      2
@1 TextNode
@2 EntityNode

Beta: &beta;
1     2
@1 TextNode
@2 EntityNode

Gamma: &gamma;
1      2
@1 TextNode
@2 EntityNode

Delta (lower): &delta;
1              2
@1 TextNode
@2 EntityNode

Delta (upper): &Delta;
1              2
@1 TextNode
@2 EntityNode

Omega (upper): &Omega;
1              2
@1 TextNode
@2 EntityNode

omega (lower): &omega;
1              2
@1 TextNode
@2 EntityNode

Less-or-equal: &le;
1              2
@1 TextNode
@2 EntityNode

Greater-or-equal: &ge;
1                 2
@1 TextNode
@2 EntityNode

Not-equal: &ne;
1          2
@1 TextNode
@2 EntityNode

Infinity: &infin;
1         2
@1 TextNode
@2 EntityNode

Summation: &sum; (plus)
1         23
@1 TextNode
@3 EntityNode

Product: &prod;
1        2
@1 TextNode
@2 EntityNode

Negative tests — numeric references without semicolon must not match

Decimal numeric without semicolon: &#169
1                       
@1 TextNode

Hex numeric without semicolon: &#x1F600
1                         
@1 TextNode

Unknown named reference: &notanentity;
1                      
@1 TextNode

Ambiguous/illegal forms

Known entity followed immediately by alphanumeric without semicolon: &ampx
1                        
@1 TextNode

Known entity followed immediately by punctuation without semicolon (should match only if canonical allows omission): &copy)
1                      
@1 TextNode

EOF

