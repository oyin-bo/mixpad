~~deleted~~
1 2      3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "deleted"
@3 TildeDelimiter "~~"

~~start~~ text
1 2    3 4   5
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "start"
@3 TildeDelimiter "~~"
@4 Whitespace " "
@5 InlineText "text"

text ~~end~~
1   2 3   45
@1 InlineText|IsSafeReparsePoint "text"
@2 Whitespace " "
@3 TildeDelimiter "~~"
@4 InlineText "end"
@5 TildeDelimiter "~~"

~~first~~ and ~~second~~
1 2    3 4  5  67     89
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "first"
@3 TildeDelimiter "~~"
@4 Whitespace " "
@5 InlineText "and"
@6 Whitespace " "
@7 TildeDelimiter "~~"
@8 InlineText "second"
@9 TildeDelimiter "~~"

~single~
1
@1 InlineText|IsSafeReparsePoint "~single~"

text~more~text
1
@1 InlineText|IsSafeReparsePoint "text~more~text"

~~ spaced ~~
1
@1 InlineText|IsSafeReparsePoint "~~ spaced ~~"

text~~ more
1   2 3   4
@1 InlineText|IsSafeReparsePoint "text"
@2 TildeDelimiter "~~"
@3 Whitespace " "
@4 InlineText "more"

more ~~text
1   2 3   4
@1 InlineText|IsSafeReparsePoint "more"
@2 Whitespace " "
@3 TildeDelimiter "~~"
@4 InlineText "text"

~~**bold**~~
1 2 3   4 5
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 AsteriskDelimiter "**"
@3 InlineText "bold"
@4 AsteriskDelimiter "**"
@5 TildeDelimiter "~~"

~~*italic*~~
1 23     45
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 AsteriskDelimiter "*"
@3 InlineText "italic"
@4 AsteriskDelimiter "*"
@5 TildeDelimiter "~~"

**~~struck~~**
1 2 3     4 5
@1 AsteriskDelimiter|IsSafeReparsePoint "**"
@2 TildeDelimiter "~~"
@3 InlineText "struck"
@4 TildeDelimiter "~~"
@5 AsteriskDelimiter "**"

~~~~
1  2
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 TildeDelimiter "~~"

~~_text_~~
1 23   45
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 UnderscoreDelimiter "_"
@3 InlineText "text"
@4 UnderscoreDelimiter "_"
@5 TildeDelimiter "~~"

text~~del~~.
1   23   4 5
@1 InlineText|IsSafeReparsePoint "text"
@2 TildeDelimiter "~~"
@3 InlineText "del"
@4 TildeDelimiter "~~"
@5 InlineText "."

~~123~~
1 2  3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "123"
@3 TildeDelimiter "~~"

~~~text~~
1  2   3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "~text"
@3 TildeDelimiter "~~"

~~~~~
1  2 3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 TildeDelimiter "~~"
@3 InlineText "~"

~~multi
1     2
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "multi"

~~multi word~~
1 2         3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "multi word"
@3 TildeDelimiter "~~"

	~~text~~
1 2 3   4
@1 InlineText|IsSafeReparsePoint "\t"
@2 TildeDelimiter "~~"
@3 InlineText "text"
@4 TildeDelimiter "~~"

~~open
1    2
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "open"

close~~
1    2
@1 InlineText|IsSafeReparsePoint "close"
@2 TildeDelimiter "~~"

~~~text~~
1  2   3
@1 TildeDelimiter|IsSafeReparsePoint "~~"
@2 InlineText "~text"
@3 TildeDelimiter "~~"
