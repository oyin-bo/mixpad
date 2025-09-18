# Fenced Code Block Edge Cases

## Two backticks - should NOT be fence (inline behavior)

``
hello
``
1234567
@1 BacktickBoundary
@2 InlineCode "\nhello\n"
@3 BacktickBoundary

## Unclosed fence - fallback to error handling

```
unclosed content
1  2
@1 FencedOpen
@2 FencedContent "unclosed content\n"

## Mixed fence characters - backtick opener, tilde closer (invalid)

```
content
~~~
1  2       3
@1 FencedOpen
@2 FencedContent "content\n~~~\n"

## Shorter closing fence (invalid - not a closer)

````
content
```
````
1   2       3   4
@1 FencedOpen
@2 FencedContent "content\n```\n"
@3 FencedClose

## Fence chars inside content (not at line start)

```
code ```not a fence```
```
1   2                      3
@1 FencedOpen
@2 FencedContent "code ```not a fence```\n"
@3 FencedClose

## Info string with attributes

```python linenums="1"
print(42)
```
1                  2         3
@1 FencedOpen
@2 FencedContent "print(42)\n"
@3 FencedClose

## Four spaces indentation - too much, should be inline text

    ```
    not a fence
    ```
    123456789ABC
@1 InlineText