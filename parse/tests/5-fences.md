# Fenced Code Blocks with Tildes

## Basic triple tilde fence

~~~
1
@1 FencedOpen
hello world
1
@1 FencedContent "hello world"
~~~
1
@1 FencedClose

## Triple tilde with language info

~~~python
1
@1 FencedOpen
print("hello")
1
@1 FencedContent "print(\"hello\")"
~~~
1
@1 FencedClose

# Fenced Code Blocks with Backticks

## Basic triple backtick fence

```
1
@1 FencedOpen
hello world
1
@1 FencedContent "hello world"
```
1
@1 FencedClose

## Triple backtick with language info

```js
1
@1 FencedOpen
console.log('hello')
1
@1 FencedContent "console.log('hello')"
```
1
@1 FencedClose

## Quadruple backtick fence

````
1
@1 FencedOpen
nested ```code``` here
1
@1 FencedContent "nested ```code``` here"
````
1
@1 FencedClose



# Fenced Code Block Edge Cases

## Two backticks - should NOT be fence (inline behavior)

``
1
@1 BacktickBoundary
hello
``
1
@1 BacktickBoundary

## Unclosed fence - fallback to error handling

```
1
@1 FencedOpen
unclosed content
1
@1 FencedContent "unclosed content"

## Mixed fence characters - backtick opener, tilde closer (invalid)

```
1
@1 FencedOpen
content
1
@1 FencedContent "content"
~~~
1
@1 FencedContent "~~~"