# Setext Headings Tests

Comprehensive tests for Setext-style headings (underline with = or -).

## Basic Level 1

Heading One
1
@1 InlineText "Heading One"
===========
1
@1 SetextHeadingUnderline "==========="

<-- EOF

## Basic Level 2

Heading Two
1
@1 InlineText "Heading Two"
-----------
1
@1 SetextHeadingUnderline "-----------"

<-- EOF

## With Bold

**Bold text**
1 2         3
@1 AsteriskDelimiter "**"
@2 InlineText "Bold text"
@3 AsteriskDelimiter "**"
=============
1
@1 SetextHeadingUnderline "============="

<-- EOF

## With Italic

*Italic text*
1 2          3
@1 AsteriskDelimiter "*"
@2 InlineText "Italic text"
@3 AsteriskDelimiter "*"
-------------
1
@1 SetextHeadingUnderline "-------------"

<-- EOF

## With Mixed Formatting

**Bold** and *italic*
1 2    3 4   5 6     7
@1 AsteriskDelimiter "**"
@2 InlineText "Bold"
@3 AsteriskDelimiter "**"
@4 InlineText " and "
@5 AsteriskDelimiter "*"
@6 InlineText "italic"
@7 AsteriskDelimiter "*"
=====================
1
@1 SetextHeadingUnderline "====================="

<-- EOF

## List Item Not Setext

- List item
1 2
@1 BulletListMarker "-"
@2 InlineText " List item"
===
1
@1 InlineText "==="

<-- EOF

## ATX Heading Not Setext

# ATX Heading
123
@1 ATXHeadingOpen "#"
@2 Whitespace " "
@3 InlineText "ATX Heading"
=============
1
@1 InlineText "============="

<-- EOF

## Code Block Not Setext

    Code block
1   2
@1 Whitespace "    "
@2 InlineText "Code block"
==============
1
@1 InlineText "=============="

<-- EOF

## Short Underline

Text
1
@1 InlineText "Text"
=
1
@1 SetextHeadingUnderline "="

<-- EOF

## Underline With Trailing Spaces

Text line
1
@1 InlineText "Text line"
===    
1
@1 SetextHeadingUnderline "===    "

<-- EOF

## Mixed Characters Invalid

Regular text
1
@1 InlineText "Regular text"
=-=
1
@1 InlineText "=-="

<-- EOF

## Blank Line Breaks Association

Text
1
@1 InlineText "Text"

===
1
@1 InlineText "==="

<-- EOF
