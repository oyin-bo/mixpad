# Front Matter Tests

Comprehensive tests for YAML, TOML, and JSON front matter blocks.

## Test Cases

This file tests frontmatter scanning for YAML (`---`), TOML (`+++`), and JSON (`{`) formats.
Each test case is separated by `<--EOF` markers to ensure frontmatter is at position 0.

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
tags: [markdown, parser]
1
@1 FrontmatterContent "title: \"Document Title\"\nauthor: \"Author Name\"\ndate: 2025-10-31\ntags: [markdown, parser]\n"
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
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose
# Heading
12
@1 ATXHeadingOpen
@2 Whitespace

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
tags = ["markdown", "parser"]
1
@1 FrontmatterContent "title = \"Document Title\"\nauthor = \"Author Name\"\ndate = 2025-10-31\ntags = [\"markdown\", \"parser\"]\n"
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
}
1
@1 FrontmatterClose

<--EOF
Text before
1
@1 InlineText
---
1
@1 SetextHeadingUnderline

<--EOF
----
1
@1 InlineText
content
1
@1 InlineText

<--EOF
--- invalid
1
@1 InlineText

<--EOF
Text before
+++
1
@1 InlineText

<--EOF
Text before
{
1
@1 InlineText

<--EOF
---
1
@1 FrontmatterOpen
title: "Test"

description: "Multi-line"
1
@1 FrontmatterContent "title: \"Test\"\n\ndescription: \"Multi-line\"\n"
---
1
@1 FrontmatterClose

<--EOF
---
1
@1 FrontmatterOpen
nested:
  key: value
  array:
    - item1
    - item2
1
@1 FrontmatterContent "nested:\n  key: value\n  array:\n    - item1\n    - item2\n"
---
1
@1 FrontmatterClose

<--EOF
+++
1
@1 FrontmatterOpen
[section]
key = "value"
1
@1 FrontmatterContent "[section]\nkey = \"value\"\n"
+++
1
@1 FrontmatterClose

<--EOF
{
1
@1 FrontmatterOpen
  "meta": {
    "title": "Test",
    "nested": {
      "deep": "value"
    }
  }
1
@1 FrontmatterContent "  \"meta\": {\n    \"title\": \"Test\",\n    \"nested\": {\n      \"deep\": \"value\"\n    }\n  }\n"
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

<--EOF
