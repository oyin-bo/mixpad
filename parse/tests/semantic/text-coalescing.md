# Semantic Text Coalescing

The semantic scanner coalesces adjacent InlineText tokens, and demoted
delimiter placeholders are merged with surrounding text.

## Plain text passes through unchanged

Hello world
1
@1 InlineText "Hello world"

Single tilde is plain text (scan0 does not emit a delimiter for run of 1):
~word
1
@1 InlineText "~word"

Entity tokens pass through from scan0 unchanged:
&amp;
1
@1 EntityNamed "&amp;"

<--EOF

## Unmatched opener coalesces with following text (isolated section)

*notclosed
1
@1 InlineText "*notclosed"

<--EOF

## Unmatched closer coalesces with preceding text (isolated section)

notclosed*
1
@1 InlineText "notclosed*"

<--EOF

## Multiple consecutive unmatched openers coalesce (isolated section)

Each opener-group coalesces with its following text; the Whitespace token
separating them prevents merging into a single token:
*one *two
1    2
@1 InlineText "*one"
@2 InlineText "*two"
