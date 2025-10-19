# Malformed Syntax Run Recovery Tests

Tests for recovery heuristics across all HTML/XML constructs as specified in `9-html-elements.md`.

## HTML Comments

XML comment on double new line recovery
<!-- unclosed
1   2        3
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent|ErrorUnbalancedToken " unclosed"
@3 NewLine

More
@1 InlineText "More"
<-- EOF

XML comment on new line - no recovery
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\nMore"
More
<-- EOF

## XML Processing Instructions

Newline recovery
<?xml unclosed
1    2
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionContent|ErrorUnbalancedToken " unclosed"
<-- EOF

XML instruction: no recovery
<?xml unclosed <-- EOF
1    2
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionContent|ErrorUnbalancedToken " unclosed "

> malformed close recovery
<?xml unclosed >
1    2         3
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionContent " unclosed "
@3 XMLProcessingInstructionClose|ErrorUnbalancedToken

<-- EOF

## CDATA Sections

Double newline recovery
<![CDATA[ unclosed
1        2
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent|ErrorUnbalancedToken " unclosed"

After

After
1
@1 InlineText "After"

<-- EOF

< recovery
<![CDATA[ unclosed
1        2
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent|ErrorUnbalancedToken " unclosed"
<
1
@1 HTMLTagOpen
<-- EOF

> malformed close recovery
<![CDATA[ unclosed >
1        2         3
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent|ErrorUnbalancedToken " unclosed "
@3 HTMLCDataClose|ErrorUnbalancedToken

<-- EOF

## DOCTYPE

Newline recovery
<!DOCTYPE unclosed
1        2
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
@2 HTMLDocTypeContent|ErrorUnbalancedToken " unclosed"

After
1
@1 InlineText "After"
<-- EOF

< recovery
<!DOCTYPE unclosed
1        2
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
@2 HTMLDocTypeContent|ErrorUnbalancedToken " unclosed"
<
1
@1 HTMLTagOpen
<-- EOF

## Opening Tags

Double newline recovery (basic)
<div attr="value"
12   3     4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 HTMLAttributeName "attr"
@4 HTMLAttributeValue "value"
<-- EOF

< recovery during attributes
<div attr="value" <
12   3    4       5
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 HTMLAttributeName "attr"
@4 HTMLAttributeQuote "\""
@5 HTMLTagOpen
<-- EOF

## Quoted Attribute Values

Double newline in quoted value
<div attr="unclosed
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

< in quoted value
<div attr="unclosed<
12   3    4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 HTMLAttributeName "attr"
@4 HTMLAttributeQuote "\""
<-- EOF

> in quoted value
<div attr="unclosed >
12   3    4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 HTMLAttributeName "attr"
@4 HTMLAttributeQuote "\""
<-- EOF

EOF in quoted value (no synthetic quote)
<div attr="unclosed
12   3    4
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName "div"
@3 HTMLAttributeName "attr"
@4 HTMLAttributeQuote "\""
<-- EOF

## Raw Text Elements

Double newline recovery in script
<script>
unclosed
1
@1 HTMLRawText
<-- EOF

< recovery in style (not closing tag)
<style>
unclosed
1
@1 HTMLRawText
<-- EOF

## Edge Cases

Self-closing tag (should not error)
<br/>
12 3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagSelfClosing

Properly closed tag (should not error)
<div>content</div>
12  34      5 6
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
<-- EOF

EOF with incomplete attribute (no value)
<div a="1" b="2" c
12  34 56 7 8    9
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 HTMLTagName
@3 Whitespace " "
@4 HTMLAttributeName "a"
@5 HTMLAttributeQuote "\""
@6 HTMLAttributeValue "1"
@7 Whitespace " "
@8 HTMLAttributeEquals "="
@9 HTMLAttributeName
<-- EOF

Closing tag with newline before > (error)
</div
>
12
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 NewLine "\n"
<-- EOF
