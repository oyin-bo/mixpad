# Thematic Break Tests

Thematic breaks (horizontal rules) use ***, ---, or ___ (3+ chars of the same delimiter,
optional spaces between, up to 3 spaces indent, no other content on the line).

Three asterisks:
***
1
@1 ThematicBreak "***"

Five asterisks:
*****
1
@1 ThematicBreak "*****"

Three underscores:
___
1
@1 ThematicBreak "___"

Five underscores:
_____
1
@1 ThematicBreak "_____"

Three hyphens (not at position 0, so not frontmatter):
 ---
12
@1 Whitespace " "
@2 ThematicBreak "---"

Five hyphens (indented to avoid frontmatter):
 -----
12
@1 Whitespace " "
@2 ThematicBreak "-----"

Spaced asterisks (* * *):
* * *
1
@1 ThematicBreak "* * *"

Spaced hyphens (- - -):
 - - -
12
@1 Whitespace " "
@2 ThematicBreak "- - -"

Spaced underscores (_ _ _):
_ _ _
1
@1 ThematicBreak "_ _ _"

Multiple spaces between delimiters:
*   *   *
1
@1 ThematicBreak "*   *   *"

Tabs between delimiters:
*	*	*
1
@1 ThematicBreak "*\t*\t*"

Trailing spaces after thematic break:
***   
1
@1 ThematicBreak "***   "

Trailing spaces after underscores:
___   
1
@1 ThematicBreak "___   "

One space indent with asterisks:
 ***
12
@1 Whitespace " "
@2 ThematicBreak "***"

Two space indent with asterisks:
  ***
1 2
@1 Whitespace "  "
@2 ThematicBreak "***"

Three space indent with underscores:
   ___
1  2
@1 Whitespace "   "
@2 ThematicBreak "___"

Only two asterisks — not a thematic break:
**
1
@1 InlineText "*"

Only two underscores — not a thematic break:
__
1
@1 InlineText "_"

Only two hyphens — not a thematic break:
 --
12
@1 Whitespace " "
@2 InlineText "--"

Content after asterisks disqualifies thematic break (* * * text):
* * * text
1
@1 BulletListMarker "*"

Content after hyphens disqualifies thematic break (--- text):
 --- text
12
@1 Whitespace " "
@2 InlineText "--- text"

Hyphens mid-line (after other text) are not a thematic break:
hello---world
1
@1 InlineText "hello---world"

Asterisk bullet list (single asterisk with space — not thematic break):
* item
1 2
@1 BulletListMarker "*"
@2 InlineText "item"

Hyphen bullet list (single hyphen with space — not thematic break):
- item
1 2
@1 BulletListMarker "-"
@2 InlineText "item"

Mixed characters are not a thematic break (*-*):
*-*
1
@1 AsteriskDelimiter "*"

Mixed underscores and hyphens (_-_):
_-_
1
@1 UnderscoreDelimiter "_"

Setext heading underline (--- after text): hyphens under text are SetextHeadingUnderline not ThematicBreak:
Some text
---
1
@1 SetextHeadingUnderline HeadingDepth2 "---"

<-- EOF

Setext heading level 1 (=== after text):
Another heading
===
1
@1 SetextHeadingUnderline HeadingDepth1 "==="
