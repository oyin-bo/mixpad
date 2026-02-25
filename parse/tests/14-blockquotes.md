# Blockquote Tests

## Basic blockquote marker

Simple blockquote with space:
> quoted text
1 2
@1 BlockquoteMarker ">"
@2 InlineText "quoted text"

Blockquote without trailing space (CommonMark allows >text):
>text
1
@1 BlockquoteMarker ">"

Blockquote with no content:
>
1
@1 BlockquoteMarker ">"

## Indentation before >

One space indent:
 > quoted
 1 2
@1 BlockquoteMarker ">"
@2 InlineText "quoted"

Two spaces indent:
  > quoted
  1 2
@1 BlockquoteMarker ">"
@2 InlineText "quoted"

Three spaces indent (max allowed):
   > quoted
   1 2
@1 BlockquoteMarker ">"
@2 InlineText "quoted"

Four spaces indent (code block, not blockquote):
    > not a blockquote
1   2
@1 Whitespace "    "
@2 InlineText "> not a blockquote"

## Nested blockquotes

Double blockquote: first > is marker, second > becomes inline text at scan0 level:
> > nested
1 2
@1 BlockquoteMarker ">"
@2 InlineText "> nested"

Triple blockquote: only outermost > is a marker at scan0 level:
> > > deep
1 2
@1 BlockquoteMarker ">"
@2 InlineText "> > deep"

## Elements inside blockquotes

At scan0 level, content after > marker is inline text (semantic layer handles nesting):

Blockquote containing hash — scanned as inline text after marker:
> # Heading
1 2
@1 BlockquoteMarker ">"
@2 InlineText "# Heading"

Blockquote containing dash — scanned as inline text after marker:
> - item
1 2
@1 BlockquoteMarker ">"
@2 InlineText "- item"

Blockquote containing ordered list start — scanned as inline text after marker:
> 1. item
1 2
@1 BlockquoteMarker ">"
@2 InlineText "1. item"

## Not a blockquote

Greater-than in middle of line (inline text):
some > text
1
@1 InlineText "some > text"

Greater-than preceded by non-space:
a> text
1
@1 InlineText "a> text"
