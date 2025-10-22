# Heading 1
1
@1 ATXHeadingOpen "#"
@2 InlineText " Heading 1"

## Heading 2
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading 2"

### Heading 3
1
@1 ATXHeadingOpen "###"
@2 InlineText " Heading 3"

#### Heading 4
1
@1 ATXHeadingOpen "####"
@2 InlineText " Heading 4"

##### Heading 5
1
@1 ATXHeadingOpen "#####"
@2 InlineText " Heading 5"

###### Heading 6
1
@1 ATXHeadingOpen "######"
@2 InlineText " Heading 6"

# Heading 1 #
1
@1 ATXHeadingOpen "#"
@2 InlineText " Heading 1 "
@3 ATXHeadingClose "#"

## Heading 2 ##
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading 2 "
@3 ATXHeadingClose "##"

### Heading 3 #####
1
@1 ATXHeadingOpen "###"
@2 InlineText " Heading 3 "
@3 ATXHeadingClose "#####"

##
1
@1 ATXHeadingOpen "##"

##   
1
@1 ATXHeadingOpen "##"
@2 InlineText "   "

####### Too many
1
@1 InlineText "####### Too many"

##NoSpace
1
@1 InlineText "##NoSpace"

 ## Valid
12 3
@1 Whitespace " "
@2 ATXHeadingOpen "##"
@3 InlineText " Valid"

   ## Valid
1  23
@1 Whitespace "   "
@2 ATXHeadingOpen "##"
@3 InlineText " Valid"

    ## Not heading
1   2
@1 Whitespace "    "
@2 InlineText "## Not heading"

## **Bold** heading
1
@1 ATXHeadingOpen "##"
@2 InlineText " "
@3 AsteriskDelimiter "**"
@4 InlineText "Bold"
@5 AsteriskDelimiter "**"
@6 InlineText " heading"

# Heading with `code` inside
1
@1 ATXHeadingOpen "#"
@2 InlineText " Heading with "
@3 BacktickBoundary "`"
@4 InlineCode "code"
@5 BacktickBoundary "`"
@6 InlineText " inside"

## Heading &amp; entity
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading "
@3 EntityNamed "&amp;"
@4 InlineText " entity"

### Heading with \# escaped
1
@1 ATXHeadingOpen "###"
@2 InlineText " Heading with "
@3 Escaped "\\#"
@4 InlineText " escaped"

## Heading # with hash ## in middle
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading # with hash ## in middle"

## Heading## 
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading##"

## Heading ##
1
@1 ATXHeadingOpen "##"
@2 InlineText " Heading "
@3 ATXHeadingClose "##"

Heading 1
1
@1 InlineText "Heading 1"

=========
1
@1 SetextHeadingUnderline "========="

Text
1
@1 InlineText "Text"

=
1
@1 SetextHeadingUnderline "="

Heading
1
@1 InlineText "Heading"

================================================================================
1
@1 SetextHeadingUnderline "================================================================================"

Heading 2
1
@1 InlineText "Heading 2"

---------
1
@1 SetextHeadingUnderline "---------"

Text
1
@1 InlineText "Text"

-
1
@1 SetextHeadingUnderline "-"

**Bold** heading
1      2        3
@1 AsteriskDelimiter "**"
@2 InlineText "Bold"
@3 AsteriskDelimiter "**"
@4 InlineText " heading"

================
1
@1 SetextHeadingUnderline "================"

Heading with `code`
1               2  3
@1 InlineText "Heading with "
@2 BacktickBoundary "`"
@3 InlineCode "code"
@4 BacktickBoundary "`"

===================
1
@1 SetextHeadingUnderline "==================="

Text
1
@1 InlineText "Text"

 ===
123
@1 Whitespace " "
@2 SetextHeadingUnderline "==="

Text
1
@1 InlineText "Text"

   ===
1  2
@1 Whitespace "   "
@2 SetextHeadingUnderline "==="

Text

===
1   2
@1 InlineText "Text"
@2 NewLine "\n"
@3 InlineText "==="

Text
1
@1 InlineText "Text"

=-=
1
@1 InlineText "=-="

    Code
1   2
@1 Whitespace "    "
@2 InlineText "Code"

    ====
1   2
@1 Whitespace "    "
@2 InlineText "===="

Text
1
@1 InlineText "Text"

=== extra
1
@1 InlineText "=== extra"

# ATX Heading

Setext
1      2
@1 InlineText "Setext"

======
1
@1 SetextHeadingUnderline "======"

## First
12
@1 ATXHeadingOpen "##"
@2 InlineText " First"

### Second
12
@1 ATXHeadingOpen "###"
@2 InlineText " Second"

# First heading
12
@1 ATXHeadingOpen "#"
@2 InlineText " First heading"
<-- EOF

## Last heading<-- EOF
12
@1 ATXHeadingOpen "##"
@2 InlineText " Last heading"

Text
1
@1 InlineText "Text"

===<-- EOF
1
@1 SetextHeadingUnderline "==="
