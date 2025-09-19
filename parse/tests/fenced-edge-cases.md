# Fenced Code Block Edge Cases

## Two backticks - should NOT be fence (inline behavior)

``
hello
``
1 2      3
@1 BacktickBoundary
@2 InlineCode "\nhello\n"
@3 BacktickBoundary

## Unclosed fence - fallback to error handling

```
unclosed content
1  2                x
@1 FencedOpen
@2 FencedContent "\nunclosed content"

## Mixed fence characters - backtick opener, tilde closer (invalid)

```
content
~~~
1  2
@1 FencedOpen  
@2 FencedContent "\ncontent\n~~~\n"