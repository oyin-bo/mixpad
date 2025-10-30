# Setext Headings Tests

Comprehensive tests for Setext-style headings (underline with = or -).

## Basic Setext Headings

Level 1 with equals
Heading One
1
@1 InlineText "Heading One"
===========
1
@1 SetextHeadingUnderline "==========="

Level 2 with dashes  
Heading Two
1
@1 InlineText "Heading Two"
-----------
1
@1 SetextHeadingUnderline "-----------"

## With Inline Formatting

Bold in Setext heading
**Bold text**
123
@1 AsteriskDelimiter "**"
@2 InlineText "Bold text"
@3 AsteriskDelimiter "**"
=============
1
@1 SetextHeadingUnderline "============="

Italic in Setext heading
*Italic text*
123
@1 AsteriskDelimiter "*"
@2 InlineText "Italic text"
@3 AsteriskDelimiter "*"
-------------
1
@1 SetextHeadingUnderline "-------------"

Mixed formatting
**Bold** and *italic*
123     4   567
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

## Invalid Cases - Block Constructs

List item cannot be Setext
- List item
12
@1 BulletListMarker "-"
@2 InlineText " List item"
===
1
@1 InlineText "==="

ATX heading cannot be Setext
# ATX Heading
123
@1 ATXHeadingOpen "#"
@2 Whitespace " "
@3 InlineText "ATX Heading"
=============
1
@1 InlineText "============="

<-- EOF

Code block (4+ spaces)
    Code block
1   2
@1 Whitespace "    "
@2 InlineText "Code block"
==============
1
@1 InlineText "=============="

<-- EOF

## Edge Cases

Short underline still valid
Text
1
@1 InlineText "Text"
=
1
@1 SetextHeadingUnderline "="

<-- EOF

Underline with trailing spaces
Text line
1
@1 InlineText "Text line"
===    
1
@1 SetextHeadingUnderline "===    "

<-- EOF

Mixed characters not valid underline
Regular text
1
@1 InlineText "Regular text"
=-=
1
@1 InlineText "=-="

<-- EOF

Blank line breaks association
Text
1
@1 InlineText "Text"

===
1
@1 InlineText "==="

<-- EOF
