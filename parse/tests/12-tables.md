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

## Minimum dash requirement

Too few dashes - single dash (invalid):
| - |
1
@1 TablePipe "|"

Too few dashes - two dashes (invalid):
| -- |
1
@1 TablePipe "|"

Valid - three dashes (minimum required):
| --- |
1
@1 TablePipe "|"

Valid - more than three dashes:
| ----- |
1
@1 TablePipe "|"

## Pipe requirement validation

Inline dashes without pipes:
abc - def
1
@1 InlineText "abc - def"

Inline dashes without pipes (two dashes):
abc -- def
1
@1 InlineText "abc -- def"

Inline dashes without pipes (three dashes):
abc --- def
1
@1 InlineText "abc --- def"

Single pipe with dashes (valid table delimiter):
--- | ---
1   2
@1 InlineText "---"
@2 TablePipe "|"

## Indentation limits

Too much indentation - 4 spaces (code block, not table):
    | --- | --- |
1   2
@1 Whitespace "    "
@2 TablePipe "|"

Valid indentation - 3 spaces:
   | --- | --- |
1  2
@1 Whitespace "   "
@2 TablePipe "|"

Valid indentation - 2 spaces:
  | --- | --- |
1 2
@1 Whitespace "  "
@2 TablePipe "|"

Valid indentation - 1 space:
 | --- | --- |
12
@1 Whitespace " "
@2 TablePipe "|"

No indentation (valid):
| --- | --- |
1
@1 TablePipe "|"

## Not a table

Text line without proper structure:
Some regular text with no pipes
1
@1 InlineText "Some regular text with no pipes"
