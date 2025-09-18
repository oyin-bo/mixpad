# Fenced Code Blocks - Edge Cases

Only two backticks (should not be fence):
``
not a fence
``
1
@1 BacktickBoundary

Unbalanced fence (no closer):
```js
console.log('hello')
1  2
@1 FencedOpen
@2 FencedContent

Interior backticks shorter than opener:
```js
let x = `template`;
console.log(x);
```
1  2
@1 FencedOpen
@2 FencedContent

Interior backticks same length as opener but not at line start:
```js
let code = "```js"; // not a closer
console.log(code);
```
1  2
@1 FencedOpen
@2 FencedContent

Interior backticks same length at line start should close:
```js
console.log('test');
```
let y = 42;
1  2
@1 FencedOpen
@2 FencedContent

Too much indentation (more than 3 spaces):
    ```js
    console.log('test')
    ```
1
@1 InlineText

Fence with tab indentation:
	```js
	console.log('test')
	```
1  2
@1 FencedOpen
@2 FencedContent

Empty fence:
```

```
1  2
@1 FencedOpen
@2 FencedContent

Fence with CRLF line endings:
```js
console.log('hello');
```
1  2
@1 FencedOpen
@2 FencedContent