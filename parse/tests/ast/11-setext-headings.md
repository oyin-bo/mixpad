# Setext Headings Tests

Comprehensive tests for Setext-style headings (underline with = or -).

## Basic Level 1

Heading One
1
TextNode text="Heading One"
===========
1
@1 SetextHeadingNode getLevel=1

<-- EOF

## Basic Level 2

Heading Two
1
TextNode text="Heading Two"
-----------
1
@1 SetextHeadingNode getLevel=2

<-- EOF

## With Bold

**Bold text**
1 2        3
@1 StrongNode
 TextNode text="Bold text"
@3 StrongNode
=============
1
@1 SetextHeadingNode getLevel=1

<-- EOF

## With Italic

*Italic text*
12          3
@1 EmphasisNode
 TextNode text="Italic text"
@3 EmphasisNode
-------------
1
@1 SetextHeadingNode getLevel=2

<-- EOF

## With Mixed Formatting

**Bold** and *italic*
1 2   3 45  678     9
@1 StrongNode
 TextNode text="Bold"
@3 StrongNode
@4 TextNode
@5 TextNode text="and"
@6 TextNode
@7 EmphasisNode
@8 TextNode text="italic"
@9 EmphasisNode
=====================
1
@1 SetextHeadingNode getLevel=1

<-- EOF

## List Item Not Setext

- List item
123
@1 ListItemNode
 
@3 TextNode text="List item"
===
1
TextNode text="==="

<-- EOF

## ATX Heading Not Setext

# ATX Heading
123
@1 AtxHeadingNode
 
@3 TextNode text="ATX Heading"
=============
1
TextNode

<-- EOF

## Code Block Not Setext

    Code block
1   2
TextNode
 
==============
1
TextNode

<-- EOF

## Short Underline

Text
1
TextNode text="Text"
=
1
@1 SetextHeadingNode getLevel=1

<-- EOF

## Underline With Trailing Spaces

Text line
1
TextNode text="Text line"
===    
1
@1 SetextHeadingNode getLevel=1

<-- EOF

## Mixed Characters Invalid

Regular text
1
TextNode text="Regular text"
=-=
1
TextNode text="=-="

<-- EOF

## Blank Line Breaks Association

Text
1
TextNode text="Text"

===
1
TextNode text="==="

<-- EOF
