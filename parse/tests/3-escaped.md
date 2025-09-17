# Backslash Escapes

As far as scanning is concerned, a backslash escape is a backslash followed by any character (including newline).

The scanner does not interpret the escaped character, it just recognizes the escape sequence and emits a token of kind `Escaped` covering both the backslash and the following character.

Backslash escape: \\
1                 2
@1 InlineText
@2 Escaped

End-of-input backslash: \
1                       2
@1 InlineText
@2 Escaped

Escaped punctuation: \*bold\*
1                    2 3   4
@1 InlineText
@2 Escaped
@3 InlineText
@4 Escaped
