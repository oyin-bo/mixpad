# Formula Blocks

This test file verifies the parsing of formula/math blocks delimited by double dollar signs ($$).

## Basic Block Formulas

Simple block formula
$$
1
@1 FormulaBlockOpen
E = mc^2
1
@1 FormulaBlockContent "E = mc^2\n"
$$
1
@1 FormulaBlockClose

Block formula with multiple lines
$$
1
@1 FormulaBlockOpen
\int_a^b f(x) dx
1
@1 FormulaBlockContent "\\int_a^b f(x) dx\n= F(b) - F(a)\n"
= F(b) - F(a)
$$
1
@1 FormulaBlockClose

## Display Math (Single Line)

Display math on one line
$$E = mc^2$$
1 2       3
@1 FormulaBlockOpen
@2 FormulaBlockContent "E = mc^2"
@3 FormulaBlockClose

Display math with spaces
$$ x + y = z $$
1 2          3
@1 FormulaBlockOpen
@2 FormulaBlockContent " x + y = z "
@3 FormulaBlockClose

## Empty Formulas

Empty block formula
$$
1
@1 FormulaBlockOpen
$$
1
@1 FormulaBlockClose

Empty display math
$$$$
1  2
@1 FormulaBlockOpen
@2 FormulaBlockClose

## Complex LaTeX Content

Greek letters and symbols
$$
1
@1 FormulaBlockOpen
\alpha + \beta = \gamma
1
@1 FormulaBlockContent "\\alpha + \\beta = \\gamma\n"
$$
1
@1 FormulaBlockClose

Fraction and superscript
$$
1
@1 FormulaBlockOpen
\frac{a^2 + b^2}{c^2}
1
@1 FormulaBlockContent "\\frac{a^2 + b^2}{c^2}\n"
$$
1
@1 FormulaBlockClose

Matrix notation
$$
1
@1 FormulaBlockOpen
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
1
@1 FormulaBlockContent "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n"
$$
1
@1 FormulaBlockClose

## Formulas with Dollar Signs in Content

Formula with single dollar in content (block mode)
$$
1
@1 FormulaBlockOpen
Price: $100
1
@1 FormulaBlockContent "Price: $100\n"
$$
1
@1 FormulaBlockClose

Display math with single dollar in content
$$Cost = $50$$
1 2         3
@1 FormulaBlockOpen
@2 FormulaBlockContent "Cost = $50"
@3 FormulaBlockClose

## Leading Spaces

Formula with one leading space
 $$
 1
 @1 FormulaBlockOpen
x = 1
1
@1 FormulaBlockContent "x = 1\n"
 $$
 1
 @1 FormulaBlockClose

Formula with three leading spaces
   $$
   1
   @1 FormulaBlockOpen
y = 2
1
@1 FormulaBlockContent "y = 2\n"
   $$
   1
   @1 FormulaBlockClose

## Edge Cases with Three Dollar Signs

Three dollars at start (opener is $$, content starts with $)
$$$
1
@1 FormulaBlockOpen
content$
1
@1 FormulaBlockContent "$\ncontent$\n"
$$
1
@1 FormulaBlockClose

## Formulas at Document Boundaries

Formula at start of document (test is first in file conceptually)
$$
1
@1 FormulaBlockOpen
x = 0
1
@1 FormulaBlockContent "x = 0\n"
$$
1
@1 FormulaBlockClose

## Special Characters and Escaping

Formula with backslashes
$$
1
@1 FormulaBlockOpen
\\text{Hello World}
1
@1 FormulaBlockContent "\\\\text{Hello World}\n"
$$
1
@1 FormulaBlockClose

Formula with braces and brackets
$$
1
@1 FormulaBlockOpen
\{x | x > 0\}
1
@1 FormulaBlockContent "\\{x | x > 0\\}\n"
$$
1
@1 FormulaBlockClose

Formula with underscores
$$
1
@1 FormulaBlockOpen
a_1 + a_2 = a_{1+2}
1
@1 FormulaBlockContent "a_1 + a_2 = a_{1+2}\n"
$$
1
@1 FormulaBlockClose

## Mixed Content Before and After

Text before formula
$$
1
@1 FormulaBlockOpen
x = y
1
@1 FormulaBlockContent "x = y\n"
$$
1
@1 FormulaBlockClose
Text after
1
@1 InlineText "Text after"

## Whitespace Preservation

Formula with leading spaces in content
$$
1
@1 FormulaBlockOpen
  x = 1
1
@1 FormulaBlockContent "  x = 1\n"
$$
1
@1 FormulaBlockClose

Formula with trailing spaces in content
$$
1
@1 FormulaBlockOpen
x = 1   
1
@1 FormulaBlockContent "x = 1   \n"
$$
1
@1 FormulaBlockClose

## Multiline Complex Formula

Full equation with alignment
$$
1
@1 FormulaBlockOpen
\begin{align}
1
@1 FormulaBlockContent "\\begin{align}\nx &= y + z \\\\\ny &= a + b\n\\end{align}\n"
x &= y + z \\
y &= a + b
\end{align}
$$
1
@1 FormulaBlockClose
