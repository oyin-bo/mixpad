# ATX Headings Tests

Comprehensive tests for ATX-style headings (# prefix).

## Basic Levels

Level 1
# Heading 1
1 2
@1 Heading level=1
@2 Text "Heading 1"

Level 2
## Heading 2
1  2
@1 Heading level=2
@2 Text "Heading 2"

Level 3
### Heading 3
1   2
@1 Heading level=3
@2 Text "Heading 3"

Level 4
#### Heading 4
1    2
@1 Heading level=4
@2 Text "Heading 4"

Level 5
##### Heading 5
1     2
@1 Heading level=5
@2 Text "Heading 5"

Level 6
###### Heading 6
1      2
@1 Heading level=6
@2 Text "Heading 6"

## With Closing Sequences

Level 1 with closing
# Heading 1 #
1 2
@1 Heading level=1
@2 Text "Heading 1"

Level 2 with closing
## Heading 2 ##
1  2
@1 Heading level=2
@2 Text "Heading 2"

Longer closing sequence
### Heading ###########
1   2
@1 Heading level=3
@2 Text "Heading"


## Invalid Cases

Seven hashes (not a heading)
####### Not a heading
1
@1 Text "####### Not a heading"

No space after hash
##NoSpace
1
@1 Text "##NoSpace"

## Indentation

Valid: up to 3 spaces
   ## Heading
   1  2
@1 Heading level=2
@2 Text "Heading"

## Empty Headings

Empty heading
##
1
@1 Heading level=1

Empty with space
## 
1
@1 Heading level=2
