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

~~basic strikethrough~~
1 2                  3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "basic strikethrough"
@3 TildeDelimiter "~~" CanClose

~~multiple words here~~
1 2                  3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "multiple words here"
@3 TildeDelimiter "~~" CanClose

text ~~strikethrough~~ more
1   23 4            5 67
@1 InlineText|IsSafeReparsePoint "text"
@2 Whitespace " "
@3 TildeDelimiter "~~" CanOpen
@4 InlineText "strikethrough"
@5 TildeDelimiter "~~" CanClose
@6 Whitespace " "
@7 InlineText "more"

text~~right flanking
1   2
@1 InlineText "text"
@2 TildeDelimiter "~~" CanClose

~~left flanking~~text
1 2            3 4
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "left flanking"
@3 TildeDelimiter "~~" CanClose
@4 InlineText "text"

~~one~~ and ~~two~~
1 2  3 45  67 8  9
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "one"
@3 TildeDelimiter "~~" CanClose
@4 Whitespace " "
@5 InlineText "and"
@6 Whitespace " "
@7 TildeDelimiter "~~" CanOpen
@8 InlineText "two"
@9 TildeDelimiter "~~" CanClose

~~no closing
1 2
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "no closing"

no opening~~
1         2
@1 InlineText "no opening"
@2 TildeDelimiter "~~" CanClose

~only one~
1
@1 InlineText "~only one~"

~~a~
1 2
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "a~"

~a~~
1 2
@1 InlineText "~a"
@2 TildeDelimiter "~~" CanClose