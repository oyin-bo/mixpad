# HTML Elements Tests

This test file verifies the parsing of HTML elements, including tags, attributes, comments, CDATA, DOCTYPE, and XML Processing Instructions.

## Basic HTML Tags

Simple opening tag
<div>
12  3
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode

Simple closing tag
</div>
1 2  3
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode

Self-closing tag
<br/>
12 3
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode

Tag with single attribute
<div class="note">
12  34    567   89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Input tag
<input type="text">
12    34   567   89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

HR tag

Tag with unquoted attribute
<div id=container>
12  34 56        7
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode

Tag with single-quoted attribute
<div title='Hello'>
12  34    567    89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

## XML Namespaces

SVG with namespace
<svg xmlns="http://www.w3.org/2000/svg">
12  34    567                         89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Namespaced tag name
<svg:rect x="0" y="0"/>
12       3456789ABCDEF
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B BaseNode
@C BaseNode
@D BaseNode
@E BaseNode
@F BaseNode

Namespaced attribute
<use xlink:href="#icon"/>
12  34    56   789    AB
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B BaseNode

## HTML Comments

Simple comment
<!-- This is a comment -->
1   2                  3
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode

Empty comment
<!---->
1   2
@1 HTMLCommentNode
@2 BaseNode

Comment with double dash
<!-- This -- has double dash -->
1   2                        3
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode

## CDATA Sections

Simple CDATA
<![CDATA[raw content]]>
1        2          3
@1 HTMLCDataNode
@2 BaseNode
@3 BaseNode

CDATA with special chars
<![CDATA[<div>&amp;</div>]]>
1        2               3
@1 HTMLCDataNode
@2 BaseNode
@3 BaseNode

## DOCTYPE Declarations

Simple HTML5 DOCTYPE
<!DOCTYPE html>
1        2    3
@1 HTMLDocTypeNode
@2 BaseNode
@3 BaseNode

Case-insensitive DOCTYPE
<!doctype html>
1        2    3
@1 HTMLDocTypeNode
@2 BaseNode
@3 BaseNode

DOCTYPE with PUBLIC
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">
1        2                                              3
@1 HTMLDocTypeNode
@2 BaseNode
@3 BaseNode

## XML Processing Instructions

XML declaration
<?xml version="1.0"?>
1 2  3             4
@1 XmlPINode
@2 BaseNode
@3 BaseNode
@4 BaseNode

XML stylesheet
<?xml-stylesheet type="text/css" href="style.css"?>
1 2             3                                4
@1 XmlPINode
@2 BaseNode
@3 BaseNode
@4 BaseNode

Empty PI
<?target?>
1 2     3
@1 XmlPINode
@2 BaseNode
@3 BaseNode

## Raw Text Elements

Script with content
<script>alert('Hello');</script>
12     34              5 6     7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

Script with entity
<script>&lt;div&gt;</script>
12     34   5  6   7 8     9
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 EntityNode
@5 HTMLRawTextNode
@6 EntityNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode

Style element
<style>body { color: red; }</style>
12    34                   5 6    7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

Textarea
<textarea>Some &amp; text</textarea>
12       34    5    6    7 8       9
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode

Textarea with multiple entities and markup-like text
<textarea>&lt;div&gt; **not markdown** &amp; &#169; end</textarea>
12       34   5  6   7                 8    9A     B   C D       EF
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 EntityNode
@5 HTMLRawTextNode
@6 EntityNode
@7 HTMLRawTextNode
@8 EntityNode
@9 HTMLRawTextNode
@A EntityNode
@B HTMLRawTextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode
@F TextNode

Textarea with percent-like sequences and entities
<textarea>100% sure %20 &amp;percent;</textarea>
12       34             5    6       7 8       9A
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode
@A TextNode

Textarea with numeric hex entity and unclosed markup-like
<textarea>code &amp; &#x41; <span>not a tag</textarea>
12       34    5    67     8               9 A       BC
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 EntityNode
@8 HTMLRawTextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode
@C TextNode

Textarea: plain text only
<textarea>Hello world</textarea>
12       34          5 6       78
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode

Textarea: named entities parsed (semicolons required)
<textarea>&lt;&gt;&amp;&copy;</textarea>
12       34   5   6    7     8 9       AB
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 EntityNode
@5 EntityNode
@6 EntityNode
@7 EntityNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode
@B TextNode

Textarea: decimal numeric entities
<textarea>Price: &#36;100</textarea>
12       34      5    6  7 8       9A
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode
@A TextNode

Textarea: hex numeric entities (upper/lowercase X)
<textarea>Letter: &#x41; and &#X42;</textarea>
12       34       5     6    7     8 9       AB
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 EntityNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode
@B TextNode

Textarea: entity adjacent to letters and numbers
<textarea>A&amp;Bcopy&#33;2025</textarea>
12       345    6    7    8   9 A       BC
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 EntityNode
@8 HTMLRawTextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode
@C TextNode

Textarea: semicolon-less named entity should NOT be parsed (must be treated as text)
<textarea>&copy rest</textarea>
12       34         5 6       78
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode

Textarea: incomplete entity (no digits) remains text
<textarea>&#; &amp;</textarea>
12       34   5    6 7       89
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLTagNode
@7 BaseNode
@8 BaseNode
@9 TextNode

Textarea: percent sequences are plain text, entities still parsed
<textarea>100% ok %20 &amp;percent;</textarea>
12       34           5    6       7 8       9A
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 EntityNode
@6 HTMLRawTextNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode
@A TextNode

Textarea: Markdown-like constructs are raw text
<textarea>**not bold** `code` _em_</textarea>
12       34                       5 6       78
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode

Textarea: < and > that look like tags should be treated as text unless closing textarea is found
<textarea>Here is <span> and </textarea> remains</textarea>
12       34                  5 6       789      A B       CD
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 TextNode
@A HTMLTagNode
@B BaseNode
@C BaseNode
@D TextNode

Textarea: case-insensitive closing tag detection
<textarea>raw text</TEXTAREA>
12       34       5 6       78
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode

## Error Recovery

Unclosed opening tag (at newline)
<div class="note
12  34    567   8
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 TextNode

>

Unclosed closing tag
</div
1 2  3
@1 HTMLTagNode
@2 BaseNode
@3 TextNode

>

Multi-line comment (simple)
<!-- multiline
1   2
@1 HTMLCommentNode
@2 BaseNode
more lines
1
@1 BaseNode

-->
1
@1 BaseNode

Unclosed CDATA
<![CDATA[no close
1        2
@1 HTMLCDataNode
@2 BaseNode

]]>

Unclosed DOCTYPE
<!DOCTYPE html
1        2
@1 HTMLDocTypeNode
@2 BaseNode

>

Unclosed XML PI (at newline)
<?xml version="1.0"
1 2  3             4
@1 XmlPINode
@2 BaseNode
@3 BaseNode
@4 TextNode

?>

Unclosed attribute value
<div title="unclosed
12  34    567       8
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 TextNode

">

## Nested Elements

Simple nesting
<div><span>text</span></div>
12  345   67   8 9   AB C  D
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 BaseNode
@7 TextNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Multiple levels of nesting
<div><p><em>text</em></p></div>
12  345678 9A   B C DE FGH I  J
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 BaseNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode
@E HTMLTagNode
@F BaseNode
@G BaseNode
@H HTMLTagNode
@I BaseNode
@J BaseNode

Nesting with attributes
<div class="outer"><span id="inner">text</span></div>
12  34    567    89AB   CD EFG    HIJ   K L   MN O  P
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A HTMLTagNode
@B BaseNode
@C TextNode
@D BaseNode
@E BaseNode
@F BaseNode
@G BaseNode
@H BaseNode
@I BaseNode
@J TextNode
@K HTMLTagNode
@L BaseNode
@M BaseNode
@N HTMLTagNode
@O BaseNode
@P BaseNode

## Markdown Inside HTML

Bold inside tag
<div>**bold** text</div>
12  34 5   6 78   9 A  B
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 StrongNode
@5 TextNode
@6 BaseNode
@7 TextNode
@8 TextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode

Emphasis with entity
<div>&amp; *emphasis* text</div>
12  34    567       89A   B C  D
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 EntityNode
@5 TextNode
@6 EmphasisNode
@7 TextNode
@8 BaseNode
@9 TextNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Code inside HTML
<p>`code` text</p>
12345   678   9 AB
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 InlineCodeNode
@5 InlineCodeNode
@6 InlineCodeNode
@7 TextNode
@8 TextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode

## HTML Inside Markdown

Tag inside emphasis
**<span>text</span>**
1 23   45   6 7   89
@1 StrongNode
@2 HTMLTagNode
@3 BaseNode
@4 BaseNode
@5 TextNode
@6 HTMLTagNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Tag inside strikethrough
~~<del>text</del>~~
1 23  45   6 7  89
@1 StrikethroughNode
@2 HTMLTagNode
@3 BaseNode
@4 BaseNode
@5 TextNode
@6 HTMLTagNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

## Mixed Content

Text before and after tag
Hello <span>world</span> there
1    234   56    7 8   9AB
@1 TextNode
@2 TextNode
@3 HTMLTagNode
@4 BaseNode
@5 BaseNode
@6 TextNode
@7 HTMLTagNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B TextNode

Adjacent tags
<span>one</span><span>two</span>
12   34  5 6   789   AB  C D   E
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode
@B TextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode

Multiple tags in sequence
<b>bold</b> and <i>italic</i> text
1234   5 6789  ABCDE     F GHIJ
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 TextNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode
@E TextNode
@F HTMLTagNode
@G BaseNode
@H BaseNode
@I TextNode
@J TextNode

## Attribute Value Edge Cases

Entity in attribute value
<a title="&copy; 2024">link</a>
1234    567     8    9AB   C DE
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 EntityNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B TextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode

Percent encoding in URL
<a href="page%20name.html">link</a>
1234   567   8  9        ABC   D EF
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B BaseNode
@C TextNode
@D HTMLTagNode
@E BaseNode
@F BaseNode

Multiple entities in quoted attribute
<a title="&copy;&amp;">link</a>
1234    567     8    9AB   C DE
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 EntityNode
@8 EntityNode
@9 BaseNode
@A BaseNode
@B TextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode

Decimal and hex numeric entities in attribute
<a title="&#169; and &#xA9;">link</a>
1234    567     8    9     ABC   D EFG
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 EntityNode
@8 BaseNode
@9 EntityNode
@A BaseNode
@C TextNode
@D HTMLTagNode
@E BaseNode
@F BaseNode
@G TextNode
@G TextNode

Quoted attribute mixing entity and percent encoding
<a title="&amp;%20end">ok</a>
1234    567    8  9  ABC D EFG
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 EntityNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B BaseNode
@C TextNode
@D HTMLTagNode
@E BaseNode
@F BaseNode
@G TextNode

Invalid percent sequence in quoted attribute (treated as text)
<div title="100% sure">text</div>
12  34    567        89A   B C  DE
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode
@E TextNode

Unquoted attribute with ampersand (entities NOT parsed in unquoted values)
<div note=&copy;>text</div>
12  34   56     78   9 A  BC
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode
@C TextNode


JavaScript in attribute
<button onclick="alert('hi')">Click</button>
12     34      567          89A    B C     D
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Mixed quotes in attribute
<div title='He said "hello"'>text</div>
12  34    567              89A   B C  D
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Empty attribute value
<div class="">empty</div>
12  34    56789    A B  C
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A HTMLTagNode
@B BaseNode
@C BaseNode

Equals with formula
<a data-formula="x==y">link</a>
1234           567   89A   B CD
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Special chars in unquoted value
<div id=my_id-123>text</div>
12  34 56        78   9 A  B
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode

## Boolean and Valueless Attributes

Boolean attribute
<input checked>
12    34      5
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode

Multiple boolean attributes
<input disabled readonly required>
12    34       56       78       9
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 TextNode
@6 BaseNode
@7 TextNode
@8 BaseNode
@9 BaseNode

Boolean with other attributes
<input type="text" required disabled>
12    34   567   89A       BC       D
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B TextNode
@C BaseNode
@D BaseNode

## TextNode Variations

TextNode around equals
<div class = "note">text</div>
12  34    56789   ABC   D E  F
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 TextNode
@6 BaseNode
@7 TextNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B BaseNode
@C TextNode
@D HTMLTagNode
@E BaseNode
@F BaseNode

Multiple spaces
<div  class="note">text</div>
12  3 4    567   89A   B C  D
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Trailing whitespace in tag
<div class="note" >text</div>
12  34    567   89AB   C D  E
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B TextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode

## Self-Closing Variations

Self-closing with space
<br />
12 34
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode

Self-closing div (XML-style)
<div/>
12  3
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode

Self-closing with attributes
<img src="pic.jpg" alt="Photo" />
12  34  567      89A  BCD    EFG
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B BaseNode
@C BaseNode
@D BaseNode
@E BaseNode
@F TextNode
@G BaseNode

## Tag Name Variations

Uppercase tag
<DIV>text</DIV>
12  34   5 6  7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

Custom element with hyphen
<my-component>text</my-component>
12           34   5 6           7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

Heading tag with number
<h1>Title</h1>
12 34    5 6 7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

## Void Elements

Image tag (void element)
<img src="pic.jpg">
12  34  567      89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Input tag
<input type="text">
12    34   567   89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

HR tag
<hr>
12 3
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode

Meta tag
<meta charset="UTF-8">
12   34      567    89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Link tag
<link rel="stylesheet" href="style.css">
12   34  567         89A   BCD        EF
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B BaseNode
@C BaseNode
@D BaseNode
@E BaseNode
@F BaseNode

## Comment Edge Cases

Comment with greater-than inside
<!-- test > test -->
1   2            3
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode

Comment with nested markers
<!-- <!-- inner --> -->
1   2           3  45
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode
@4 TextNode
@5 TextNode

Multi-line comment with tag-like content
<!-- <div>not a tag</div> -->
1   2                     3
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode

## CDATA Edge Cases

CDATA with bracket sequences
<![CDATA[data]]text]]>
1        2         3
@1 HTMLCDataNode
@2 BaseNode
@3 BaseNode

CDATA with tags inside
<![CDATA[<script>alert()</script>]]>
1        2                       3
@1 HTMLCDataNode
@2 BaseNode
@3 BaseNode

## Adjacent HTML Constructs

Comment and tag adjacent
<!-- comment --><div>text</div>
1   2        3  45  67   8 9  A
@1 HTMLCommentNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 BaseNode
@7 TextNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode

CDATA and tag
<![CDATA[data]]><p>text</p>
1        2   3  4567   8 9A
@1 HTMLCDataNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 BaseNode
@7 TextNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode

DOCTYPE and tag
<!DOCTYPE html><html>
1        2    345   6
@1 HTMLDocTypeNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 BaseNode

## Raw Text Edge Cases

Script with nested script-like content
<script>var s = "</script>";</script>
12     34        5 6     78 9 A     B
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 HTMLTagNode
@A BaseNode
@B BaseNode

Style with nested closing tag
<style>content { } </style> ignored</style>
12    34           5 6    789      A B    C
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 TextNode
@9 TextNode
@A HTMLTagNode
@B BaseNode
@C BaseNode

Multiple script tags
<script>code1</script><script>code2</script>
12     34    5 6     789     AB    C D     E
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode
@8 HTMLTagNode
@9 BaseNode
@A BaseNode
@B HTMLRawTextNode
@C HTMLTagNode
@D BaseNode
@E BaseNode

Uppercase closing tag in raw text
<script>code</SCRIPT>
12     34   5 6     7
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLRawTextNode
@5 HTMLTagNode
@6 BaseNode
@7 BaseNode

## Data URIs and Special URLs

Data URI in img
<img src="data:image/png;base64,ABC123">
12  34  567                           89
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode

Hash link

Hash link
<a href="#section">link</a>
1234   567       89A   B CD
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

Protocol-relative URL
<a href="//example.com">link</a>
1234   567            89A   B CD
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A TextNode
@B HTMLTagNode
@C BaseNode
@D BaseNode

## Complex Real-World Examples

Complete link with title and class
<a href="page.html" title="Go to page" class="btn">Link</a>
1234   567        89A    BCD         EFG    HIJ  KLM   N OP
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B BaseNode
@C BaseNode
@D BaseNode
@E BaseNode
@F TextNode
@G BaseNode
@H BaseNode
@I BaseNode
@J BaseNode
@K BaseNode
@L BaseNode
@M TextNode
@N HTMLTagNode
@O BaseNode
@P BaseNode

Div with data attributes
<div data-id="123" data-name="test">content</div>
12  34      567  89A        BCD   EFG      H I  J
@1 HTMLTagNode
@2 BaseNode
@3 TextNode
@4 BaseNode
@5 BaseNode
@6 BaseNode
@7 BaseNode
@8 BaseNode
@9 TextNode
@A BaseNode
@B BaseNode
@C BaseNode
@D BaseNode
@E BaseNode
@F BaseNode
@G TextNode
@H HTMLTagNode
@I BaseNode
@J BaseNode

Form with multiple input types
<form><input type="text"><input type="submit"></form>
12   345    67   89A   BCDE    FG   HIJ     KLM N   O
@1 HTMLTagNode
@2 BaseNode
@3 BaseNode
@4 HTMLTagNode
@5 BaseNode
@6 TextNode
@7 BaseNode
@8 BaseNode
@9 BaseNode
@A BaseNode
@B BaseNode
@C BaseNode
@D HTMLTagNode
@E BaseNode
@F TextNode
@G BaseNode
@H BaseNode
@I BaseNode
@J BaseNode
@K BaseNode
@L BaseNode
@M HTMLTagNode
@N BaseNode
@O BaseNode


## Known Issues & Open Questions

### Script Tag Entity Tokenization  
The test "Script with entity" currently shows entities (`&lt;`, `&gt;`) tokenized inside `<script>` tags. However, browsers do NOT decode HTML entities in script content. This test needs review:
- Should the scanner tokenize entities for editor purposes (syntax highlighting, navigation)?
- Or should it match browser behavior and treat script content as opaque HTMLRawTextNode?
- Current implementation: Tokenizes entities (may be incorrect per HTML spec)

### Self-closing Tag Position Markers
Some self-closing variations ("Self-closing with space" at `<br />`) need corrected position markers after implementing the new token structure.