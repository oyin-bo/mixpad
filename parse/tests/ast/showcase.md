# AST Breadcrumb Verification

This file demonstrates the high-end breadcrumb syntax for verifying the Rich Semantic AST.

## 1. Headings

# Heading 1
1
@1 AtxHeadingNode getLevel=1 > TextNode text=" Heading 1\n"

## 2. Formatting

*a **b** c*
  1
@2 EmphasisNode > TextNode text="a "
@2 EmphasisNode > StrongNode > TextNode text="b"
@2 EmphasisNode > TextNode text=" c"

## 3. Links

[MixPad](https://github.com)
  1
@2 LinkNode > LinkLabel > TextNode text="MixPad"
@2 LinkNode > LinkDestination text="https://github.com"

## 4. Complex Blocks

> # Quote Header
  1
@2 BlockquoteNode > AtxHeadingNode getLevel=1 > TextNode text="Quote Header"

## 5. Fenced Code

```javascript
Code
```
1
@1 FencedCodeBlockNode getLanguage="javascript" > BaseNode text="Code\n"
