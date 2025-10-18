# Malformed Syntax Run Recovery Tests

Tests for recovery heuristics across all HTML/XML constructs as specified in `9-html-elements.md`.

## HTML Comments

Double newline recovery
<!-- unclosed comment
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent|ErrorUnbalancedToken " unclosed comment\n\n"

<-- EOF

XML comment on new line recovery (with whitespace)
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\n\n"

More
<-- EOF

XML comment on new line recovery (no whitespace)
<!-- unclosed
1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed\n"
More
<-- EOF

## XML Processing Instructions

Newline recovery
<?xml unclosed
1
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
<-- EOF

< recovery
<?xml unclosed <-- EOF
1
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken

> malformed close recovery
<?xml unclosed >
1    2         3
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
@2 XMLProcessingInstructionTarget
@3 XMLProcessingInstructionClose|ErrorUnbalancedToken
<-- EOF

## CDATA Sections

Double newline recovery
<![CDATA[ unclosed
1        2
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent " unclosed\n\n"
<-- EOF

< recovery
<![CDATA[ unclosed
1
@1 HTMLCDataOpen|ErrorUnbalancedToken
<-- EOF

> malformed close recovery
<![CDATA[ unclosed >
1        2         3
@1 HTMLCDataOpen|ErrorUnbalancedToken
@2 HTMLCDataContent
@3 HTMLCDataClose|ErrorUnbalancedToken
<-- EOF

## DOCTYPE

Newline recovery
<!DOCTYPE unclosed
1
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
<-- EOF

< recovery
<!DOCTYPE unclosed
1
@1 HTMLDocTypeOpen|ErrorUnbalancedToken
<-- EOF

## Opening Tags

Double newline recovery (basic)
<div attr="value"
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

< recovery during attributes
<div attr="value" other
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

## Quoted Attribute Values

Double newline in quoted value
<div attr="unclosed
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

< in quoted value
<div attr="unclosed
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

> in quoted value
<div attr="unclosed >
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

EOF in quoted value (no synthetic quote)
<div attr="unclosed
1
@1 HTMLTagOpen|ErrorUnbalancedToken
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
<div a="1" b="2" c
1
@1 HTMLTagOpen|ErrorUnbalancedToken
<-- EOF

Closing tag with newline before > (error)
</div
>
12
@1 HTMLTagOpen|ErrorUnbalancedToken
@2 NewLine
<-- EOF
