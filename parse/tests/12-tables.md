# GFM Tables

GFM tables use pipes to separate cells and a delimiter row to define columns.

## Simple Pipe Character

A pipe character by itself:

text|more
1   23
@1 InlineText "text"
@2 TablePipe
@3 InlineText "more"

## Multiple Pipes

Multiple pipe characters:

a|b|c
12345
@1 InlineText "a"
@2 TablePipe
@3 InlineText "b"
@4 TablePipe
@5 InlineText "c"

## Pipe with Spaces

Pipe with surrounding spaces:

before | after
1     23
@1 InlineText "before"
@2 Whitespace
@3 TablePipe
