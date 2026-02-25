# Blockquote Tests

## Basic blockquote markers

Simple blockquote with space after marker:
> hello
1 2
@1 BlockquoteMarker "> "
@2 InlineText "hello"

Simple blockquote without space (CommonMark allows `>text`):
>hello
12
@1 BlockquoteMarker ">"
@2 InlineText "hello"

Blockquote with multi-word content:
> some text here
1 2
@1 BlockquoteMarker "> "
@2 InlineText "some text here"

## Indented blockquote markers

One space before marker:
 > hello
 1 2
@1 BlockquoteMarker "> "
@2 InlineText "hello"

Two spaces before marker:
  > hello
  1 2
@1 BlockquoteMarker "> "
@2 InlineText "hello"

Three spaces before marker (maximum allowed):
   > hello
   1 2
@1 BlockquoteMarker "> "
@2 InlineText "hello"

Four spaces disqualifies blockquote (treated as code block indentation):
    > hello
1   2
@1 Whitespace "    "
@2 InlineText "> hello"

## Nested blockquotes

Double nested without spaces:
>> hello
12 3
@1 BlockquoteMarker ">"
@2 BlockquoteMarker "> "
@3 InlineText "hello"

Double nested with space between markers:
> > hello
1 2 3
@1 BlockquoteMarker "> "
@2 BlockquoteMarker "> "
@3 InlineText "hello"

Triple nested:
>>> hello
123 4
@1 BlockquoteMarker ">"
@2 BlockquoteMarker ">"
@3 BlockquoteMarker "> "
@4 InlineText "hello"

## Not blockquote markers

Greater-than in the middle of text is not a blockquote marker:
a > b
1
@1 InlineText "a > b"

Greater-than preceded by non-space is not a blockquote marker:
text>more
1
@1 InlineText "text>more"

## Empty and minimal blockquotes

Blockquote marker alone on line:
>
1
@1 BlockquoteMarker ">"

## Multi-line blockquotes

First line of multi-line blockquote:
> line one
1 2
@1 BlockquoteMarker "> "
@2 InlineText "line one"

Second line continues (re-scan starting fresh):
> line two
1 2
@1 BlockquoteMarker "> "
@2 InlineText "line two"

## Blockquote with inline content

Blockquote with emphasis delimiter:
> *bold*
1 2
@1 BlockquoteMarker "> "
@2 AsteriskDelimiter "*"

Blockquote containing a bullet list marker:
> - item
1 2
@1 BlockquoteMarker "> "
@2 InlineText "- item"

Blockquote containing hash (heading marker falls through at scan0 level):
> # heading
1 2
@1 BlockquoteMarker "> "
@2 InlineText "# heading"

## Interaction with surrounding tokens

Blockquote after a blank line:
 
> quote
1
@1 BlockquoteMarker "> "
