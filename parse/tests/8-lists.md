# List Tests

## Simple bullet lists

Basic bullet with dash:
- item 1
1 2
@1 BulletListMarker "-"
@2 InlineText "item 1"

Basic bullet with asterisk:
* item 1
1 2
@1 BulletListMarker "*"
@2 InlineText "item 1"

Basic bullet with plus:
+ item 1
1 2
@1 BulletListMarker "+"
@2 InlineText "item 1"

Multiple items:
- item 1
- item 2
- item 3
1 2
@1 BulletListMarker "-"
@2 InlineText "item 3"

## Simple ordered lists

Basic ordered with period:
1. first
1  2
@1 OrderedListMarker "1."
@2 InlineText "first"

Basic ordered with parenthesis:
1) first
1  2
@1 OrderedListMarker "1)"
@2 InlineText "first"

Multiple digit number:
123. item
1    2
@1 OrderedListMarker "123."
@2 InlineText "item"

## Task lists

Unchecked task:
## Task checkbox unchecked

```input
- [ ] todo
```

```position
1 2   3
```

```output
@0 BulletListMarker "-"
@2 TaskListMarker "[ ]"
@6 InlineText "todo"
```

Checked task lowercase:
## Task checkbox checked lowercase x

```input
- [x] done
```

```position
1 2   3
```

```output
@0 BulletListMarker "-"
@2 TaskListMarker "[x]"
@6 InlineText "done"
```

Checked task uppercase:
## Task checkbox checked uppercase X

```input
- [X] done
```

```position
1 2   3
```

```output
@0 BulletListMarker "-"
@2 TaskListMarker "[X]"
@6 InlineText "done"
```

## Not list markers

Dash without space:
-item
1
@1 InlineText "-item"

Asterisk without space:
*item
12
@0 AsteriskDelimiter "*"
@1 InlineText "item"

Number without delimiter:
123 item
1
@1 InlineText "123 item"

Number with wrong delimiter:
1: item
1
@1 InlineText "1: item"
