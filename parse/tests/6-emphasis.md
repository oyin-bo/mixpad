# Emphasis delimiter scanning tests

## Asterisk delimiters

Simple *emphasis*.
1      234       56
@1 InlineText
@2 Whitespace
@3 AsteriskDelimiter
@4 InlineText
@5 AsteriskDelimiter
@6 InlineText

Strong **emphasis**.
1      23 4       56
@1 InlineText
@2 Whitespace
@3 AsteriskDelimiter
@4 InlineText
@5 AsteriskDelimiter
@6 InlineText

Intraword a*b*c works.
1         23 45 6     7
@1 InlineText
@2 AsteriskDelimiter
@3 InlineText
@4 AsteriskDelimiter
@5 InlineText
@6 Whitespace
@7 InlineText

## Underscore delimiters

Simple _emphasis_.
1      234       56
@1 InlineText
@2 Whitespace
@3 UnderscoreDelimiter
@4 InlineText
@5 UnderscoreDelimiter
@6 InlineText

Intraword a_b_c doesn't work for underscores.
1                                           2
@1 InlineText

But punctuation._emphasis_.works.
1    2          3         4 5     6
@1 InlineText
@2 InlineText
@3 UnderscoreDelimiter
@4 InlineText
@5 UnderscoreDelimiter
@6 InlineText

## Tilde delimiters

Single ~tilde~ doesn't work.
1                           2
@1 InlineText

Double ~~strikethrough~~ works.
1      234              56     7
@1 InlineText
@2 Whitespace
@3 TildeDelimiter
@4 InlineText
@5 TildeDelimiter
@6 Whitespace
@7 InlineText

Triple ~~~strikethrough~~~ works too.
1      234             567     8   9
@1 InlineText
@2 Whitespace
@3 TildeDelimiter
@4 InlineText
@5 TildeDelimiter
@6 Whitespace
@7 InlineText
@8 Whitespace
@9 InlineText