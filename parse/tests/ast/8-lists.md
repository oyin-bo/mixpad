# List Tests

## Simple bullet lists

Basic bullet with dash:
- item 1
1 2
@1 ListItemNode
@2 TextNode text="item 1"

Basic bullet with asterisk:
* item 1
1 2
@1 ListItemNode
@2 TextNode text="item 1"

Basic bullet with plus:
+ item 1
1 2
@1 ListItemNode
@2 TextNode text="item 1"

Bullet with multiple spaces after marker:
-   item with spaces
1   2
@1 ListItemNode
@2 TextNode text="item with spaces"

Multiple items:
- item 1
- item 2
- item 3
1 2
@1 ListItemNode
@2 TextNode text="item 3"

## Simple ordered lists

Basic ordered with period:
1. first
1  2
@1 ListItemNode
@2 TextNode text="first"

Basic ordered with parenthesis:
1) first
1  2
@1 ListItemNode
@2 TextNode text="first"

Ordered with different start number:
5. item
1  2
@1 ListItemNode
@2 TextNode text="item"

Multiple digit number:
123. item
1    2
@1 ListItemNode
@2 TextNode text="item"

Ordered with multiple spaces after marker:
1.   item with spaces
1    2
@1 ListItemNode
@2 TextNode text="item with spaces"

Maximum allowed digits (9 digits):
123456789. item
1          2
@1 ListItemNode
@2 TextNode text="item"

## Task lists

Unchecked task:
- [ ] todo
1 2   3
@1 ListItemNode
@2 ListItemNode
@3 TextNode text="todo"

Checked task lowercase:
- [x] done
1 2   3
@1 ListItemNode
@2 ListItemNode
@3 TextNode text="done"

Checked task uppercase:
- [X] done
1 2   3
@1 ListItemNode
@2 ListItemNode
@3 TextNode text="done"

Task with asterisk bullet:
* [ ] task
1 2   3
@1 ListItemNode
@2 ListItemNode
@3 TextNode text="task"

Task with plus bullet:
+ [x] task
1 2   3
@1 ListItemNode
@2 ListItemNode
@3 TextNode text="task"

## Not list markers

Dash without space:
-item
1
@1 TextNode text="-item"

Asterisk without space:
*item
12
@1 TextNode text="*item"

Number without delimiter:
123 item
1
@1 TextNode text="123 item"

Number with wrong delimiter:
1: item
1
@1 TextNode text="1: item"

Plus without space:
+item
1
@1 TextNode text="+item"

Number without space after delimiter:
1.item
1
@1 TextNode text="1.item"

Number paren without space:
1)item
123
@1 TextNode text="1"
@2 BaseNode
@3 TextNode text="item"

Too many digits (10 digits):
1234567890. item
1
@1 TextNode text="1234567890. item"

Indented 4 spaces (code block, not list):
    - item
1   2
@1 TextNode text="    "
@2 TextNode text="- item"

Task checkbox without bullet:
[ ] not a task
1   2
@1 ListItemNode
@2 TextNode text="not a task"

Task checkbox not followed by space:
- [ ]x invalid
1 2 34
@1 ListItemNode
@2 LinkNode text="[ ]"
@3 BaseNode
@4 TextNode text="x invalid"

Task checkbox with invalid character:
- [y] invalid
1 234 5
@1 ListItemNode
@2 LinkNode text="[y]"
@3 TextNode text="y"
@4 BaseNode
@5 TextNode text="invalid"