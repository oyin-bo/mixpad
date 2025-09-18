# Inline code with backticks

Simple `backtick` code.
1      23       456
@1 InlineText
@2 BacktickBoundary
@3 InlineCode "backtick"
@4 BacktickBoundary
@5 Whitespace
@6 InlineText

Multiple backticks: ``back`tick``.
1                   2 3        4 5
@1 InlineText
@2 BacktickBoundary
@3 InlineCode "back`tick"
@4 BacktickBoundary
@5 InlineText
