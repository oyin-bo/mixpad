# GFM Table Delimiter Row Tests

Basic delimiter with outer pipes:

| -------- | -------- |
123       4567       89A
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignNone "--------"
@4 Whitespace " "
@5 TablePipe "|"
@6 Whitespace " "
@7 TableDelimiterCell AlignNone "--------"
@8 Whitespace " "
@9 TablePipe "|"
@A NewLine "\n"

<-- EOF

Left alignment:

| :--- |
123   45
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignLeft ":---"
@4 Whitespace " "
@5 TablePipe "|"

<-- EOF

Center alignment:

| :----: |
123     45
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignCenter ":----:"
@4 Whitespace " "
@5 TablePipe "|"

<-- EOF

Right alignment:

| ----: |
123    45
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignRight "----:"
@4 Whitespace " "
@5 TablePipe "|"

<-- EOF

Minimum three hyphens:

| --- |
123  45
@1 TablePipe "|"
@2 Whitespace " "
@3 TableDelimiterCell AlignNone "---"
@4 Whitespace " "
@5 TablePipe "|"

<-- EOF
