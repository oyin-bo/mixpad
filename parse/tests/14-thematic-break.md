# Thematic Break Tests

Comprehensive tests for thematic break scanning (horizontal rules).

## Basic dash thematic break

<--EOF

---
1
@1 ThematicBreak "---"

<--EOF

----
1
@1 ThematicBreak "----"

<--EOF

-----------
1
@1 ThematicBreak "-----------"

## Basic asterisk thematic break

<--EOF
***
1
@1 ThematicBreak "***"

<--EOF
****
1
@1 ThematicBreak "****"

<--EOF
*****
1
@1 ThematicBreak "*****"

## Basic underscore thematic break

<--EOF
___
1
@1 ThematicBreak "___"

<--EOF
____
1
@1 ThematicBreak "____"

<--EOF
___________
1
@1 ThematicBreak "___________"

## Spaces between delimiters

<--EOF
- - -
1
@1 ThematicBreak "- - -"

<--EOF
* * *
1
@1 ThematicBreak "* * *"

<--EOF
_ _ _
1
@1 ThematicBreak "_ _ _"

<--EOF
- - - -
1
@1 ThematicBreak "- - - -"

<--EOF
* * * *
1
@1 ThematicBreak "* * * *"

<--EOF
-  -  -
1
@1 ThematicBreak "-  -  -"

<--EOF
*   *   *
1
@1 ThematicBreak "*   *   *"

<--EOF
_ _ _ _
1
@1 ThematicBreak "_ _ _ _"

## Trailing spaces

<--EOF

---   
1
@1 ThematicBreak "---   "

<--EOF
***   
1
@1 ThematicBreak "***   "

<--EOF
___   
1
@1 ThematicBreak "___   "

<--EOF
- - -   
1
@1 ThematicBreak "- - -   "

## Indentation up to 3 spaces is allowed

<--EOF
 ---
12
@1 Whitespace " "
@2 ThematicBreak "---"

<--EOF
  ---
1 2
@1 Whitespace "  "
@2 ThematicBreak "---"

<--EOF
   ---
1  2
@1 Whitespace "   "
@2 ThematicBreak "---"

<--EOF
 ***
12
@1 Whitespace " "
@2 ThematicBreak "***"

<--EOF
   ___
1  2
@1 Whitespace "   "
@2 ThematicBreak "___"

## 4-space indent is NOT a thematic break

<--EOF
    ---
1   2
@1 Whitespace "    "
@2 InlineText "---"

<--EOF
    ***
1   2
@1 Whitespace "    "
@2 InlineText "*"

<--EOF
    ___
1   2
@1 Whitespace "    "
@2 InlineText "_"

## Invalid: fewer than 3 delimiter chars

<--EOF
--
1
@1 InlineText "--"

<--EOF
_ _
1
@1 InlineText "_ _"

## Invalid: other content on line (thematic break fails, whole line becomes InlineText)

<--EOF

--- text
1
@1 InlineText "--- text"

<--EOF

--- title
1
@1 InlineText "--- title"

<--EOF
_ _ _ word
1
@1 InlineText "_ _ _ word"

## Thematic break does not fire mid-line (after other text the delimiters are merged into inline text)

<--EOF
text ---
1
@1 InlineText "text ---"

<--EOF
text * * *
1
@1 InlineText "text * * *"

## Thematic break after blank line

<--EOF
Some paragraph
1
@1 InlineText "Some paragraph"

<--EOF


---
1
@1 ThematicBreak IsSafeReparsePoint "---"

## Thematic break does not become setext underline (setext wins for line preceded by text)

<--EOF
Text
1
@1 InlineText HeadingDepth2|IsSafeReparsePoint "Text"
---
1
@1 SetextHeadingUnderline HeadingDepth2 "---"

<--EOF
Heading
1
@1 InlineText HeadingDepth1|IsSafeReparsePoint "Heading"
===
1
@1 SetextHeadingUnderline HeadingDepth1 "==="

## Standalone --- after blank line is a thematic break, not setext

<--EOF


---
1
@1 ThematicBreak IsSafeReparsePoint "---"

## Thematic break next to list items

<--EOF
- item
1 2
@1 BulletListMarker "-"
@2 InlineText "item"

<--EOF
- - -
1
@1 ThematicBreak "- - -"

<--EOF
* item
1 2
@1 BulletListMarker "*"
@2 InlineText "item"

<--EOF
***
1
@1 ThematicBreak "***"
