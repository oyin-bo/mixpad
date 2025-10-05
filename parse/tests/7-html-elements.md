# HTML Elements Tests

This test file verifies the parsing of HTML elements, including tags, attributes, comments, CDATA, DOCTYPE, and XML Processing Instructions.

## Basic HTML Tags

Simple opening tag
<div>
12  3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose

Simple closing tag
</div>
1 2  3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose

Self-closing tag
<br/>
12 3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagSelfClosing

Tag with single attribute
<div class="note">
12  34    56     7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose

Tag with multiple attributes
<input type="text" name="field" disabled>
12    34   56     78   9A      BC       D
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLAttributeEquals
@A HTMLAttributeValue
@B Whitespace
@C HTMLAttributeName
@D HTMLTagClose

Tag with unquoted attribute
<div id=container>
12  34 56        7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose

Tag with single-quoted attribute
<div title='Hello'>
12  34    56      7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose

## XML Namespaces

SVG with namespace
<svg xmlns="http://www.w3.org/2000/svg">
12  34    56                           7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose

Namespaced tag name
<svg:rect x="0" y="0"/>
12       3456  789A  B
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLAttributeEquals
@A HTMLAttributeValue
@B HTMLTagSelfClosing

Namespaced attribute
<use xlink:href="#icon"/>
12  34         56      7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagSelfClosing

## HTML Comments

Simple comment
<!-- This is a comment -->
1   2                  3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

Empty comment
<!---->
1   2
@1 HTMLCommentOpen
@2 HTMLCommentClose

Comment with double dash
<!-- This -- has double dash -->
1   2                        3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

## CDATA Sections

Simple CDATA
<![CDATA[raw content]]>
1        2          3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

CDATA with special chars
<![CDATA[<div>&amp;</div>]]>
1        2               3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

## DOCTYPE Declarations

Simple HTML5 DOCTYPE
<!DOCTYPE html>
1        2    3
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent
@3 HTMLDocTypeClose

Case-insensitive DOCTYPE
<!doctype html>
1        2    3
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent
@3 HTMLDocTypeClose

DOCTYPE with PUBLIC
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">
1        2                                              3
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent
@3 HTMLDocTypeClose

## XML Processing Instructions

XML declaration
<?xml version="1.0"?>
1 2  3             4
@1 XMLProcessingInstructionOpen
@2 XMLProcessingInstructionTarget
@3 XMLProcessingInstructionContent
@4 XMLProcessingInstructionClose

XML stylesheet
<?xml-stylesheet type="text/css" href="style.css"?>
1 2             3                                4
@1 XMLProcessingInstructionOpen
@2 XMLProcessingInstructionTarget
@3 XMLProcessingInstructionContent
@4 XMLProcessingInstructionClose

Empty PI
<?target?>
1 2     3
@1 XMLProcessingInstructionOpen
@2 XMLProcessingInstructionTarget
@3 XMLProcessingInstructionClose

## Raw Text Elements

Script with content
<script>alert('Hello');</script>
12     34              5 6     7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Script with entity
<script>&lt;div&gt;</script>
12     34   5  6   7 8     9
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 EntityNamed
@5 HTMLRawText
@6 EntityNamed
@7 HTMLTagOpen
@8 HTMLTagName
@9 HTMLTagClose

Style element
<style>body { color: red; }</style>
12    34                   5 6    7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Textarea
<textarea>Some &amp; text</textarea>
12       34    5    6    7 8       9
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 EntityNamed
@6 HTMLRawText
@7 HTMLTagOpen
@8 HTMLTagName
@9 HTMLTagClose

## Error Recovery

Unclosed opening tag (at newline)
<div class="note
12  34    56    7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace

>

Unclosed closing tag
</div
1 2  3
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace

>

Unclosed comment
<!-- unclosed
1   2
@1 HTMLCommentOpen
@2 HTMLCommentContent

-->

Unclosed CDATA
<![CDATA[no close
1        2
@1 HTMLCDataOpen
@2 HTMLCDataContent

]]>

Unclosed DOCTYPE
<!DOCTYPE html
1        2
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent

>

Unclosed XML PI (at newline)
<?xml version="1.0"
1 2  3             4
@1 XMLProcessingInstructionOpen
@2 XMLProcessingInstructionTarget
@3 XMLProcessingInstructionContent
@4 NewLine

?>

Unclosed attribute value
<div title="unclosed
12  34    56        7
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace

">

