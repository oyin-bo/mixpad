# GFM Tables

GFM (GitHub Flavored Markdown) tables consist of:
1. A header row with pipe-separated cells
2. A delimiter row with pipe-separated cells containing dashes and optional colons
3. Zero or more data rows with pipe-separated cells

## Simple pipe character

A single pipe is recognized as a table pipe token:
|
1
@1 TablePipe "|"

Multiple pipes in a row:
|||
123
@1 TablePipe "|"
@2 TablePipe "|"
@3 TablePipe "|"

## Pipe in text

Pipe surrounded by text:
a|b
12
@1 InlineText "a"
@2 TablePipe "|"

Pipes with spaces:
a | b
1 2 3
@1 InlineText "a"
@2 TablePipe "|"
@3 InlineText "b"

## Header row pattern

Basic header row with pipes:
| Header 1 | Header 2 |
1          2
@1 TablePipe "|"
@2 TablePipe "|"

Header without leading pipe:
Header 1 | Header 2 |
         1
@1 TablePipe "|"

Header without trailing pipe:
| Header 1 | Header 2
1          2
@1 TablePipe "|"
@2 TablePipe "|"

## Delimiter row pattern

Simple delimiter row:
|---|---|
1   2
@1 TablePipe "|"
@2 TablePipe "|"

Delimiter with colons for alignment:
|:---|:---:|---:|
1    2     3
@1 TablePipe "|"
@2 TablePipe "|"
@3 TablePipe "|"

Delimiter with spaces:
| --- | --- |
1     2
@1 TablePipe "|"
@2 TablePipe "|"

## Complete table structure

Basic table (header + delimiter + row):
| Name | Age |
1      2
@1 TablePipe "|"
@2 TablePipe "|"

Second line (delimiter):
|------|-----|
1      2
@1 TablePipe "|"
@2 TablePipe "|"

Third line (data row):
| John | 30  |
1      2
@1 TablePipe "|"
@2 TablePipe "|"

## Edge cases

Empty cells:
||
12
@1 TablePipe "|"
@2 TablePipe "|"

Pipe at line start:
| cell
1
@1 TablePipe "|"

Pipe at line end:
cell |
     1
@1 TablePipe "|"

Multiple spaces between pipes:
|    |
1    2
@1 TablePipe "|"
@2 TablePipe "|"

## Alignment markers

Left align (default):
:---
1
@1 InlineText ":---"

Center align:
:---:
1
@1 InlineText ":---:"

Right align:
---:
1
@1 InlineText "---:"

## Not a table

Text line without proper structure:
Some regular text with no pipes
1
@1 InlineText "Some regular text with no pipes"
