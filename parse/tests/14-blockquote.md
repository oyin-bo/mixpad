# Blockquote Tests

## Basic blockquote markers

Blockquote with space after marker:
> text
1 2
@1 BlockquoteMarker ">"
@2 InlineText "text"

Blockquote without space (CommonMark allows `>text`):
>text
12
@1 BlockquoteMarker ">"
@2 InlineText "text"

Empty blockquote marker:
>
1
@1 BlockquoteMarker ">"

## Indented blockquote markers

One space before marker:
 > text
12 3
@1 Whitespace " "
@2 BlockquoteMarker ">"
@3 InlineText "text"

Three spaces before marker (maximum allowed):
   > text
1  2 3
@1 Whitespace "   "
@2 BlockquoteMarker ">"
@3 InlineText "text"

Four spaces disqualifies blockquote (treated as code block indentation):
    > text
1   2
@1 Whitespace "    "
@2 InlineText "> text"

## Nested blockquotes

Double nested without space:
>> text
12 3
@1 BlockquoteMarker ">"
@2 BlockquoteMarker ">"
@3 InlineText "text"

Double nested with space between markers:
> > text
123 4
@1 BlockquoteMarker ">"
@2 Whitespace " "
@3 BlockquoteMarker ">"
@4 InlineText "text"

Triple nested:
>>> text
123 4
@1 BlockquoteMarker ">"
@2 BlockquoteMarker ">"
@3 BlockquoteMarker ">"
@4 InlineText "text"

## Not blockquote markers

Greater-than in the middle of text:
a > b
1
@1 InlineText "a > b"

Greater-than with non-space before it:
text>more
1
@1 InlineText "text>more"

## Blockquote with inline content

Blockquote with emphasis delimiter:
> *em*
1 2
@1 BlockquoteMarker ">"
@2 AsteriskDelimiter "*"
