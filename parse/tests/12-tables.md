# GFM Table Delimiter Row Tests

Basic table delimiter with outer pipes:

| -------- | -------- |
123       4567       89
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignNone "--------"
@4 Whitespace " "
@5 TablePipe "|"
@6 Whitespace " "
@7 TableDelimiterCell AlignNone "--------"
@8 Whitespace " "
@9 TablePipe "|"

<-- EOF

## Delimiter Row without Leading Pipe

-------- | --------
1        2 3
@1 TableDelimiterCell AlignNone "--------"
@2 TablePipe "|"
@3 TableDelimiterCell AlignNone "--------"

<-- EOF

## Delimiter Row without Trailing Pipe

| -------- | --------
1 2        3
@1 TablePipe "|"
@2 TableDelimiterCell AlignNone "--------"
@3 TablePipe "|"

<-- EOF

## Left Alignment

| :--- |
1 2    3
@1 TablePipe "|"
@2 TableDelimiterCell AlignLeft ":---"
@3 TablePipe "|"

<-- EOF

## Center Alignment

| :----: |
1 2     3
@1 TablePipe "|"
@2 TableDelimiterCell AlignCenter ":----:"
@3 TablePipe "|"

<-- EOF

## Right Alignment

| ----: |
1 2    3
@1 TablePipe "|"
@2 TableDelimiterCell AlignRight "----:"
@3 TablePipe "|"

<-- EOF

## Mixed Alignments

| :--- | :----: | ----: |
1 2    3 4     5 6    7
@1 TablePipe "|"
@2 TableDelimiterCell AlignLeft ":---"
@3 TablePipe "|"
@4 TableDelimiterCell AlignCenter ":----:"
@5 TablePipe "|"
@6 TableDelimiterCell AlignRight "----:"
@7 TablePipe "|"

<-- EOF

## Minimum Three Hyphens

| --- |
1 2   3
@1 TablePipe "|"
@2 TableDelimiterCell AlignNone "---"
@3 TablePipe "|"

<-- EOF

## Many Hyphens

| ------------ |
1 2            3
@1 TablePipe "|"
@2 TableDelimiterCell AlignNone "------------"
@3 TablePipe "|"

<-- EOF

## Multiple Columns

| ---- | ---- | ---- |
1 2    3 4    5 6    7
@1 TablePipe "|"
@2 TableDelimiterCell AlignNone "----"
@3 TablePipe "|"
@4 TableDelimiterCell AlignNone "----"
@5 TablePipe "|"
@6 TableDelimiterCell AlignNone "----"
@7 TablePipe "|"

<-- EOF

## Single Column

| ------ |
1 2      3
@1 TablePipe "|"
@2 TableDelimiterCell AlignNone "------"
@3 TablePipe "|"

<-- EOF

## With Whitespace Padding

|  :-----  |  :---:  |
1  2       3  4      5
@1 TablePipe "|"
@2 TableDelimiterCell AlignLeft ":-----"
@3 TablePipe "|"
@4 TableDelimiterCell AlignCenter ":---:"
@5 TablePipe "|"

<-- EOF

## No Leading or Trailing Pipes

---- | :---: | ----:
1    2 3     4 5
@1 TableDelimiterCell AlignNone "----"
@2 TablePipe "|"
@3 TableDelimiterCell AlignCenter ":---:"
@4 TablePipe "|"
@5 TableDelimiterCell AlignRight "----:"

<-- EOF
