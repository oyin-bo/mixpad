*word*
12   3
@1 AsteriskDelimiter|IsSafeReparsePoint "*" CanOpen
@2 InlineText "word"
@3 AsteriskDelimiter "*" CanClose

_word_
12   3
@1 UnderscoreDelimiter|IsSafeReparsePoint "_" CanOpen
@2 InlineText "word"
@3 UnderscoreDelimiter "_" CanClose

~~word~~
1 2   3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~" CanClose

**bold**
1 2   3
@1 AsteriskDelimiter|IsSafeReparsePoint "**" CanOpen
@2 InlineText "bold"
@3 AsteriskDelimiter "**" CanClose

word*
1   2
@1 InlineText "word"
@2 AsteriskDelimiter "*" CanClose

word_
1   2
@1 InlineText "word"
@2 UnderscoreDelimiter "_" CanClose

word~~
1   2
@1 InlineText "word"
@2 TildeDelimiter "~~" CanClose

snake_case_variable
1
@1 InlineText "snake_case_variable"

word * word
1
@1 InlineText "word * word"

~single~
1
@1 InlineText "~single~"