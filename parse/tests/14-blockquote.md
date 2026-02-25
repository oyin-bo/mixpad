# Blockquote Tests

## Basic blockquote marker

Blockquote with space:
> text
1 2
@1 BlockquoteMarker "> "
@2 InlineText "text"

Blockquote without space (CommonMark allows >text):
>text
12
@1 BlockquoteMarker ">"
@2 InlineText "text"

Empty blockquote marker followed by newline:
>
1
@1 BlockquoteMarker ">"

## Indentation

Valid: 1 space indent
 > item
12 3
@1 Whitespace " "
@2 BlockquoteMarker "> "
@3 InlineText "item"

Valid: 3 spaces indent
   > item
1  2 3
@1 Whitespace "   "
@2 BlockquoteMarker "> "
@3 InlineText "item"

Invalid: 4 spaces indent (code block, not blockquote)
    > item
1   2
@1 Whitespace "    "
@2 InlineText "> item"

## Nested blockquotes (scan0 perspective)

Nested markers, no space between them:
>> text
12
@1 BlockquoteMarker ">"
@2 InlineText "> text"

Nested markers with space:
> > text
1 2
@1 BlockquoteMarker "> "
@2 InlineText "> text"

## Multi-line blockquote

Multiple consecutive blockquote lines (last line tested):
> line 1
> line 2
1 2
@1 BlockquoteMarker "> "
@2 InlineText "line 2"

## Inline context (> not at line start is plain text)

> in middle is not a blockquote
text > more
1
@1 InlineText "text > more"

## Blockquote followed by inline content

Blockquote with emphasis content:
> *em*
1 2
@1 BlockquoteMarker "> "
@2 AsteriskDelimiter "*"
