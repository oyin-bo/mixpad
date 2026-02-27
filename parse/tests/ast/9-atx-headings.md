# ATX Headings Tests

Comprehensive tests for ATX-style headings (# prefix).

## Basic Levels

Level 1
# Heading 1
1
@1 AtxHeadingNode getLevel=1 > TextNode text=" Heading 1\n"

Level 2
## Heading 2
1
@1 AtxHeadingNode getLevel=2 > TextNode text=" Heading 2\n"

Level 3
### Heading 3
1
@1 AtxHeadingNode getLevel=3 > TextNode text=" Heading 3\n"

Level 4
#### Heading 4
1
@1 AtxHeadingNode getLevel=4 > TextNode text=" Heading 4\n"

Level 5
##### Heading 5
1
@1 AtxHeadingNode getLevel=5 > TextNode text=" Heading 5\n"

Level 6
###### Heading 6
1
@1 AtxHeadingNode getLevel=6 > TextNode text=" Heading 6\n"

## With Closing Sequences

Level 1 with closing
# Heading 1 #
1
@1 AtxHeadingNode getLevel=1 > TextNode text=" Heading 1 "

Level 2 with closing
## Heading 2 ##
1 
@1 AtxHeadingNode getLevel=2 > TextNode text=" Heading 2 "

Longer closing sequence
### Heading ###########
1  
@1 AtxHeadingNode getLevel=3 > TextNode text=" Heading "

## Invalid Cases

Seven hashes (not a heading)
####### Not a heading
1
@1 TextNode text="####### Not a heading"

No space after hash
##NoSpace
1
@1 TextNode text="##NoSpace"

## Indentation

Valid: up to 3 spaces
   ## Heading
1  2 
@2 AtxHeadingNode getLevel=2 > TextNode text=" Heading\n"

## Empty Headings

Empty heading
##
1
@1 AtxHeadingNode getLevel=2 > TextNode text="\n"

Empty with space
## 
1 
@1 AtxHeadingNode getLevel=2 > TextNode text=" \n"

## Edge Cases

Heading at start
# First
1
@1 AtxHeadingNode getLevel=1 > TextNode text=" First\n"
