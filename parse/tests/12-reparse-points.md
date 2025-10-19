# Reparse Points

## Start of file

Hello
1
@1 InlineText|IsSafeReparsePoint "Hello"

## Blank line creates safe reparse point

Text after a blank line should have IsSafeReparsePoint flag.

First paragraph
1

Second paragraph
1
@1 InlineText|IsSafeReparsePoint "Second paragraph"
<-- EOF

## Multiple blank lines

Multiple consecutive newlines still create safe reparse point.

First
1


Second
1
@1 InlineText|IsSafeReparsePoint "Second"
<-- EOF

## Whitespace-only line is not a blank line

Whitespace before content doesn't prevent blank line detection.

First
1

 Second
12
@1 Whitespace|IsSafeReparsePoint
@2 InlineText "Second"
<-- EOF

## No reparse point without blank line

Single newline doesn't create reparse point.

First
1
Second
1
@1 InlineText "Second"
<-- EOF

## Reparse after entity

Entity after blank line gets reparse flag.

First
1

&amp;
1
@1 EntityNamed|IsSafeReparsePoint
<-- EOF

## Reparse after emphasis

Emphasis delimiter after blank line gets reparse flag.

First
1

*bold*
1
@1 AsteriskDelimiter|IsSafeReparsePoint
<-- EOF

## Reparse after HTML tag

HTML tag after blank line gets reparse flag.

First
1

<div>
1
@1 HTMLTagOpen|IsSafeReparsePoint
<-- EOF

## Reparse after list marker

List marker after blank line gets reparse flag.

First
1

- Item
1
@1 BulletListMarker|IsSafeReparsePoint
<-- EOF

## Reparse after code fence

Code fence after blank line gets reparse flag.

First
1

```
1
@1 FencedOpen|ErrorUnbalancedToken|IsSafeReparsePoint
<-- EOF

## No reparse during error recovery

When ErrorUnbalancedToken is set, no reparse points should be created.

<!-- unclosed comment

Text after error
1
@1 InlineText "Text after error"
<-- EOF
