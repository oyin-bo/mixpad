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
12  34    567   89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Input tag
<input type="text">
12    34   567   89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

HR tag

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
12  34    56 7   89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

## XML Namespaces

SVG with namespace
<svg xmlns="http://www.w3.org/2000/svg">
12  34    56 7                         89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Namespaced tag name
<svg:rect x="0" y="0"/>
12       3456789ABCDEF
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F HTMLTagSelfClosing

Namespaced attribute
<use xlink:href="#icon"/>
12  34    56   789    AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeColon
@6 HTMLAttributeName
@7 HTMLAttributeEquals
@8 HTMLAttributeQuote
@9 HTMLAttributeValue
@A HTMLAttributeQuote
@B HTMLTagSelfClosing

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
12  34    56 7   8
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote|ErrorUnbalancedTokenFallback

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
12  34    56 7      8
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote|ErrorUnbalancedTokenFallback

">

## Nested Elements

Simple nesting
<div><span>text</span></div>
12   34    56    7    89     A  BC   D
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Multiple levels of nesting
<div><p><em>text</em></p></div>
12  345678 9A   B C DE FGH I  J
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 HTMLTagOpen
@8 HTMLTagName
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose
@E HTMLTagOpen
@F HTMLTagName
@G HTMLTagClose
@H HTMLTagOpen
@I HTMLTagName
@J HTMLTagClose

Nesting with attributes
<div class="outer"><span id="inner">text</span></div>
12  34    567    89AB   CD EFG    HIJ   K L   MN O  P
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A HTMLTagOpen
@B HTMLTagName
@C Whitespace
@D HTMLAttributeName
@E HTMLAttributeEquals
@F HTMLAttributeQuote
@G HTMLAttributeValue
@H HTMLAttributeQuote
@I HTMLTagClose
@J InlineText
@K HTMLTagOpen
@L HTMLTagName
@M HTMLTagClose
@N HTMLTagOpen
@O HTMLTagName
@P HTMLTagClose

## Markdown Inside HTML

Bold inside tag
<div>**bold** text</div>
12  34 5   6 78   9 A  B
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 AsteriskDelimiter
@5 InlineText
@6 AsteriskDelimiter
@7 Whitespace
@8 InlineText
@9 HTMLTagOpen
@A HTMLTagName
@B HTMLTagClose

Emphasis with entity
<div>&amp; *emphasis* text</div>
12  34    567       89A   B C  D
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 EntityNamed
@5 Whitespace
@6 AsteriskDelimiter
@7 InlineText
@8 AsteriskDelimiter
@9 Whitespace
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Code inside HTML
<p>`code` text</p>
12345   678   9 AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 BacktickBoundary
@5 InlineCode
@6 BacktickBoundary
@7 Whitespace
@8 InlineText
@9 HTMLTagOpen
@A HTMLTagName
@B HTMLTagClose

## HTML Inside Markdown

Tag inside emphasis
**<span>text</span>**
1 23   45   6 7   89
@1 AsteriskDelimiter
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 HTMLTagName
@8 HTMLTagClose
@9 AsteriskDelimiter

Tag inside strikethrough
~~<del>text</del>~~
1 23  45   6 7  89
@1 TildeDelimiter
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 HTMLTagName
@8 HTMLTagClose
@9 TildeDelimiter

## Mixed Content

Text before and after tag
Hello <span>world</span> there
1     23    4    56    7    8
@1 InlineText
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 Whitespace
@8 InlineText

Adjacent tags
<span>one</span><span>two</span>
1    23   4    56    7  8
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose
@8 InlineText

Multiple tags in sequence
<b>bold</b> and <i>italic</i> text
12 3   4    5   67 8     9    A
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 Whitespace
@6 InlineText
@7 HTMLTagOpen
@8 HTMLTagName
@9 HTMLTagClose
@A InlineText

## Attribute Value Edge Cases

Entity in attribute value
<a title="&copy; 2024">link</a>
12 3    4567      8    9A    BC D E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 EntityNamed
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Percent encoding in URL
<a href="page%20name.html">link</a>
12 3   4567 89  AB    CD    EF G
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 PercentEncoding
@9 HTMLAttributeValue
@A HTMLAttributeQuote
@B HTMLTagClose
@C InlineText
@D HTMLTagOpen
@E HTMLTagName
@F HTMLTagClose

JavaScript in attribute
<button onclick="alert('hi')">Click</button>
12     34      5678           9A    BC     D
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Mixed quotes in attribute
<div title='He said "hello"'>text</div>
12  34    56                78   9
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose
@8 InlineText
@9 HTMLTagOpen

Empty attribute value
<div class="">empty</div>
12  34    5678    9 A  B C
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeQuote
@8 HTMLTagClose
@9 InlineText
@A HTMLTagOpen
@B HTMLTagName
@C HTMLTagClose

Equals with formula
<a data-formula="x==y">link</a>
12 3           4567 89    AB C D
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Special chars in unquoted value
<div id=my_id-123>text</div>
12  34 56        78   9
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose
@8 InlineText
@9 HTMLTagOpen

## Boolean and Valueless Attributes

Boolean attribute
<input checked>
12    34      5
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLTagClose

Multiple boolean attributes
<input disabled readonly required>
12    34       56       78       9
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 Whitespace
@6 HTMLAttributeName
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLTagClose

Boolean with other attributes
<input type="text" required disabled>
12    34   56     78       9A       B
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 Whitespace
@A HTMLAttributeName
@B HTMLTagClose

## Whitespace Variations

Whitespace around equals
<div class = "note">text</div>
12  34    5 67 89    AB    CD E F
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 Whitespace
@6 HTMLAttributeEquals
@7 Whitespace
@8 HTMLAttributeQuote
@9 HTMLAttributeValue
@A HTMLAttributeQuote
@B HTMLTagClose
@C InlineText
@D HTMLTagOpen
@E HTMLTagName
@F HTMLTagClose

Multiple spaces
<div  class="note">text</div>
12  3 4    56789  AB    C D  E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Trailing whitespace in tag
<div class="note" >text</div>
12  34    56     7 89   A
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLTagClose
@9 InlineText
@A HTMLTagOpen

## Self-Closing Variations

Self-closing with space
<br />
12 34
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLTagSelfClosing

Self-closing div (XML-style)
<div/>
12  3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagSelfClosing

Self-closing with attributes
<img src="pic.jpg" alt="Photo" />
12  34  56        78   9       AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLAttributeEquals
@A Whitespace
@B HTMLTagSelfClosing

## Tag Name Variations

Uppercase tag
<DIV>text</DIV>
12  34   56   7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Custom element with hyphen
<my-component>text</my-component>
12           34   56           7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Heading tag with number
<h1>Title</h1>
12 34    56  7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

## Void Elements

Image tag (void element)
<img src="pic.jpg">
12  34  56789      AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Input tag
<input type="text">
12    34   56789  AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

HR tag
<hr>
12 3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose

Meta tag
<meta charset="UTF-8">
12   34      56789    AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Link tag
<link rel="stylesheet" href="style.css">
12   34  567        89A   B C       DE   F
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F HTMLTagClose

## Comment Edge Cases

Comment with greater-than inside
<!-- test > test -->
1   2            3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

Comment with nested markers
<!-- <!-- inner --> -->
1   2                 3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

Multi-line comment
<!-- Line 1
1   2
@1 HTMLCommentOpen
@2 HTMLCommentContent

Line 2 -->

## CDATA Edge Cases

CDATA with bracket sequences
<![CDATA[data]]text]]>
1        2         3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

CDATA with tags inside
<![CDATA[<script>alert()</script>]]>
1        2                       3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

## Adjacent HTML Constructs

Comment and tag adjacent
<!-- comment --><div>text</div>
1   2         3 45   6    78
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen

CDATA and tag
<![CDATA[data]]><p>text</p>
1        2     3 45 6   78
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen

DOCTYPE and tag
<!DOCTYPE html><html>
1        2    3 45   6
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent
@3 HTMLDocTypeClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose

## Raw Text Edge Cases

Script with nested script-like content
<script>var s = "</script>";</script>
12     34                  5 6     7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Style with nested closing tag
<style>content { } </style> ignored</style>
12    34                            5 6    7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Multiple script tags
<script>code1</script><script>code2</script>
12     34    5 6     78      9    A B     C
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose
@B HTMLRawText
@C HTMLTagOpen

Uppercase closing tag in raw text
<script>code</SCRIPT>
12     34   5 6      7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

## Data URIs and Special URLs

Data URI in img
## Data URIs and Special URLs

Data URI in img
<img src="data:image/png;base64,ABC123">
12  34  567                          89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Hash link

Hash link
<a href="#section">link</a>
1234   567       89A   B CD
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Protocol-relative URL
<a href="//example.com">link</a>
1234   567            89A   B CD
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

## Complex Real-World Examples

Complete link with title and class
<a href="page.html" title="Go to page" class="btn">Link</a>
1234   567        89A    BCD         EFG    HIJ  KLM   NOP
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F Whitespace
@G HTMLAttributeName
@H HTMLAttributeEquals
@I HTMLAttributeQuote
@J HTMLAttributeValue
@K HTMLAttributeQuote
@L HTMLTagClose
@M InlineText
@N HTMLTagOpen
@O HTMLTagName
@P HTMLTagClose

Div with data attributes
<div data-id="123" data-name="test">content</div>
12  34      567  89A        BCD   EFG      HIJ
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F HTMLTagClose
@G InlineText
@H HTMLTagOpen
@I HTMLTagName
@J HTMLTagClose

Form with multiple input types
<form><input type="text"><input type="submit"></form>
12   345    67   89A   BCDE    FG   HIJ     KLM N   O
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 Whitespace
@7 HTMLAttributeName
@8 HTMLAttributeEquals
@9 HTMLAttributeQuote
@A HTMLAttributeValue
@B HTMLAttributeQuote
@C HTMLTagClose
@D HTMLTagOpen
@E HTMLTagName
@F Whitespace
@G HTMLAttributeName
@H HTMLAttributeEquals
@I HTMLAttributeQuote
@J HTMLAttributeValue
@K HTMLAttributeQuote
@L HTMLTagClose
@M HTMLTagOpen
@N HTMLTagName
@O HTMLTagClose


12  345   67   8 9   AB C  D
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose

Multiple levels of nesting
<div><p><em>text</em></p></div>
12  34 56  78   9   AB  C  D
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 HTMLTagOpen
@8 HTMLTagName
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName

Nesting with attributes
<div class="outer"><span id="inner">text</span></div>
12  34    56      78    9A BC      DE     F G    H I  J
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose
@8 HTMLTagOpen
@9 HTMLTagName
@A Whitespace
@B HTMLAttributeName
@C HTMLAttributeEquals
@D HTMLAttributeValue
@E HTMLTagClose
@F InlineText
@G HTMLTagOpen
@H HTMLTagName
@I HTMLTagClose

## Markdown Inside HTML

Bold inside tag
<div>**bold** text</div>
12  34 5   6  7   8 9  A
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 AsteriskDelimiter
@5 InlineText
@6 AsteriskDelimiter
@7 Whitespace
@8 InlineText
@9 HTMLTagOpen

Emphasis with entity
<div>&amp; *emphasis* text</div>
12  34    56         78   9 A   B
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 EntityNamed
@5 Whitespace
@6 AsteriskDelimiter
@7 InlineText
@8 AsteriskDelimiter
@9 Whitespace
@A InlineText
@B HTMLTagOpen

Code inside HTML
<p>`code` text</p>
12 34    56   7  8 9
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 BacktickBoundary
@5 InlineCode
@6 BacktickBoundary
@7 Whitespace
@8 InlineText
@9 HTMLTagOpen

## HTML Inside Markdown

Tag inside emphasis
**<span>text</span>**
1 23    4   5 6    78
@1 AsteriskDelimiter
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 HTMLTagName

Tag inside strikethrough
~~<del>text</del>~~
1 2   34   5   6 7 8
@1 TildeDelimiter
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 HTMLTagName

## Mixed Content

Text before and after tag
Hello <span>world</span> there
1     234   56    7 8   9AB    C
@1 InlineText
@2 HTMLTagOpen
@3 HTMLTagName
@4 HTMLTagClose
@5 InlineText
@6 HTMLTagOpen
@7 HTMLTagName
@8 HTMLTagClose
@9 HTMLTagName
@A HTMLTagClose
@B Whitespace
@C InlineText

Adjacent tags
<span>one</span><span>two</span>
12   34   5 6   789   AB  C D   EF
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagName
@8 HTMLTagClose
@9 HTMLTagOpen
@A HTMLTagName
@B HTMLTagClose
@C InlineText
@D HTMLTagOpen
@E HTMLTagName
@F HTMLTagClose

Multiple tags in sequence
<b>bold</b> and <i>italic</i> text
1234   5 6   78  9 AB CDEFGH I  JK    L
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose
@8 Whitespace
@9 InlineText
@A Whitespace
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose
@E InlineText
@F HTMLTagOpen
@G HTMLTagName
@H HTMLTagClose
@I Whitespace
@J InlineText
@K Whitespace
Entity in attribute value
<a title="&copy; 2024">link</a>
12 3    45 6   7 8   9A    BC D E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 EntityNamed
@8 HTMLAttributeValue
@9 HTMLAttributeQuote
@A HTMLTagClose
@B InlineText
@C HTMLTagOpen
@D HTMLTagName
@E HTMLTagClose

Percent encoding in URL
<a href="page%20name.html">link</a>
12 3   45 6  78  9   A    BC    DE F G
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 PercentEncoding
@9 HTMLAttributeValue
@A HTMLAttributeQuote
@B HTMLTagClose
@C InlineText
@D HTMLTagOpen
@E HTMLTagName
@F HTMLTagClose

JavaScript in attribute
<button onclick="alert('hi')">Click</button>
12     34      56 7          89    AB     C D     E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose
@E HTMLTagClose

Mixed quotes in attribute
<div title='He said "hello"'>text</div>
12  34    56 7              89   A B  C D
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Empty attribute value
<div class="">empty</div>
12  34    56 78    9 A  B C
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeQuote
@8 HTMLTagClose
@9 InlineText
@A HTMLTagOpen
@B HTMLTagName
@C HTMLTagClose

Equals with formula
<a data-formula="x==y">link</a>
12 3           45 6  78    9A B C
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Special chars in unquoted value
<div id=my_id-123>text</div>
12  34 56         78   9 A  B
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 HTMLTagClose
@8 InlineText
@9 HTMLTagOpen
@A HTMLTagName
@B HTMLTagClose

## Boolean and Valueless Attributes

Boolean attribute
<input checked>
12    34      5
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLTagClose

Multiple boolean attributes
<input disabled readonly required>
12    34       56       78       9
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 Whitespace
@6 HTMLAttributeName
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLTagClose

Boolean with other attributes
<input type="text" required disabled>
12    34   56     78       9A       B
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 Whitespace
@A HTMLAttributeName
@B HTMLTagClose

## Whitespace Variations
Whitespace around equals
<div class = "note">text</div>
12  34    5 67 8   9A    BC D E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 Whitespace
@6 HTMLAttributeEquals
@7 Whitespace
@8 HTMLAttributeQuote
@9 HTMLAttributeValue
@A HTMLAttributeQuote
@B HTMLTagClose
@C InlineText
@D HTMLTagOpen
@E HTMLTagName
@F HTMLTagClose

Multiple spaces
<div  class="note">text</div>
12  3 4    56 7   89    A B  C
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Trailing whitespace in tag
Trailing whitespace in tag
<div class="note" >text</div>
12  34    56 7   89 A    BC D E
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLTagClose
@B InlineText
@C HTMLTagOpen
@D HTMLTagName
@E HTMLTagClose

## Self-Closing Variations

Self-closing with space
<br />
12 34
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLTagSelfClosing

Self-closing div (XML-style)
<div/>
12  3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagSelfClosing

Self-closing with attributes
<img src="pic.jpg" alt="Photo" />
12  34  56 7     89   AB C   DE F G
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F Whitespace
@G HTMLTagSelfClosing

## Tag Name Variations

Uppercase tag
<DIV>text</DIV>
12  34   5 6  7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Custom element with hyphen
<my-component>text</my-component>
12           34   5 6           7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Heading tag with number
<h1>Title</h1>
12 34    5 6  7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 InlineText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

## Void Elements

Image tag (void element)
<img src="pic.jpg">
12  34  56789      AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Input tag
<input type="text">
12    34   56789  AB
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

HR tag
<hr>
12 3
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose

Meta tag
<meta charset="UTF-8">
12   34      567     89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose

Link tag
Link tag
<link rel="stylesheet" href="style.css">
12   34  567        89A   B C       DE   F
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F HTMLTagClose

## HTML Comments
@F HTMLTagCloses
@6 HTMLAttributeValue
@7 Whitespace
@8 HTMLAttributeName
@9 HTMLAttributeEquals
@A HTMLAttributeValue

## Comment Edge Cases

Comment with greater-than inside
<!-- test > test -->
1   2            3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

Comment with nested markers
<!-- <!-- inner --> -->
1   2                  3
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose

Multi-line comment
<!-- Line 1
1   2
@1 HTMLCommentOpen
@2 HTMLCommentContent

Line 2 -->

## CDATA Edge Cases

CDATA with bracket sequences
<![CDATA[data]]text]]>
1        2         3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

CDATA with tags inside
<![CDATA[<script>alert()</script>]]>
1        2                       3
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose

## Adjacent HTML Constructs

Comment and tag adjacent
<!-- comment --><div>text</div>
1   2         3 45   6   7 8   9 A
@1 HTMLCommentOpen
@2 HTMLCommentContent
@3 HTMLCommentClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose

CDATA and tag
<![CDATA[data]]><p>text</p>
1        2     3 45 6   7 8   9 A
@1 HTMLCDataOpen
@2 HTMLCDataContent
@3 HTMLCDataClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose
@7 InlineText
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose

DOCTYPE and tag
<!DOCTYPE html><html>
1        2    3 45   6
@1 HTMLDocTypeOpen
@2 HTMLDocTypeContent
@3 HTMLDocTypeClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 HTMLTagClose

## Raw Text Edge Cases

Script with nested script-like content
<script>var s = "</script>";</script>
12     34                   5 6      7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Style with nested closing tag
<style>content { } </style> ignored</style>
12    34                             5 6     7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose

Multiple script tags
<script>code1</script><script>code2</script>
12     34    5 6     78      9     A B     C
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
@6 HTMLTagName
@7 HTMLTagClose
@8 HTMLTagOpen
@9 HTMLTagName
@A HTMLTagClose
@B HTMLRawText
@C HTMLTagOpen

Uppercase closing tag in raw text
<script>code</SCRIPT>
12     34   5 6      7
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLRawText
@5 HTMLTagOpen
Data URI in img
<img src="data:image/png;base64,ABC123">
12  34  567                          89
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeValue
Hash link
<a href="#section">link</a>
1234   567       89A   B CD
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

Protocol-relative URL
<a href="//example.com">link</a>
1234   567            89A   B CD
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 HTMLTagClose
@A InlineText
@B HTMLTagOpen
@C HTMLTagName
@D HTMLTagClose

## Complex Real-World Examples

Complete link with title and class
<a href="page.html" title="Go to page" class="btn">Link</a>
12 3   45 6       78 9    AB C         DE F    GH I  JK    LM
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F Whitespace
@G HTMLAttributeName
Div with data attributes
<div data-id="123" data-name="test">content</div>
12  34      567 89   AB        CD E  FG      HIJ
@1 HTMLTagOpen
@2 HTMLTagName
@3 Whitespace
@4 HTMLAttributeName
@5 HTMLAttributeEquals
@6 HTMLAttributeQuote
@7 HTMLAttributeValue
@8 HTMLAttributeQuote
@9 Whitespace
@A HTMLAttributeName
@B HTMLAttributeEquals
@C HTMLAttributeQuote
@D HTMLAttributeValue
@E HTMLAttributeQuote
@F HTMLTagClose
@G InlineText
@H HTMLTagOpen
@I HTMLTagName
@J HTMLTagClose
Form with multiple input types
<form><input type="text"><input type="submit"></form>
12   345    67   89A   BCDE    FG   HIJ     KLM N   O
@1 HTMLTagOpen
@2 HTMLTagName
@3 HTMLTagClose
@4 HTMLTagOpen
@5 HTMLTagName
@6 Whitespace
@7 HTMLAttributeName
@8 HTMLAttributeEquals
@9 HTMLAttributeQuote
@A HTMLAttributeValue
@B HTMLAttributeQuote
@C HTMLTagClose
@D HTMLTagOpen
@E HTMLTagName
@F Whitespace
@G HTMLAttributeName
@H HTMLAttributeEquals
@I HTMLAttributeQuote
@J HTMLAttributeValue
@K HTMLAttributeQuote
@L HTMLTagClose
@M HTMLTagOpen
@N HTMLTagName
@O HTMLTagClose

## Known Issues & Open Questions

### Script Tag Entity Tokenization  
The test "Script with entity" currently shows entities (`&lt;`, `&gt;`) tokenized inside `<script>` tags. However, browsers do NOT decode HTML entities in script content. This test needs review:
- Should the scanner tokenize entities for editor purposes (syntax highlighting, navigation)?
- Or should it match browser behavior and treat script content as opaque HTMLRawText?
- Current implementation: Tokenizes entities (may be incorrect per HTML spec)

### Self-closing Tag Position Markers
Some self-closing variations ("Self-closing with space" at `<br />`) need corrected position markers after implementing the new token structure.

### Duplicate Test Sections
The "Nested Elements" section appears duplicated around line 359. One instance should be removed to maintain test file integrity.