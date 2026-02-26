# Formula Blocks (Display Math)

Formula blocks are delimited by `$$` similar to how code blocks use triple backticks.

## Basic double dollar formula block

$$
1
@1 FormulaOpen
E = mc^2
1
@1 FormulaContent "E = mc^2\n"
$$
1
@1 FormulaClose

## Multi-line formula

$$
1
@1 FormulaOpen
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
1
@1 FormulaContent "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n"
$$
1
@1 FormulaClose

## Single-line formula (opener and closer on different lines)

$$
1
@1 FormulaOpen
x^2 + y^2 = z^2
1
@1 FormulaContent "x^2 + y^2 = z^2\n"
$$
1
@1 FormulaClose

## Triple dollar opener and closer

$$$
1
@1 FormulaOpen
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
1
@1 FormulaContent "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n"
$$$
1
@1 FormulaClose

## Empty formula block

$$
1
@1 FormulaOpen
$$
1
@1 FormulaClose

## Content with single dollar signs

$$
1
@1 FormulaOpen
Price is $50 or $100
1
@1 FormulaContent "Price is $50 or $100\n"
$$
1
@1 FormulaClose

## Content with interior dollar run shorter than opener

$$
1
@1 FormulaOpen
Single $ here
1
@1 FormulaContent "Single $ here\n"
$$
1
@1 FormulaClose

## Closer with more dollars than opener

$$
1
@1 FormulaOpen
formula content
1
@1 FormulaContent "formula content\n"
$$$
1
@1 FormulaClose

## Multi-line with various LaTeX constructs

$$
1
@1 FormulaOpen
\begin{align}
x &= a + b \\
y &= c + d
\end{align}
1
@1 FormulaContent "\\begin{align}\nx &= a + b \\\\\ny &= c + d\n\\end{align}\n"
$$
1
@1 FormulaClose

# Edge Cases

## Single dollar - NOT a formula block

$
1
@1 InlineText "$"
not a formula block
1
@1 InlineText "not a formula block"

<--EOF

## More than 3 leading spaces - NOT a formula block

    $$
    1
    @1 InlineText "    $$"
not a formula
1
@1 InlineText "not a formula"

<--EOF

## Unclosed formula block until EOF

$$
1
@1 FormulaOpen|ErrorUnbalancedToken|IsSafeReparsePoint
formula without closer
1
@1 FormulaContent|ErrorUnbalancedToken "formula without closer\n"

<--EOF

## Dollar run not at line start is content

$$
1
@1 FormulaOpen
text $$ inline
1
@1 FormulaContent "text $$ inline\n"
$$
1
@1 FormulaClose

## Closer with insufficient length is content

$$$
1
@1 FormulaOpen
content
$$
more content
1
@1 FormulaContent "content\n$$\nmore content\n"
$$$
1
@1 FormulaClose
