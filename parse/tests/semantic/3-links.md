# Link Resolution

The semantic scanner recognizes LinkOpen, LinkClose, LinkDestOpen, and LinkDestClose 
and resolves them into resolved link/image structures.

## Basic link

[text](url)
12    34   5
@1 LinkOpen "["
@2 InlineText "text"
@3 LinkDestOpen "("
@4 InlineText "url"
@5 NewLine "\n"

## Image

![alt](img.jpg)
1 2    3       4
@1 ImageMarker "!"
@2 InlineText "alt"
@3 InlineText "img.jpg"
@4 NewLine "\n"

## Nested links demotion

Outer link takes precedence over inner link. 
Inner link tags are demoted to InlineText.

[outer [inner](url)]()
12                 345
@1 LinkOpen "["
@2 InlineText "outer"
@3 LinkClose "]"
@4 LinkDestOpen "("
@5 LinkDestClose ")"
