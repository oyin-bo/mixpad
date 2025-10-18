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

Bullet with multiple spaces after marker:
-   item with spaces
1   2
@1 BulletListMarker "-"
@2 InlineText "item with spaces"

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

Ordered with different start number:
5. item
1  2
@1 OrderedListMarker "5."
@2 InlineText "item"

Multiple digit number:
123. item
1    2
@1 OrderedListMarker "123."
@2 InlineText "item"

Ordered with multiple spaces after marker:
1.   item with spaces
1    2
@1 OrderedListMarker "1."
@2 InlineText "item with spaces"

Maximum allowed digits (9 digits):
123456789. item
1          2
@1 OrderedListMarker "123456789."
@2 InlineText "item"

## Task lists

Unchecked task:
- [ ] todo
1 2   3
@1 BulletListMarker "-"
@2 TaskListMarker "[ ]"
@3 InlineText "todo"

Checked task lowercase:
- [x] done
1 2   3
@1 BulletListMarker "-"
@2 TaskListMarker "[x]"
@3 InlineText "done"

Checked task uppercase:
- [X] done
1 2   3
@1 BulletListMarker "-"
@2 TaskListMarker "[X]"
@3 InlineText "done"

Task with asterisk bullet:
* [ ] task
1 2   3
@1 BulletListMarker "*"
@2 TaskListMarker "[ ]"
@3 InlineText "task"

Task with plus bullet:
+ [x] task
1 2   3
@1 BulletListMarker "+"
@2 TaskListMarker "[x]"
@3 InlineText "task"

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

Plus without space:
+item
1
@1 InlineText "+item"

Number without space after delimiter:
1.item
1
@1 InlineText "1.item"

Number paren without space:
1)item
1
@1 InlineText "1)item"

Too many digits (10 digits):
1234567890. item
1
@1 InlineText "1234567890. item"

Indented 4 spaces (code block, not list):
    - item
1   2
@1 Whitespace "    "
@2 InlineText "- item"

Task checkbox without bullet:
[ ] not a task
1   2
@1 TaskListMarker "[ ]"
@2 InlineText "not a task"

Task checkbox not followed by space:
- [ ]x invalid
1 2
@1 BulletListMarker "-"
@2 InlineText "[ ]x invalid"

Task checkbox with invalid character:
- [y] invalid
1 2
@1 BulletListMarker "-"
@2 InlineText "[y] invalid"
