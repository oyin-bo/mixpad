# Malformed Syntax Run Recovery Tests

Tests for recovery heuristics across all HTML/XML constructs as specified in `9-html-elements.md`.

## HTML Comments

Double newline recovery
<!-- unclosed comment
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed comment\n"


<-- EOF

HTML comment on double new line recovery - content then normal parsing
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\n"

More
3    4
@3 NewLine
@4 InlineText "More"
<-- EOF

HTML comment on new line - no recovery (single newline)
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\nMore"
More
<-- EOF

HTML comment recovery at < on new line
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\n"

<div>
3   4     5
@3 HTMLTagOpen
@4 HTMLTagName "div"
@5 HTMLTagClose
<-- EOF

HTML comment no recovery - < not on new line
<!-- unclosed <div>
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed <div>"
<-- EOF

HTML comment properly closed - no error
<!-- comment -->
1   2          3
@1 HTMLCommentOpen
@2 HTMLCommentContent " comment "
@3 HTMLCommentClose
<-- EOF

## XML Processing Instructions

Newline recovery - content stops before newline
<?xml unclosed
1    2   3        4
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " unclosed"
@4 NewLine
<-- EOF

< recovery - content stops before <
<?xml unclosed
1    2   3        4   5
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " unclosed\n"
@4 HTMLTagOpen
@5 HTMLTagName "div"

<div
<-- EOF

> malformed close recovery - emits malformed close token
<?xml unclosed >
1    2   3        4
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " unclosed "
@4 XMLProcessingInstructionClose|ErrorUnbalancedToken
<-- EOF

XML PI properly closed - no error
<?xml version="1.0"?>
1    2   3              4
@1 XMLProcessingInstructionOpen
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " version=\"1.0\""
@4 XMLProcessingInstructionClose
<-- EOF

XML PI to EOF - no recovery point found
<?xml unclosed
1    2   3
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " unclosed"
<-- EOF

## CDATA Sections

Double newline recovery - content includes first newline
<![CDATA[ unclosed
1        2          3
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent " unclosed\n"
@3 NewLine

<-- EOF

< recovery - content includes newline, < not consumed
<![CDATA[ unclosed
1        2          3
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent " unclosed\n"
@3 InlineText "<"

<
<-- EOF

> malformed close recovery - emits malformed close token
<![CDATA[ unclosed >
1        2          3
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent " unclosed "
@3 HTMLCDataClose|ErrorUnbalancedToken
<-- EOF

CDATA properly closed - no error
<![CDATA[ data ]]>
1        2       3
@1 HTMLCDataOpen
@2 HTMLCDataContent " data "
@3 HTMLCDataClose
<-- EOF

CDATA to EOF - no recovery point found
<![CDATA[ unclosed
1        2
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent " unclosed"
<-- EOF

## DOCTYPE

Newline recovery - content stops before newline
<!DOCTYPE unclosed
1        2          3
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
@2 HTMLDocTypeContent " unclosed"
@3 NewLine
<-- EOF

< recovery - content stops before <
<!DOCTYPE unclosed
1        2          3
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
@2 HTMLDocTypeContent " unclosed"
@3 NewLine
@4 InlineText "<"

<
<-- EOF

DOCTYPE properly closed - no error
<!DOCTYPE html>
1        2     3
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent " html"
@3 HTMLDocTypeClose
<-- EOF

DOCTYPE to EOF - no recovery point found
<!DOCTYPE html
1        2
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
@2 HTMLDocTypeContent " html"
<-- EOF

## Opening Tags

Double newline recovery - whitespace includes both newlines
<div attr="value"
1   2    3   4    5          6
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote

<-- EOF

< recovery during attributes - whitespace before <
<div attr="value"
1   2    3   4    5          6      7  8
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "value"
@8 HTMLAttributeQuote

<
<-- EOF

Opening tag properly closed - no error
<div attr="value">
1   2    3   4    5          6      7  8
@1 HTMLTagOpen
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "value"
@8 HTMLAttributeQuote
<-- EOF

Opening tag to EOF - no recovery point found
<div attr="value"
1   2    3   4    5          6      7
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "value"
<-- EOF

## Quoted Attribute Values

Double newline in quoted value - first newline as Whitespace, second as NewLine
<div attr="unclosed
1   2    3   4    5          6        7  8
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "unclosed"
@8 Whitespace

<-- EOF

< in quoted value - recovery at <
<div attr="unclosed
1   2    3   4    5          6        7  8  9
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "unclosed"
@8 Whitespace
@9 InlineText "<"

<
<-- EOF

> in quoted value - recovery at >
<div attr="unclosed
1   2    3   4    5          6        7  8
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "unclosed"
@8 Whitespace

>
<-- EOF

EOF in quoted value - no synthetic quote, no recovery point
<div attr="unclosed
1   2    3   4    5          6        7
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "unclosed"
<-- EOF

Properly quoted attribute value - no error
<div attr="value">
1   2    3   4    5          6     7  8
@1 HTMLTagOpen
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "attr"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "value"
@8 HTMLAttributeQuote
<-- EOF

## Raw Text Elements

Double newline recovery in script - content includes first newline
<script>
1      2
@1 HTMLTagOpen
@2 HTMLTagName "script"

unclosed
3       4
@3 HTMLTagClose
@4 HTMLRawText "\nunclosed\n"

<-- EOF

< recovery in style - content includes newline, < not consumed
<style>
1     2
@1 HTMLTagOpen
@2 HTMLTagName "style"

unclosed
3       4  5
@3 HTMLTagClose
@4 HTMLRawText "\nunclosed\n"
@5 InlineText "<"

<
<-- EOF

Script properly closed - no error
<script>code</script>
1      2    3       4  5      6       7
@1 HTMLTagOpen
@2 HTMLTagName "script"
@3 HTMLTagClose
@4 HTMLRawText "code"
@5 HTMLTagOpen
@6 HTMLTagName "script"
@7 HTMLTagClose
<-- EOF

Textarea properly closed - no error
<textarea>text</textarea>
1        2        3       4   5      6        7
@1 HTMLTagOpen
@2 HTMLTagName "textarea"
@3 HTMLTagClose
@4 HTMLRawText "text"
@5 HTMLTagOpen
@6 HTMLTagName "textarea"
@7 HTMLTagClose
<-- EOF

Script to EOF - no recovery point found, opening tag marked
<script>unclosed
1      2    3       4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "script"
@3 HTMLTagClose
@4 HTMLRawText "unclosed"
<-- EOF

## Edge Cases

Self-closing tag - no error
<br/>
1  2 3
@1 HTMLTagOpen
@2 HTMLTagName "br"
@3 HTMLTagSelfClosing
<-- EOF

Properly closed tag - no error
<div>content</div>
1   2    3       4  5      6   7
@1 HTMLTagOpen
@2 HTMLTagName "div"
@3 HTMLTagClose
@4 InlineText "content"
@5 HTMLTagOpen
@6 HTMLTagName "div"
@7 HTMLTagClose
<-- EOF

Opening tag with multiple attributes to EOF - no recovery, marked as error
<div a="1" b="2" c
1   2    3 4 5  6  7 8 9  A  B  C  D  E F
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLAttributeName "a"
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue "1"
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName "b"
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue "2"
@E HTMLAttributeQuote
@F Whitespace
<-- EOF

Closing tag with newline before > - error flagged
</div
1   2    3       4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 Whitespace
@4 HTMLTagClose|ErrorUnbalancedToken

>
<-- EOF
