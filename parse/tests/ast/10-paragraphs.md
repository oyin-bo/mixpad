# Paragraphs and Whitespace

Desired behaviour for paragraph severance and whitespace handling.

## Blank lines separate paragraphs

Alpha
12
@1 Paragraph
@2 Text "Alpha"

Beta
12
@1 Paragraph
@2 Text "Beta"

## Soft-wrapped lines stay one paragraph

Gamma
12
@1 Paragraph
@2 Text "Gamma\nDelta"
Delta

## Trailing spaces are dropped

Epsilon   
12
@1 Paragraph
@2 Text "Epsilon"
