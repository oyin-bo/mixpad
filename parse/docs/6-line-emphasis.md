# Line emphasis delimiters

Characters `*`, `_`, `~` can be emphasis delimiters, or just a part of inline text. Scan0 parser will identify cases where these can be treated as delimiters and emit tokens accordingly.

The "can" part means that the semantic scanner will need to apply mutual-pairing/nesting rules and in some cases **demote** such provisional tokens back to plain text. In other (most) cases the scanner will **promoted** provisional to real emphasis tokens and will attach precise nesting span information when processed by the semantic scanner.

## CanOpen/CanClose flags

These authoritatively specify that a delimiter token can serve as an opener or closer, if paired.

**At least one of those** will always be set for any emitted delimiter token. Tokens that can neither open or close become plain text and merge with adjacent text by the rules of plain text.

## Delimiter runs

**Tilde:** Runs less than 2 are plain text. Runs of 2 or more emit one `TildeDelimiter` token of whatever the run length is, with appropriate flags (or plain text in positions where they cannot be delimiters).

**Asterisk/Underscore:** Runs of 1 and more emit one `AsteriskDelimiter` or `UnderscoreDelimiter` respectively, with appropriate flags (or plain text in positions where they cannot be delimiters).

The breakdown of these runs into single/double tokens is deferred to the semantic scanner.

For **tildes**, only double tildes are valid delimiters. "Leftover" single tildes will be "demoted" to plain text in the semantic scanner.


## Flanking rules

**Note:** punctuation below = Unicode P category.

A delimiter run is **left-flanking** if:
- It is not followed by whitespace
- AND either not followed by punctuation, OR followed by punctuation and preceded by whitespace or punctuation

A delimiter run is **right-flanking** if:
- It is not preceded by whitespace  
- AND either not preceded by punctuation, OR preceded by punctuation and followed by whitespace or punctuation

**CanOpen flags:**
- `*` and `~`: Can open if left-flanking
- `_`: Can open if left-flanking AND (not right-flanking OR preceded by punctuation)

**CanClose flags:**
- `*` and `~`: Can close if right-flanking
- `_`: Can close if right-flanking AND (not left-flanking OR followed by punctuation)