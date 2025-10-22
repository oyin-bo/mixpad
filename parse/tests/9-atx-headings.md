# ATX Headings Tests

Comprehensive tests for ATX-style headings (# prefix).

## Basic Levels

Level 1
# Heading 1
12
@1 ATXHeadingOpen "#"
@2 InlineText "Heading 1"

Level 2
## Heading 2
12 3
@1 ATXHeadingOpen "##"
@2 Whitespace " "
@3 InlineText "Heading 2"

Level 3
### Heading 3
12  3
@1 ATXHeadingOpen "###"
@2 Whitespace " "
@3 InlineText "Heading 3"

Level 4
#### Heading 4
12   3
@1 ATXHeadingOpen "####"
@2 Whitespace " "
@3 InlineText "Heading 4"

Level 5
##### Heading 5
12    3
@1 ATXHeadingOpen "#####"
@2 Whitespace " "
@3 InlineText "Heading 5"

Level 6
###### Heading 6
12     3
@1 ATXHeadingOpen "######"
@2 Whitespace " "
@3 InlineText "Heading 6"

## With Closing Sequences

Level 1 with closing
# Heading 1 #
12          3
@1 ATXHeadingOpen "#"
@2 InlineText "Heading 1"
@3 ATXHeadingClose "#"

Level 2 with closing
## Heading 2 ##
12 3          45
@1 ATXHeadingOpen "##"
@2 Whitespace " "
@3 InlineText "Heading 2"
@4 Whitespace " "
@5 ATXHeadingClose "##"

Longer closing sequence
### Heading ###########
12  3       4         5
@1 ATXHeadingOpen "###"
@2 Whitespace " "
@3 InlineText "Heading"
@4 Whitespace " "
@5 ATXHeadingClose "###########"

## Invalid Cases

Seven hashes (not a heading)
####### Not a heading
1
@1 InlineText "####### Not a heading"

No space after hash
##NoSpace
1
@1 InlineText "##NoSpace"

## Indentation

Valid: up to 3 spaces
   ## Heading
1  23 4
@1 Whitespace "   "
@2 ATXHeadingOpen "##"
@3 Whitespace " "
@4 InlineText "Heading"

## Empty Headings

Empty heading
##
12
@1 ATXHeadingOpen "##"
@2 NewLine

Empty with space
## 
12 3
@1 ATXHeadingOpen "##"
@2 Whitespace " "
@3 NewLine

## Edge Cases

Heading at start
# First
12
@1 ATXHeadingOpen "#"
@2 InlineText "First"

