# Frontmatter Tests

Comprehensive tests for YAML, TOML, and JSON frontmatter blocks.

## YAML Frontmatter - Basic
<--EOF
---
1
@1 FrontmatterOpen
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
title: "Document Title"
author: "Author Name"
date: 2025-10-31
1
@1 FrontmatterContent "title: \"Document Title\"\nauthor: \"Author Name\"\ndate: 2025-10-31\n"
---
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
---
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
title: "Test"
tags:
  - markdown
  - parser
description: |
  This is a multiline
  description block
1
@1 FrontmatterContent "title: \"Test\"\ntags:\n  - markdown\n  - parser\ndescription: |\n  This is a multiline\n  description block\n"
---
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
title = "Test"
1
@1 FrontmatterContent "title = \"Test\"\n"
+++
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
title = "Document Title"
author = "Author Name"
date = 2025-10-31
1
@1 FrontmatterContent "title = \"Document Title\"\nauthor = \"Author Name\"\ndate = 2025-10-31\n"
+++
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
+++
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "title": "Test"
1
@1 FrontmatterContent "  \"title\": \"Test\"\n"
}
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "title": "Document Title",
  "author": "Author Name",
  "date": "2025-10-31",
  "tags": ["markdown", "parser"]
1
@1 FrontmatterContent "  \"title\": \"Document Title\",\n  \"author\": \"Author Name\",\n  \"date\": \"2025-10-31\",\n  \"tags\": [\"markdown\", \"parser\"]\n"
}
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "meta": {
    "title": "Test",
    "author": "Name"
  },
  "tags": ["a", "b"]
1
@1 FrontmatterContent "  \"meta\": {\n    \"title\": \"Test\",\n    \"author\": \"Name\"\n  },\n  \"tags\": [\"a\", \"b\"]\n"
}
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose

# Heading
123
@1 ATXHeadingOpen "#"
@2 Whitespace " "
@3 InlineText "Heading"

<--EOF
----
1
@1 InlineText "----"

<--EOF
--
1
@1 InlineText "--"

<--EOF
Some text before
1
@1 InlineText "Some text before"
---
1
@1 SetextHeadingUnderline

<--EOF
---   
1
@1 FrontmatterOpen
content: "test"
1
@1 FrontmatterContent "content: \"test\"\n"
---   
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen|ErrorUnbalancedToken
title: "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "title: \"Test\"\n"

<--EOF
+++
1
@1 FrontmatterOpen|ErrorUnbalancedToken
title = "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "title = \"Test\"\n"

<--EOF
{
1
@1 FrontmatterOpen|ErrorUnbalancedToken
  "title": "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "  \"title\": \"Test\"\n"

<--EOF
---
1
@1 FrontmatterOpen
description: "---"
note: "This has --- in content"
1
@1 FrontmatterContent "description: \"---\"\nnote: \"This has --- in content\"\n"
---
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
description = "+++"
note = "This has +++ in content"
1
@1 FrontmatterContent "description = \"+++\"\nnote = \"This has +++ in content\"\n"
+++
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "text": "She said \"hello\""
1
@1 FrontmatterContent "  \"text\": \"She said \\\"hello\\\"\"\n"
}
1
@1 FrontmatterClose

<--EOF
--- invalid
1
@1 InlineText "--- invalid"

<--EOF
+++ invalid
1
@1 InlineText "+++ invalid"

<--EOF
---
1
@1 FrontmatterOpen
title: "Test"

author: "Name"
1
@1 FrontmatterContent "title: \"Test\"\n\nauthor: \"Name\"\n"
---
1
@1 FrontmatterClose
