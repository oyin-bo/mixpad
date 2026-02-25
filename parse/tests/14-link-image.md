# Link and Image Scanning Tests

## Basic link bracket markers

Simple open bracket:
[link
1
@1 LinkOpen "["

Simple close bracket:
text]
1   2
@1 InlineText "text"
@2 LinkClose "]"

Open and close brackets:
[text]
1    2
@1 LinkOpen "["
@2 LinkClose "]"

## Image marker

Exclamation before bracket is ImageMarker:
![image
12
@1 ImageMarker "!"
@2 LinkOpen "["

Exclamation followed by open bracket:
![alt]
12   3
@1 ImageMarker "!"
@2 LinkOpen "["
@3 LinkClose "]"

Exclamation NOT followed by bracket is inline text:
!text
1
@1 InlineText "!text"

Exclamation followed by open paren is inline text:
!(url)
12   3
@1 InlineText "!"
@2 LinkDestOpen "("
@3 LinkDestClose ")"

Exclamation at end of input:
hello!
1
@1 InlineText "hello!"

## Link destination markers

Open paren:
(url
1
@1 LinkDestOpen "("

Close paren:
url)
1  2
@1 InlineText "url"
@2 LinkDestClose ")"

Open and close parens:
(url)
1   2
@1 LinkDestOpen "("
@2 LinkDestClose ")"

## Full link construct

Full inline link:
[text](url)
1    23   4
@1 LinkOpen "["
@2 LinkClose "]"
@3 LinkDestOpen "("
@4 LinkDestClose ")"

Full link with text and url tokens:
[click here](https://example.com)
1          23                   4
@1 LinkOpen "["
@2 LinkClose "]"
@3 LinkDestOpen "("
@4 LinkDestClose ")"

## Full image construct

Full inline image:
![alt](url)
12   34   5
@1 ImageMarker "!"
@2 LinkOpen "["
@3 LinkClose "]"
@4 LinkDestOpen "("
@5 LinkDestClose ")"

## Adjacent and nested constructs

Adjacent brackets:
[]
12
@1 LinkOpen "["
@2 LinkClose "]"

Empty link:
[](url)
123   4
@1 LinkOpen "["
@2 LinkClose "]"
@3 LinkDestOpen "("
@4 LinkDestClose ")"

Nested brackets:
[[text]]
12    34
@1 LinkOpen "["
@2 LinkOpen "["
@3 LinkClose "]"
@4 LinkClose "]"

Multiple links on same line:
[a](b) [c](d)
1 23 4 5 67 8
@1 LinkOpen "["
@2 LinkClose "]"
@3 LinkDestOpen "("
@4 LinkDestClose ")"
@5 LinkOpen "["
@6 LinkClose "]"
@7 LinkDestOpen "("
@8 LinkDestClose ")"

Brackets and parens interleaved:
[(])
1234
@1 LinkOpen "["
@2 LinkDestOpen "("
@3 LinkClose "]"
@4 LinkDestClose ")"

## Image followed by link

Image and link adjacent:
![img](src)[text](url)
12   34   56    78   9
@1 ImageMarker "!"
@2 LinkOpen "["
@3 LinkClose "]"
@4 LinkDestOpen "("
@5 LinkDestClose ")"
@6 LinkOpen "["
@7 LinkClose "]"
@8 LinkDestOpen "("
@9 LinkDestClose ")"

## Task list still works with bracket

Task list marker still recognised before link open:
- [ ] task
1 2   3
@1 BulletListMarker "-"
@2 TaskListMarker "[ ]"
@3 InlineText "task"

Square bracket not matching task syntax becomes LinkOpen:
[link text]
1         2
@1 LinkOpen "["
@2 LinkClose "]"

## Wrapping constructs

Link inside emphasis context:
*[link]*
12    34
@1 AsteriskDelimiter "*"
@2 LinkOpen "["
@3 LinkClose "]"
@4 AsteriskDelimiter "*"

Emphasis inside link:
[*bold*]
12    34
@1 LinkOpen "["
@2 AsteriskDelimiter "*"
@3 AsteriskDelimiter "*"
@4 LinkClose "]"

## Single characters in isolation

Lone open bracket at start of line:
[
1
@1 LinkOpen "["

Lone close bracket at start of line:
]
1
@1 LinkClose "]"

Lone open paren at start of line:
(
1
@1 LinkDestOpen "("

Lone close paren at start of line:
)
1
@1 LinkDestClose ")"

Lone exclamation at start of line:
!
1
@1 InlineText "!"
