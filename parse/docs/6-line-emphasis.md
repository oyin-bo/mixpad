# Line emphasis delimiters

Characters `*`, `_`, `~` may form delimiter runs that can later be resolved into emphasis tokens. The scanner (`scan0` / `scanEmphasis`) now focuses on emitting provisional delimiter tokens and performing only character-level demotions that are provably unambiguous from the raw input. Demotions mean characters like asterisk that are guaranteed not to be delimiters are interpreted as part of inline text (for example an asterisk flanked by spaces on both sides). Higher-level decisions (pairing, nesting, final promotion or demotion) are deferred to a later semantic resolver.

## Delimiter tokens: AsteriskDelimiter, UnderscoreDelimiter, TildeDelimiter

- Delimiter token for a contiguous run of the same delimiter character (`*`, `_`, or `~`). As any token it encodes its length.
- For `~` (tilde) runs, the scanner treats single tildes as plain text and only emits a provisional **TildeDelimiter** when the run length is at least 2.
- Runs that are whitespace-flanked on both sides are definitely not delimiters and are treated as plain text.
- Underscore runs that are somewhat stricter examples of intraword (ASCII alphanumeric immediately before and after the run) are demoted, but conditional on prior token being inline text. This conservative rule important to avoid escape sequences or legacy HTML entities that can in fact be whitespace: consider `\n_big_` being a valid emphasis.

No flags are captured, such as in regards of flanking provisional delimiter tokens.

## Delimiter-resolution later

The semantic resolver processes the provisional delimiter tokens, applying the complete flanking rules, pairing rules, and nesting constraints to promote some provisional tokens into real emphasis tokens (openers/closers) and to demote others back into plain text. This pass can be more rigorous and intuitive than CommonMark's rules because it can afford to consider the broader context of paragraph with little cost.
