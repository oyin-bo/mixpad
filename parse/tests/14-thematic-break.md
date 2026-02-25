# Thematic Break Tests

## Basic forms: asterisks

***
1
@1 ThematicBreak "***"

<-- EOF

## Basic forms: underscores

___
1
@1 ThematicBreak "___"

<-- EOF

## Basic forms: hyphens (not at position 0 to avoid frontmatter)

 ---
 1
@1 ThematicBreak "---"

<-- EOF

## Spaced asterisks

* * *
1
@1 ThematicBreak "* * *"

<-- EOF

## Spaced hyphens (takes priority over bullet list marker)

- - -
1
@1 ThematicBreak "- - -"

<-- EOF

## Spaced underscores

_ _ _
1
@1 ThematicBreak "_ _ _"

<-- EOF

## More than three: asterisks

*****
1
@1 ThematicBreak "*****"

<-- EOF

## More than three: hyphens (not at position 0)

 -----
 1
@1 ThematicBreak "-----"

<-- EOF

## More than three: underscores

_____
1
@1 ThematicBreak "_____"

<-- EOF

## Many spaced asterisks

* * * * *
1
@1 ThematicBreak "* * * * *"

<-- EOF

## Asterisks with more spaces between

*   *   *
1
@1 ThematicBreak "*   *   *"

<-- EOF

## Trailing spaces after thematic break

***   
1
@1 ThematicBreak "***   "

<-- EOF

## Trailing spaces after hyphens (not at position 0)

 ---   
 1
@1 ThematicBreak "---   "

<-- EOF

## Only two chars: not a thematic break

**
1
@1 InlineText IsSafeReparsePoint "*"

<-- EOF

## Only two hyphens: not a thematic break (not at position 0)

 --
 1
@1 InlineText "--"

<-- EOF

## Only two underscores: not a thematic break

__
1
@1 InlineText IsSafeReparsePoint "_"

<-- EOF

## Mixed chars: asterisk-hyphen-asterisk is not a thematic break

*-*
123
@1 AsteriskDelimiter "*"
@2 InlineText "-"
@3 AsteriskDelimiter "*"

<-- EOF

## Mixed chars: underscore-hyphen-underscore is not a thematic break

_-_
123
@1 UnderscoreDelimiter "_"
@2 InlineText "-"
@3 UnderscoreDelimiter "_"

<-- EOF

## Content after asterisks: not a thematic break

*** text
1
@1 InlineText IsSafeReparsePoint "*"

<-- EOF

## Content after hyphens: not a thematic break (not at position 0)

 --- text
 1
@1 InlineText "--- text"

<-- EOF

## One space indentation

 ***
 1
@1 ThematicBreak "***"

<-- EOF

## Two spaces indentation

  ***
  1
@1 ThematicBreak "***"

<-- EOF

## Three spaces indentation

   ***
   1
@1 ThematicBreak "***"

<-- EOF

## Four spaces indentation: code block, not thematic break

    ***
1   2
@1 Whitespace "    "
@2 InlineText "*"

<-- EOF

## Indented thematic break: leading whitespace + ThematicBreak token

   * * *
1  2
@1 Whitespace "   "
@2 ThematicBreak "* * *"

<-- EOF

## Indented underscore thematic break

   ___
1  2
@1 Whitespace "   "
@2 ThematicBreak "___"

<-- EOF

## Thematic break does not create setext heading: standalone asterisks

***
1
@1 ThematicBreak IsSafeReparsePoint "***"

<-- EOF

## Setext heading: paragraph text followed by hyphens (not a thematic break)

Some text
---
1
@1 SetextHeadingUnderline HeadingDepth2 "---"

<-- EOF

## Setext heading level 1: text followed by equals

Some text
===
1
@1 SetextHeadingUnderline HeadingDepth1 "==="

<-- EOF

## Paragraph text followed by thematic break on next line

Some text

***
1
@1 ThematicBreak "***"

<-- EOF

## Bullet list item: single dash with space (not a thematic break)

- item
1 2
@1 BulletListMarker "-"
@2 InlineText "item"

<-- EOF

## Bullet list item: asterisk with space (not a thematic break)

* item
1 2
@1 BulletListMarker "*"
@2 InlineText "item"

<-- EOF

## Hyphens in inline text position: not a thematic break

hello---world
1
@1 InlineText "hello---world"

<-- EOF

## Hyphens in inline text (with spaces around)

hello - world
1
@1 InlineText IsSafeReparsePoint "hello - world"

<-- EOF

## Tabs between delimiters

*	*	*
1
@1 ThematicBreak "*\t*\t*"

<-- EOF

## Underscore thematic break not triggering emphasis

___
1
@1 ThematicBreak "___"

<-- EOF

## Exactly three chars with spaces: still a thematic break

*  *  *
1
@1 ThematicBreak "*  *  *"

<-- EOF
