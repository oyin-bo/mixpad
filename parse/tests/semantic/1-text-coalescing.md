# Text Coalescing

The semantic scanner merges adjacent InlineText tokens produced by scan0.
In practice scan0 is already aggressive about merging, so coalescing is
a safety net for edge cases produced by delimiter demotion.

## Simple pass-through text

Plain text with no delimiters passes straight through.

Hello world
1
@1 InlineText "Hello world"

Text with entity — entity stays as EntityNamed, surrounding text coalesces.

Some text &amp; more
1         2     3
@1 InlineText "Some text"
@2 EntityNamed "&amp;"
@3 InlineText "more"

## Delimiter demotion coalesces with neighbours

An unmatched lone asterisk surrounded by text is demoted to InlineText
and merged with adjacent text tokens.

text*more
1
@1 InlineText "text*more"

A space-flanked asterisk is already demoted by scan0 to inline text.

word * word
1
@1 InlineText "word * word"

## Whitespace tokens pass through unchanged

A line with leading whitespace.

 indented
12
@1 Whitespace " "
@2 InlineText "indented"
