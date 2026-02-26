# Semantic Emphasis Resolution

The semantic scanner pairs provisional delimiter tokens from `scan0` and emits
EmphasisOpen/Close, StrongOpen/Close, StrikethroughOpen/Close, or demotes
unmatched delimiters to plain InlineText.

## Fully paired emphasis in one section

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

_word_
12   3
@1 EmphasisOpen "_"
@2 InlineText "word"
@3 EmphasisClose "_"

__bold__
1 2   3
@1 StrongOpen "__"
@2 InlineText "bold"
@3 StrongClose "__"

~~strike~~
1 2     3
@1 StrikethroughOpen "~~"
@2 InlineText "strike"
@3 StrikethroughClose "~~"

Space-flanked asterisk is plain text (scan0 demotes via scanInlineText merge):
word * word
1
@1 InlineText "word * word"

Intraword underscores are plain text (scan0 demotes intraword underscore):
snake_case_var
1
@1 InlineText "snake_case_var"

<--EOF

## Multiple separate emphasis spans in one line

*one* and *two*
12  3     45  6
@1 EmphasisOpen "*"
@2 InlineText "one"
@3 EmphasisClose "*"
@4 EmphasisOpen "*"
@5 InlineText "two"
@6 EmphasisClose "*"

<--EOF

## Emphasis with surrounding punctuation

(*word*)
12    34
@1 InlineText "("
@2 EmphasisOpen "*"
@3 EmphasisClose "*"
@4 InlineText ")"

<--EOF

## Underscore between punctuation can open and close

._word_.
12    34
@1 InlineText "."
@2 EmphasisOpen "_"
@3 EmphasisClose "_"
@4 InlineText "."

<--EOF

## Unmatched opener becomes plain text (isolated section)

*word
1
@1 InlineText "*word"

<--EOF

## Unmatched closer becomes plain text (isolated section)

word*
1
@1 InlineText "word*"

<--EOF

## Emphasis inside a longer sentence

hello *world* end
1     23    4
@1 InlineText "hello"
@2 EmphasisOpen "*"
@3 InlineText "world"
@4 EmphasisClose "*"

<--EOF

## Strong emphasis inside a longer sentence

This is **important** text.
1       2 3        4  5
@1 InlineText "This is"
@2 StrongOpen "**"
@3 InlineText "important"
@4 StrongClose "**"
@5 InlineText "text."
