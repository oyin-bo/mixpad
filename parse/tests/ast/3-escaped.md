# Escaped tests

Backslash escape: \\
1                 2
@1 TextNode text="Backslash escape:"
@2 EscapedNode text="\\\\"

End-of-input backslash: \
1                       2
@1 TextNode text="End-of-input backslash:"
@2 EscapedNode text="\\\n"

Escaped punctuation: \*bold\*
1                    2 3   4
@1 TextNode text="Escaped punctuation:"
@2 EscapedNode text="\\*"
@3 TextNode text="bold"
@4 EscapedNode text="\\*"

