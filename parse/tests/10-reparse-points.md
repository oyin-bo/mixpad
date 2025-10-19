# Safe Reparse Points

Tests for the IsSafeReparsePoint flag as specified in `12-scan0-reparse-points.md`.

## File Start

The first token at offset 0 should have the IsSafeReparsePoint flag.

First token
1
@1 InlineText|IsSafeReparsePoint "First token"

<--EOF

## Blank Line Creates Reparse Point

After a blank line, the first token on the next line should have the flag.

Some text

After blank
1
@1 InlineText|IsSafeReparsePoint "After blank"

<--EOF

## Multiple Tokens After Blank

Only the first token after a blank line gets the flag, not subsequent tokens.

Before

After blank &amp; here
1           2     3
@1 InlineText|IsSafeReparsePoint "After blank"
@2 EntityNamed
@3 InlineText "here"

<--EOF

## Single Newline - No Reparse Point

A single newline (no blank line) should NOT create a reparse point.

Line one
Line two
1
@1 InlineText "Line two"

<--EOF

## Multiple Consecutive Blank Lines

Multiple blank lines also create reparse points.

First

Second


Third
1
@1 InlineText|IsSafeReparsePoint "Third"

<--EOF

## Whitespace-only Line

A line with only whitespace also creates a blank line.

Before
  
After whitespace-only line
1
@1 InlineText|IsSafeReparsePoint "After whitespace-only line"
