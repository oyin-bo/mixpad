# Inline code with backticks

Simple `backtick` code.
1      23       456
@1 TextNode text="Simple"
@2 InlineCodeNode text="`"
@3 InlineCodeNode text="backtick"
@4 InlineCodeNode text="`"
@5 TextNode text=" "
@6 TextNode text="code."

Multiple backticks: ``back`tick``.
1                   2 3        4 5
@1 TextNode text="Multiple backticks:"
@2 InlineCodeNode text="``"
@3 InlineCodeNode text="back`tick"
@4 InlineCodeNode text="``"
@5 TextNode text="."
