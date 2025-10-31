# GFM Strikethrough Tests

This file contains comprehensive tests for GFM strikethrough following the specification in section 6.5 of the GFM spec.

## Basic Strikethrough

Simple strikethrough with double tildes:

~~word~~
1 2   3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~" CanClose

~~strike~~
1 2     3
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "strike"
@3 TildeDelimiter "~~" CanClose

## Multiple Words

Strikethrough can span multiple words:

~~this is struck~~
 1              23
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "this is struck"
@3 TildeDelimiter "~~" CanClose

## Multiple Strikethroughs

Multiple strikethroughs in one line:

~~first~~ and ~~second~~
 1     2    3 45      67
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "first"
@3 TildeDelimiter "~~" CanClose
@4 InlineText " and "
@5 TildeDelimiter "~~" CanOpen
@6 InlineText "second"
@7 TildeDelimiter "~~" CanClose

## Single Tilde (Not Strikethrough)

Single tildes should be treated as plain text:

~single~
1
@1 InlineText "~single~"

~not struck~
1
@1 InlineText "~not struck~"

## Whitespace Flanking

Tildes flanked by whitespace on both sides are plain text:

text ~ ~ text
1
@1 InlineText "text ~ ~ text"

## Right-Flanking Only

Closing delimiter without opening:

word~~
1   2
@1 InlineText "word"
@2 TildeDelimiter "~~" CanClose

text~~
1   2
@1 InlineText "text"
@2 TildeDelimiter "~~" CanClose

## Left-Flanking Only

Opening delimiter without closing:

~~word
1 2
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "word"

~~text
1 2
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "text"

## Nested Formatting

Strikethrough with bold inside:

~~**bold**~~
 12 3   45 6
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 AsteriskDelimiter "**" CanOpen
@3 InlineText "bold"
@4 AsteriskDelimiter "**" CanClose
@5 TildeDelimiter "~~" CanClose

Strikethrough with italic inside:

~~*italic*~~
 1 23     45
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 AsteriskDelimiter "*" CanOpen
@3 InlineText "italic"
@4 AsteriskDelimiter "*" CanClose
@5 TildeDelimiter "~~" CanClose

Bold with strikethrough inside:

**~~struck~~**
 12 3     45 6
@1 AsteriskDelimiter|IsSafeReparsePoint "**" CanOpen
@2 TildeDelimiter "~~" CanOpen
@3 InlineText "struck"
@4 TildeDelimiter "~~" CanClose
@5 AsteriskDelimiter "**" CanClose

## Multiple Tildes

Three tildes on each side:

~~~word~~~
  12   34
@1 TildeDelimiter|IsSafeReparsePoint "~~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~~" CanClose

Four tildes:

~~~~text~~~~
   1 2  34
@1 TildeDelimiter|IsSafeReparsePoint "~~~~" CanOpen
@2 InlineText "text"
@3 TildeDelimiter "~~~~" CanClose

## Mismatched Lengths

Two tildes opening, three tildes closing:

~~word~~~
 1 2   34
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~~" CanClose

Three tildes opening, two tildes closing:

~~~word~~
  1 2  3
@1 TildeDelimiter|IsSafeReparsePoint "~~~" CanOpen
@2 InlineText "word"
@3 TildeDelimiter "~~" CanClose

## With Punctuation

Strikethrough with punctuation:

~~text!~~
 1 2   34
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "text!"
@3 TildeDelimiter "~~" CanClose

~~hello, world~~
 1 2          34
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "hello, world"
@3 TildeDelimiter "~~" CanClose

## Mid-Sentence

Strikethrough in the middle of a sentence:

This ~~is~~ text
    1 23 4 5
@1 InlineText "This "
@2 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@3 InlineText "is"
@4 TildeDelimiter "~~" CanClose
@5 InlineText " text"

Some ~~struck~~ words
    1 23     45 6
@1 InlineText "Some "
@2 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@3 InlineText "struck"
@4 TildeDelimiter "~~" CanClose
@5 InlineText " words"

## Adjacent to Other Characters

Tildes adjacent to letters:

a~~b~~c
 123 45
@1 InlineText "a"
@2 TildeDelimiter "~~" CanOpen
@3 InlineText "b"
@4 TildeDelimiter "~~" CanClose
@5 InlineText "c"

## With Code

Strikethrough and inline code:

~~`code`~~
 1 2 3  45
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 BacktickBoundary "`"
@3 InlineCode "code"
@4 BacktickBoundary "`"
@5 TildeDelimiter "~~" CanClose

## Partial Words

Strikethrough part of a word:

wo~~rd~~
  123 45
@1 InlineText "wo"
@2 TildeDelimiter "~~" CanOpen
@3 InlineText "rd"
@4 TildeDelimiter "~~" CanClose

## Start of Line

Strikethrough at the start of a line:

~~beginning~~
 1 2       34
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 InlineText "beginning"
@3 TildeDelimiter "~~" CanClose

## End of Line

Strikethrough at the end:

text ~~end~~
    1 23  45
@1 InlineText "text "
@2 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@3 InlineText "end"
@4 TildeDelimiter "~~" CanClose

## Empty Strikethrough

Empty strikethrough (should still tokenize):

~~~~
 1 2
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 TildeDelimiter "~~" CanClose

## Complex Nesting

Strikethrough with multiple nested formats:

~~**bold *italic* text**~~
 12 3   45     6 7   89A
@1 TildeDelimiter|IsSafeReparsePoint "~~" CanOpen
@2 AsteriskDelimiter "**" CanOpen
@3 InlineText "bold "
@4 AsteriskDelimiter "*" CanOpen
@5 InlineText "italic"
@6 AsteriskDelimiter "*" CanClose
@7 InlineText " text"
@8 AsteriskDelimiter "**" CanClose
@9 TildeDelimiter "~~" CanClose
