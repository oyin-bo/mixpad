# Table Tests

## Basic table pipes

Simple pipe character:
|
1
@1 TablePipe

Pipe at start of line:
| header
1 2
@1 TablePipe
@2 InlineText "header"

Multiple pipes:
| a | b |
1 2 3 4 5
@1 TablePipe
@2 InlineText "a"
@3 TablePipe
@4 InlineText "b"
@5 TablePipe

## Delimiter cells with colons

Left-aligned delimiter cell:
:---
1
@1 TableDelimiterCell

Center-aligned delimiter cell:
:---:
1
@1 TableDelimiterCell

Right-aligned delimiter cell:
---:
1
@1 TableDelimiterCell

Delimiter with more hyphens:
:-------
1
@1 TableDelimiterCell

Center with more hyphens:
:-------:
1
@1 TableDelimiterCell

Right with more hyphens:
-------:
1
@1 TableDelimiterCell

## Delimiter row with pipes

Left aligned with pipes:
| :--- |
1 2    3
@1 TablePipe
@2 TableDelimiterCell
@3 TablePipe

Center aligned with pipes:
| :---: |
1 2     3
@1 TablePipe
@2 TableDelimiterCell
@3 TablePipe

Right aligned with pipes:
| ---: |
1 2    3
@1 TablePipe
@2 TableDelimiterCell
@3 TablePipe

Multiple delimiter cells:
| :--- | :---: | ---: |
1 2    3 4     5 6    7
@1 TablePipe
@2 TableDelimiterCell
@3 TablePipe
@4 TableDelimiterCell
@5 TablePipe
@6 TableDelimiterCell
@7 TablePipe

Delimiter without outer pipes:
:--- | :---: | ---:
1    2 3     4 5
@1 TableDelimiterCell
@2 TablePipe
@3 TableDelimiterCell
@4 TablePipe
@5 TableDelimiterCell

## Table with inline content

Table cell with entity:
| &amp; |
1 2     3
@1 TablePipe
@2 EntityNamed
@3 TablePipe

Table cell with escaped pipe:
| a\| |
1 23  4
@1 TablePipe
@2 InlineText "a"
@3 Escaped
@4 TablePipe

Spaces around pipes:
  |  header  |
1 2  3       4
@1 Whitespace "  "
@2 TablePipe "|"
@3 InlineText "header"
@4 TablePipe "|"
