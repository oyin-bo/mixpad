# Fenced Code Blocks

## Basic triple tilde fence

~~~
1
@1 FencedCodeBlockNode getLanguage=""
hello world
1
@1 BaseNode text="hello world\n"
~~~
1
@1 BaseNode text="~~~\n"

## Triple tilde with language info

~~~python
1
@1 FencedCodeBlockNode getLanguage="python"
print('hello')
1
@1 BaseNode text="print('hello')\n"
~~~
1
@1 BaseNode text="~~~\n"

# Fenced Code Blocks with Backticks

## Basic triple backtick fence

```
1
@1 FencedCodeBlockNode getLanguage=""
hello world
1
@1 BaseNode text="hello world\n"
```
1
@1 BaseNode text="```\n"

## Triple backtick with language info

```js
1
@1 FencedCodeBlockNode getLanguage="js"
console.log('hello')
1
@1 BaseNode text="console.log('hello')\n"
```
1
@1 BaseNode text="```\n"

## Quadruple backtick fence

````
1
@1 FencedCodeBlockNode getLanguage=""
nested ```code``` here
1
@1 BaseNode text="nested ```code``` here\n"
````
1
@1 BaseNode text="````\n"

# Fenced Code Block Edge Cases

## Two backticks - should NOT be fence (inline behavior)

``
1
@1 InlineCodeNode text="``"
hello
1
@1 InlineCodeNode text="\nhello\n"
``
1
@1 InlineCodeNode text="``"

