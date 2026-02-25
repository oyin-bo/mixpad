# Link and Image Scan Tests

## Individual token types

Open bracket alone:
[
1
@1 LinkOpen "["

Close bracket alone:
]
1
@1 LinkClose "]"

Open destination paren alone:
(
1
@1 LinkDestOpen "("

Close destination paren alone:
)
1
@1 LinkDestClose ")"

Image marker with following bracket:
![
12
@1 ImageMarker "!"
@2 LinkOpen "["

## Inline text interactions

Exclamation not followed by bracket:
!text
1
@1 InlineText "!text"

Exclamation at end of input:
!
1
@1 InlineText "!"

Double exclamation:
!!
1
@1 InlineText "!!"

Exclamation in middle of word:
hello!world
1
@1 InlineText "hello!world"

Exclamation followed by open paren (not bracket):
!(
12
@1 InlineText "!"
@2 LinkDestOpen "("

## Bracket adjacent to text

Open bracket after text:
text[
1   2
@1 InlineText "text"
@2 LinkOpen "["

Close bracket after text:
text]
1   2
@1 InlineText "text"
@2 LinkClose "]"

Brackets wrapping text:
[text]
12   3
@1 LinkOpen "["
@2 InlineText "text"
@3 LinkClose "]"

Text before open bracket:
abc[def
1  23
@1 InlineText "abc"
@2 LinkOpen "["
@3 InlineText "def"

Text after close bracket:
abc]def
1  23
@1 InlineText "abc"
@2 LinkClose "]"
@3 InlineText "def"

## Paren adjacent to text

Open paren after text:
text(
1   2
@1 InlineText "text"
@2 LinkDestOpen "("

Close paren after text:
text)
1   2
@1 InlineText "text"
@2 LinkDestClose ")"

Parens wrapping text:
(url)
12  3
@1 LinkDestOpen "("
@2 InlineText "url"
@3 LinkDestClose ")"

## Empty constructs

Empty brackets:
[]
12
@1 LinkOpen "["
@2 LinkClose "]"

Empty parens:
()
12
@1 LinkDestOpen "("
@2 LinkDestClose ")"

Brackets then parens:
[]()
1234
@1 LinkOpen "["
@2 LinkClose "]"
@3 LinkDestOpen "("
@4 LinkDestClose ")"

## Full link pattern

Full link with text and URL:
[text](url)
12   345  6
@1 LinkOpen "["
@2 InlineText "text"
@3 LinkClose "]"
@4 LinkDestOpen "("
@5 InlineText "url"
@6 LinkDestClose ")"

Link with single character content:
[a](b)
123456
@1 LinkOpen "["
@2 InlineText "a"
@3 LinkClose "]"
@4 LinkDestOpen "("
@5 InlineText "b"
@6 LinkDestClose ")"

## Full image pattern

Full image with alt and URL:
![alt](url)
123  456  7
@1 ImageMarker "!"
@2 LinkOpen "["
@3 InlineText "alt"
@4 LinkClose "]"
@5 LinkDestOpen "("
@6 InlineText "url"
@7 LinkDestClose ")"

Image with single character:
![a](b)
1234567
@1 ImageMarker "!"
@2 LinkOpen "["
@3 InlineText "a"
@4 LinkClose "]"
@5 LinkDestOpen "("
@6 InlineText "b"
@7 LinkDestClose ")"

## Adjacent link constructs

Two adjacent links:
[a][b]
123456
@1 LinkOpen "["
@2 InlineText "a"
@3 LinkClose "]"
@4 LinkOpen "["
@5 InlineText "b"
@6 LinkClose "]"

Link immediately after image:
[link]![img]
12   3456  7
@1 LinkOpen "["
@2 InlineText "link"
@3 LinkClose "]"
@4 ImageMarker "!"
@5 LinkOpen "["
@6 InlineText "img"
@7 LinkClose "]"

## Nested bracket constructs

Double nested open brackets:
[[a]]
12345
@1 LinkOpen "["
@2 LinkOpen "["
@3 InlineText "a"
@4 LinkClose "]"
@5 LinkClose "]"

Open bracket inside destination:
[(]
123
@1 LinkOpen "["
@2 LinkDestOpen "("
@3 LinkClose "]"

## Interaction with other constructs

Emphasis wrapping link:
*[text]*
123   45
@1 AsteriskDelimiter "*"
@2 LinkOpen "["
@3 InlineText "text"
@4 LinkClose "]"
@5 AsteriskDelimiter "*"

Image marker in middle of text:
text![alt
1   234
@1 InlineText "text"
@2 ImageMarker "!"
@3 LinkOpen "["
@4 InlineText "alt"

Multiple exclamations before bracket:
!![
123
@1 InlineText "!"
@2 ImageMarker "!"
@3 LinkOpen "["

Backtick inside brackets:
[`code`]
1      2
@1 LinkOpen "["
@2 LinkClose "]"

## Task list priority over link open

Task checkbox recognized before link open:
[ ] task
1   2
@1 TaskListMarker "[ ]"
@2 InlineText "task"

Checked task checkbox:
[x] done
1   2
@1 TaskListMarker "[x]"
@2 InlineText "done"

## Whitespace adjacent to link markers

Whitespace before open bracket:
text [link]
1    23   4
@1 InlineText "text"
@2 LinkOpen "["
@3 InlineText "link"
@4 LinkClose "]"

Whitespace before close bracket:
[text ]
1     2
@1 LinkOpen "["
@2 LinkClose "]"

Whitespace before open paren:
] (url)
  1   2
@1 LinkDestOpen "("
@2 LinkDestClose ")"

## Link close adjacent to plain text

Close bracket then text:
]abc
12
@1 LinkClose "]"
@2 InlineText "abc"

Open bracket at start of line:
[start of line
1
@1 LinkOpen "["
