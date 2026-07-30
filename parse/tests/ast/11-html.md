# HTML in the AST

## Comments assemble into a node

<!-- hi -->
12
@1 Paragraph
@2 HtmlComment

## Elements wrap their inline content

<div>x</div>
12   3
@1 Paragraph
@2 HtmlElement
@3 Text "x"
