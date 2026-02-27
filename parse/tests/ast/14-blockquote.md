# Blockquote Tests

## Basic blockquote markers

Blockquote with space after marker:
> text
1
@1 BlockquoteNode > TextNode

Blockquote without space (CommonMark allows `>text`):
>text
1
@1 BlockquoteNode > TextNode

Empty blockquote marker:
>
1
@1 BlockquoteNode

## Indented blockquote markers

One space before marker:
 > text
 1
@1 BlockquoteNode > TextNode

Three spaces before marker (maximum allowed):
   > text
   1
@1 BlockquoteNode > TextNode

Four spaces disqualifies blockquote (treated as code block indentation):        
    > text
    1
@1 TextNode text="> text"

## Nested blockquotes

Double nested without space:
>> text
1
@1 BlockquoteNode > BlockquoteNode > TextNode

Double nested with space between markers:
> > text
1
@1 BlockquoteNode > BlockquoteNode > TextNode

Triple nested:
>>> text
1
@1 BlockquoteNode > BlockquoteNode > BlockquoteNode > TextNode

## Not blockquote markers

Greater-than in the middle of text:
a > b
1
@1 TextNode text="a > b"

Greater-than with non-space before it:
text>more
1
@1 TextNode text="text>more"

## Blockquote with inline content

Blockquote with emphasis delimiter:
> *em*
1
@1 BlockquoteNode > EmphasisNode > TextNode
