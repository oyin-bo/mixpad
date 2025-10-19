# Safe Reparse Points

This document tests the safe reparse point functionality.

## Basic Tests

Start of file should be a safe reparse point (offset 0).
1
@1 InlineText|IsSafeReparsePoint

Text on first line
1
@1 InlineText

After newline comes text on second line - no reparse point
1
@1 InlineText

Blank line above creates reparse point
1
@1 InlineText|IsSafeReparsePoint

Two paragraphs

separated by blank line - second paragraph starts with reparse point
1
@1 InlineText|IsSafeReparsePoint

Multiple blank lines


still create reparse point
1
@1 InlineText|IsSafeReparsePoint

Whitespace on blank line  

also creates reparse point
1
@1 InlineText|IsSafeReparsePoint

## Error Recovery Tests

<!-- unclosed comment

After unclosed comment, no reparse point even after blank line
1
@1 InlineText

<--EOF

Normal text after EOF marker

should get reparse point
1
@1 InlineText|IsSafeReparsePoint

