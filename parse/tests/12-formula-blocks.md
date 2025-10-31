# Formula Blocks (Display Math)

## Basic double dollar sign formula block

$$
1
@1 FormulaBlockOpen
E = mc^2
1
@1 FormulaBlockContent "E = mc^2\n"
$$
1
@1 FormulaBlockClose

## Triple dollar sign formula block

$$$
1
@1 FormulaBlockOpen
\int_0^1 x^2 dx
1
@1 FormulaBlockContent "\\int_0^1 x^2 dx\n"
$$$
1
@1 FormulaBlockClose

## Multi-line formula

$$
1
@1 FormulaBlockOpen
\begin{equation}
E = mc^2
\end{equation}
1
@1 FormulaBlockContent "\\begin{equation}\nE = mc^2\n\\end{equation}\n"
$$
1
@1 FormulaBlockClose

## Formula with longer closing delimiter

$$
1
@1 FormulaBlockOpen
x + y = z
1
@1 FormulaBlockContent "x + y = z\n"
$$$
1
@1 FormulaBlockClose

## Formula block with leading spaces (up to 3)

  $$
1 2
@1 Whitespace "  "
@2 FormulaBlockOpen
  a^2 + b^2 = c^2
1
@1 FormulaBlockContent "  a^2 + b^2 = c^2\n"
  $$
1
@1 FormulaBlockClose

## Formula content with dollar signs not at line start

$$
1
@1 FormulaBlockOpen
cost is $5 or $$10
1
@1 FormulaBlockContent "cost is $5 or $$10\n"
$$
1
@1 FormulaBlockClose

## Single dollar sign - NOT a formula block

$
1
@1 InlineText

$x = 1$
1
@1 InlineText

<--EOF

## Closer with shorter run than opener - NOT a closer (unclosed)

$$$
1
@1 FormulaBlockOpen|ErrorUnbalancedToken|IsSafeReparsePoint
content here
$$

<--EOF

## Quadruple dollar sign block

$$$$
1
@1 FormulaBlockOpen
nested $$$ formula
1
@1 FormulaBlockContent "nested $$$ formula\n"
$$$$
1
@1 FormulaBlockClose

## Empty formula block

$$
1
@1 FormulaBlockOpen
$$
1
@1 FormulaBlockClose
