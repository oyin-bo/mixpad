# Emphasis Pairing

The semantic scanner pairs AsteriskDelimiter / UnderscoreDelimiter /
TildeDelimiter provisional tokens into resolved EmphasisOpen/Close,
StrongOpen/Close, and StrikethroughOpen/Close tokens.

## Asterisk emphasis

*word*
12   3
@1 EmphasisOpen "*"
@2 InlineText "word"
@3 EmphasisClose "*"

**bold**
1 2   3
@1 StrongOpen "**"
@2 InlineText "bold"
@3 StrongClose "**"

## Underscore emphasis

_word_
12   3
@1 EmphasisOpen "_"
@2 InlineText "word"
@3 EmphasisClose "_"

__strong__
1 2     3
@1 StrongOpen "__"
@2 InlineText "strong"
@3 StrongClose "__"

## Strikethrough

~~strike~~
1 2     3
@1 StrikethroughOpen "~~"
@2 InlineText "strike"
@3 StrikethroughClose "~~"

## Nested emphasis

*em **and strong** here*
1   2           3      4
@1 EmphasisOpen "*"
@2 StrongOpen "**"
@3 StrongClose "**"
@4 EmphasisClose "*"

## Mixed: emphasis inside a sentence

Hello *world* end
1     23    4 5
@1 InlineText "Hello"
@2 EmphasisOpen "*"
@3 InlineText "world"
@4 EmphasisClose "*"
@5 InlineText "end"

## Nested emphasis: triple asterisk

Triple asterisk pairs as outer emphasis wrapping inner strong.

***word***
12 3   4 5
@1 EmphasisOpen "*"
@2 StrongOpen "**"
@3 InlineText "word"
@4 StrongClose "**"
@5 EmphasisClose "*"

<--EOF

## CommonMark mod-3 rule

When either delimiter can both open and close and the sum of run lengths is a
multiple of 3 (but neither alone is), they cannot form emphasis.

Both delimiters are intraword (can both open and close); 1+2=3 is a multiple of 3.

a*foo**b
1
@1 InlineText "a*foo**b"

<--EOF

## Unmatched opener is demoted to InlineText

*unclosed
1
@1 InlineText "*unclosed"

<--EOF

## Unmatched closer is demoted to InlineText

unclosed*
1
@1 InlineText "unclosed*"

<--EOF

## Underscore intraword — scan0 already demotes

Underscore inside an alphanumeric word is demoted by scan0, so the
semantic layer receives a plain InlineText and passes it through unchanged.

snake_case
1
@1 InlineText "snake_case"
