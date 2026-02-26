# Text coalescing

The semantic scanner merges adjacent `InlineText` tokens into a single token,
including unmatched delimiter runs that are demoted to plain text.

## Plain text passes through

Plain text is forwarded as InlineText

This is text
1
@1 InlineText "This is text"

## Unmatched delimiters coalesce with neighbours

Space-flanked asterisk merges with surrounding text

word * word
1
@1 InlineText "word * word"

Unmatched single tilde stays as InlineText (scan0 treats single ~ as InlineText)

~word~
1
@1 InlineText "~word~"

## Entities pass through unchanged

Named entities are forwarded

Some text &amp;
1         2
@1 InlineText "Some text"
@2 EntityNamed "&amp;"

## Whitespace tokens pass through unchanged

Whitespace is not coalesced with InlineText

 word
12
@1 Whitespace " "
@2 InlineText "word"
