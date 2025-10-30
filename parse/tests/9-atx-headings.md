# ATX Headings Tests

Comprehensive tests for ATX-style headings (# prefix).

## Basic Levels

Level 1
# Heading 1
1 2
@1 ATXHeadingOpen "#"
@2 InlineText "Heading 1"

Level 2
## Heading 2
1 23
@1 ATXHeadingOpen "##"
@2 InlineText "Heading 2"

Level 3
### Heading 3
1  34
@1 ATXHeadingOpen "###"
@2 InlineText "Heading 3"

Level 4
#### Heading 4
1   45
@1 ATXHeadingOpen "####"
@2 InlineText "Heading 4"

Level 5
##### Heading 5
1    56
@1 ATXHeadingOpen "#####"
@2 InlineText "Heading 5"

Level 6
###### Heading 6
1     67
@1 ATXHeadingOpen "######"
@2 InlineText "Heading 6"

## With Closing Sequences

Level 1 with closing
# Heading 1 #
1 2         34
@1 ATXHeadingOpen "#"
@2 InlineText "Heading 1"
@3 Whitespace " "
@4 ATXHeadingClose "#"

Level 2 with closing
## Heading 2 ##
1  3          45
@1 ATXHeadingOpen "##"
@2 InlineText "Heading 2"
@3 Whitespace " "
@4 ATXHeadingClose "##"

Longer closing sequence
### Heading ###########
1   4       5         6
@1 ATXHeadingOpen "###"
@2 InlineText "Heading"
@3 Whitespace " "
@4 ATXHeadingClose "###########"

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
1  234
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
123
@1 ATXHeadingOpen "##"
@2 Whitespace " "
@3 NewLine

## Edge Cases

Heading at start
# First
1 2
@1 ATXHeadingOpen "#"
@2 InlineText "First"

