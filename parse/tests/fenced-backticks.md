# Fenced Code Blocks with Backticks

## Basic triple backtick fence

```
hello world
```
1  2            3
@1 FencedOpen
@2 FencedContent "\nhello world\n"
@3 FencedClose

## Triple backtick with language info

```js
console.log('hello')
```
1  2                       3
@1 FencedOpen
@2 FencedContent "js\nconsole.log('hello')\n"
@3 FencedClose

## Quadruple backtick fence

````
nested ```code``` here
````
1   2                       3
@1 FencedOpen
@2 FencedContent "\nnested ```code``` here\n"
@3 FencedClose