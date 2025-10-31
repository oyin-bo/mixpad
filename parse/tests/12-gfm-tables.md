# GFM Table Tests

## Basic delimiter rows

Simple delimiter with pipes:
| --- | --- |
1
@1 TableDelimiterRow

Delimiter without leading pipe:
--- | ---
1
@1 TableDelimiterRow

Delimiter without trailing pipe:
| --- | ---
1
@1 TableDelimiterRow

Three columns:
| --- | --- | --- |
1
@1 TableDelimiterRow

Single column with pipes:
| --- |
1
@1 TableDelimiterRow

## Alignment indicators

Left-aligned (explicit):
| :--- |
1
@1 TableDelimiterRow

Center-aligned:
| :---: |
1
@1 TableDelimiterRow

Right-aligned:
| ---: |
1
@1 TableDelimiterRow

Mixed alignment:
| :--- | :---: | ---: |
1
@1 TableDelimiterRow

Multiple columns with various alignments:
:--- | :---: | ---: | ---
1
@1 TableDelimiterRow

## Whitespace variations

Extra spaces around pipes:
|   ---   |   ---   |
1
@1 TableDelimiterRow

Tabs instead of spaces:
|	---	|	---	|
1
@1 TableDelimiterRow

No spaces:
|---|---|
1
@1 TableDelimiterRow

Leading whitespace (1 space):
 | --- | --- |
12
@1 Whitespace
@2 TableDelimiterRow

Leading whitespace (3 spaces):
   | --- | --- |
1  2
@1 Whitespace
@2 TableDelimiterRow

## Dash count variations

Minimum dashes (one per column):
| - | - |
1
@1 TableDelimiterRow

Many dashes:
| ---------- | ---------- |
1
@1 TableDelimiterRow

Mixed dash counts:
| --- | - | ---------- |
1
@1 TableDelimiterRow

## Alignment with varying dash counts

Left with many dashes:
| :---------- |
1
@1 TableDelimiterRow

Center with few dashes:
| :-: |
1
@1 TableDelimiterRow

Right with medium dashes:
| -----: |
1
@1 TableDelimiterRow

## Non-delimiter cases

Too much indentation (4 spaces):
    | --- | --- |
1   2
@1 Whitespace
@2 InlineText

No dashes:
| | |
1
@1 InlineText

Only pipes:
|||
1
@1 InlineText

Mixed with text:
| --- | text |
1
@1 InlineText

Dashes without pipes:
--- text ---
1
@1 InlineText

Single pipe, no dashes:
|
1
@1 InlineText

Colons without dashes:
| : | : |
1
@1 InlineText

EOF
