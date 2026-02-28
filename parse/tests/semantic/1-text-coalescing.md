# Text Coalescing

In the semantic scanner, adjacent fragment tokens that result in text
should be coalesced into single InlineText tokens. This includes
original InlineText tokens, and demoted delimiters.

## Basic word coalescing

Hello world
1
@1 InlineText "Hello world"

<--EOF

## Entities stay separate

Text with entity — entity remains as its original EntityNamed/EntityNumeric kind,
preventing merging across entity boundaries. Surrounding text fragments
between entities should still coalesce.

Some text &amp; more
1         2    3
@1 InlineText "Some text"
@2 EntityNamed "&amp;"
@3 Whitespace " "
@4 InlineText "more"

## Delimiter demotion coalesces with neighbours

text * more
1
@1 InlineText "text * more"

## Multiple spaces remain separate

word   word
1   2
@1 InlineText "word"
@2 Whitespace "   "
@3 InlineText "word"

## Whitespace at start of line remains separate

 indented
12
@1 Whitespace " "
@2 InlineText "indented"
