# Thematic Break Tests

Comprehensive tests for thematic break (horizontal rule) scanning.
Thematic breaks use ***, ---, or ___ (3+ chars, optional spaces between).

## Basic forms with asterisks

Three asterisks:

<--EOF
***
1
@1 ThematicBreak "***"

Four asterisks:

<--EOF
****
1
@1 ThematicBreak "****"

Five asterisks:

<--EOF
*****
1
@1 ThematicBreak "*****"

## Basic forms with hyphens

Three hyphens (after blank line to avoid frontmatter at position 0):

<--EOF

---
1
@1 ThematicBreak "---"

Four hyphens:

<--EOF

----
1
@1 ThematicBreak "----"

Five hyphens:

<--EOF

-----
1
@1 ThematicBreak "-----"

## Basic forms with underscores

Three underscores:

<--EOF
___
1
@1 ThematicBreak "___"

Four underscores:

<--EOF
____
1
@1 ThematicBreak "____"

## With spaces between characters

Asterisks with single spaces:

<--EOF
* * *
1
@1 ThematicBreak "* * *"

Hyphens with single spaces:

<--EOF

- - -
1
@1 ThematicBreak "- - -"

Underscores with single spaces:

<--EOF
_ _ _
1
@1 ThematicBreak "_ _ _"

Asterisks with multiple spaces:

<--EOF
*  *  *
1
@1 ThematicBreak "*  *  *"

Hyphens with multiple spaces:

<--EOF

-  -  -
1
@1 ThematicBreak "-  -  -"

Many chars with spaces:

<--EOF
* * * * *
1
@1 ThematicBreak "* * * * *"

## Indentation (up to 3 spaces allowed)

One space indent with asterisks:

<--EOF
 ***
12
@1 Whitespace " "
@2 ThematicBreak "***"

Two space indent with asterisks:

<--EOF
  ***
1 2
@1 Whitespace "  "
@2 ThematicBreak "***"

Three space indent with hyphens:

<--EOF

   ---
1  2
@1 Whitespace "   "
@2 ThematicBreak "---"

Three space indent with underscores:

<--EOF
   ___
1  2
@1 Whitespace "   "
@2 ThematicBreak "___"

## Four or more spaces: NOT a thematic break (code block indent)

Four space indent with asterisks:

<--EOF
    ***
1   23
@1 Whitespace "    "
@2 InlineText "*"
@3 AsteriskDelimiter "**"

Four space indent with underscores:

<--EOF
    ___
1   23
@1 Whitespace "    "
@2 InlineText "_"
@3 UnderscoreDelimiter "__"

## Not thematic breaks

Only two asterisks (too few):

<--EOF
**
1
@1 InlineText "*"

Only two hyphens (too few):

<--EOF

--
1
@1 InlineText "--"

Only two underscores (too few):

<--EOF
__
1
@1 InlineText "_"

Hyphens followed by text:

<--EOF

--- text
1
@1 InlineText "--- text"

Asterisks followed by text (first char only is asserted):

<--EOF
*** text
1
@1 InlineText "*"

Underscores followed by text (first char only is asserted):

<--EOF
___ text
1
@1 InlineText "_"

Mixed characters (asterisk and hyphen):

<--EOF
*-*
1
@1 AsteriskDelimiter "*"

Mixed underscore and asterisk:

<--EOF
_*_
1
@1 UnderscoreDelimiter "_"

## Thematic break vs bullet list

Asterisk thematic break is NOT a bullet list:

<--EOF
* * *
1
@1 ThematicBreak "* * *"

Asterisk bullet list is NOT a thematic break:

<--EOF
* item
1 2
@1 BulletListMarker "*"
@2 InlineText "item"

Hyphen thematic break is NOT a bullet list:

<--EOF

- - -
1
@1 ThematicBreak "- - -"

Hyphen bullet list is NOT a thematic break:

<--EOF
- item
1 2
@1 BulletListMarker "-"
@2 InlineText "item"

## Thematic break vs setext heading underline

Hyphens under text are a setext underline, not a thematic break:

<--EOF
Text line
1
@1 InlineText HeadingDepth2|IsSafeReparsePoint "Text line"
---
1
@1 SetextHeadingUnderline HeadingDepth2 "---"

Standalone hyphens (no preceding text) are a thematic break:

<--EOF

---
1
@1 ThematicBreak "---"

## Thematic break vs frontmatter

Three hyphens at absolute start of input is frontmatter, not thematic break:

<--EOF
---
1
@1 FrontmatterOpen "---\n"

Hyphens after blank line are a thematic break, not frontmatter:

<--EOF

---
1
@1 ThematicBreak "---"

## With trailing spaces

Asterisks with trailing spaces:

<--EOF
***   
1
@1 ThematicBreak "***   "

Hyphens with trailing spaces:

<--EOF

---  
1
@1 ThematicBreak "---  "
