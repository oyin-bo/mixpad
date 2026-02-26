# Semantic Emphasis Resolution

Tests for the semantic phase: emphasis pairing, text coalescing, and pass-through.

## Plain text passes through unchanged

hello world
1
@1 InlineText "hello world"

<--EOF

## Basic emphasis

*word*
12   3
@1 EmphasisOpen "*"
@2 InlineText "word"
@3 EmphasisClose "*"

<--EOF

## Basic strong

**bold**
1 2   3
@1 StrongOpen "**"
@2 InlineText "bold"
@3 StrongClose "**"

<--EOF

## Strikethrough

~~word~~
1 2   3
@1 StrikethroughOpen "~~"
@2 InlineText "word"
@3 StrikethroughClose "~~"

<--EOF

## Unmatched opener becomes plain text

*unmatched
1
@1 InlineText "*unmatched"

<--EOF

## Unmatched closer becomes plain text

unmatched*
1
@1 InlineText "unmatched*"

<--EOF

## Intraword underscore is plain text

snake_case
1
@1 InlineText "snake_case"

<--EOF

## Emphasis with spaces: emphasized text

*bold text*
12        3
@1 EmphasisOpen "*"
@2 InlineText "bold text"
@3 EmphasisClose "*"

<--EOF

## Strong with spaces: hello world

**hello world**
1 2          3
@1 StrongOpen "**"
@2 InlineText "hello world"
@3 StrongClose "**"

<--EOF

## Text adjacent to emphasis: foo-bar-baz

foo *bar* baz
    12  3 4
@1 EmphasisOpen "*"
@2 InlineText "bar"
@3 EmphasisClose "*"
@4 InlineText "baz"

<--EOF

## Emphasis followed by trailing text

*word* end
12   3 4
@1 EmphasisOpen "*"
@2 InlineText "word"
@3 EmphasisClose "*"
@4 InlineText "end"

<--EOF

## Nested emphasis

*foo **bar** baz*
1    2 3  4     5
@1 EmphasisOpen "*"
@2 StrongOpen "**"
@3 InlineText "bar"
@4 StrongClose "**"
@5 EmphasisClose "*"
