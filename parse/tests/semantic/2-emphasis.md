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
12  3 4            5   6
@1 EmphasisOpen "*"
@2 InlineText "em"
@3 StrongOpen "**"
@4 InlineText "and strong"
@5 InlineText "here"
@6 EmphasisClose "*"

## Mixed: emphasis inside a sentence

Hello *world* end
1     23    4 5
@1 InlineText "Hello"
@2 EmphasisOpen "*"
@3 InlineText "world"
@4 EmphasisClose "*"
@5 InlineText "end"

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
