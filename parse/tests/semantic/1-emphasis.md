# Emphasis resolution

The semantic scanner pairs provisional delimiter tokens (`*`, `_`, `~~`) into
`EmphasisOpen`/`EmphasisClose`, `StrongOpen`/`StrongClose`, and
`StrikethroughOpen`/`StrikethroughClose` using a stack-based algorithm
honouring the CommonMark flanking and mod-3 rules.

## Asterisk emphasis

Single asterisk — emphasis

*word*
1    2
@1 EmphasisOpen "*"
@2 EmphasisClose "*"

Double asterisk — strong

**word**
1     2
@1 StrongOpen "**"
@2 StrongClose "**"

## Tilde strikethrough

Double tilde — strikethrough

~~word~~
1     2
@1 StrikethroughOpen "~~"
@2 StrikethroughClose "~~"

## Underscore emphasis

Single underscore — emphasis

_word_
1    2
@1 EmphasisOpen "_"
@2 EmphasisClose "_"

Double underscore — strong

__word__
1     2
@1 StrongOpen "__"
@2 StrongClose "__"

## Unmatched delimiters become InlineText

Space-flanked asterisk — not a delimiter

word * word
1
@1 InlineText "word * word"

Intraword underscore — not a delimiter (both alphanumeric sides)

snake_case_variable
1
@1 InlineText "snake_case_variable"

Lone unmatched asterisk at end

word*
1
@1 InlineText "word*"

## Nested emphasis: triple asterisk

Triple asterisk wraps em around strong

***word***
1        2
@1 EmphasisOpen "*"
@2 EmphasisClose "*"

## Text before emphasis

InlineText token appears before EmphasisOpen

hello *world*
1     2
@1 InlineText "hello"
@2 EmphasisOpen "*"

InlineText token appears before StrongOpen

hello **world**
1     2
@1 InlineText "hello"
@2 StrongOpen "**"

## Emphasis content is InlineText

Inner text of emphasis

*hello*
12    3
@1 EmphasisOpen "*"
@2 InlineText "hello"
@3 EmphasisClose "*"

Inner text of strong

**hello**
1 2    3
@1 StrongOpen "**"
@2 InlineText "hello"
@3 StrongClose "**"
