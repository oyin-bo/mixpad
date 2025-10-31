# Setext Headings Tests

Comprehensive tests for Setext-style headings (underline with = or -).

## Basic Level 1

Heading One
1
@1 InlineText HeadingDepth1|IsSafeReparsePoint "Heading One"
===========
1
@1 SetextHeadingUnderline HeadingDepth1 "==========="

<-- EOF

## Basic Level 2

Heading Two
1
@1 InlineText HeadingDepth2|IsSafeReparsePoint "Heading Two"
-----------
1
@1 SetextHeadingUnderline HeadingDepth2 "-----------"

<-- EOF

## With Bold

**Bold text**
1 2        3
@1 AsteriskDelimiter HeadingDepth1|IsSafeReparsePoint "**"
@2 InlineText HeadingDepth1 "Bold text"
@3 AsteriskDelimiter HeadingDepth1 "**"
=============
1
@1 SetextHeadingUnderline HeadingDepth1 "============="

<-- EOF

## With Italic

*Italic text*
12          3
@1 AsteriskDelimiter HeadingDepth2|IsSafeReparsePoint "*"
@2 InlineText HeadingDepth2 "Italic text"
@3 AsteriskDelimiter HeadingDepth2 "*"
-------------
1
@1 SetextHeadingUnderline HeadingDepth2 "-------------"

<-- EOF

## With Mixed Formatting

**Bold** and *italic*
1 2   3 45  678     9
@1 AsteriskDelimiter HeadingDepth1|IsSafeReparsePoint "**"
@2 InlineText HeadingDepth1 "Bold"
@3 AsteriskDelimiter HeadingDepth1 "**"
@4 Whitespace HeadingDepth1 " "
@5 InlineText HeadingDepth1 "and"
@6 Whitespace HeadingDepth1 " "
@7 AsteriskDelimiter HeadingDepth1 "*"
@8 InlineText HeadingDepth1 "italic"
@9 AsteriskDelimiter HeadingDepth1 "*"
=====================
1
@1 SetextHeadingUnderline HeadingDepth1 "====================="

<-- EOF

## List Item Not Setext

- List item
123
@1 BulletListMarker "-"
@2 Whitespace " "
@3 InlineText "List item"
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
@1 InlineText HeadingDepth1|IsSafeReparsePoint "Text"
=
1
@1 SetextHeadingUnderline HeadingDepth1 "="

<-- EOF

## Underline With Trailing Spaces

Text line
1
@1 InlineText HeadingDepth1|IsSafeReparsePoint "Text line"
===    
1
@1 SetextHeadingUnderline HeadingDepth1 "===    "

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
