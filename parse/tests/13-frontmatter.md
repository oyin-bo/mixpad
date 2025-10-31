# Front Matter Tests

Comprehensive tests for YAML, TOML, and JSON front matter parsing.

## YAML Front Matter - Basic

Valid YAML at position 0
---
1
@1 FrontmatterOpen "---"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose "---"

## YAML Front Matter - Empty

Empty YAML frontmatter
---
1
@1 FrontmatterOpen "---"
---
1
@1 FrontmatterClose "---"

## YAML Front Matter - Multiple Lines

YAML with multiple fields
---
1
@1 FrontmatterOpen "---"
title: "Document Title"
author: "Author Name"
date: 2025-10-31
tags: [markdown, parser]
1
@1 FrontmatterContent "title: \"Document Title\"\nauthor: \"Author Name\"\ndate: 2025-10-31\ntags: [markdown, parser]\n"
---
1
@1 FrontmatterClose "---"

## YAML Front Matter - With Content After

YAML frontmatter followed by content
---
1
@1 FrontmatterOpen "---"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose "---"
# Content starts here
1
@1 ATXHeadingOpen "#"

## TOML Front Matter - Basic

Valid TOML at position 0
+++
1
@1 FrontmatterOpen "+++"
title = "Test"
1
@1 FrontmatterContent "title = \"Test\"\n"
+++
1
@1 FrontmatterClose "+++"

## TOML Front Matter - Empty

Empty TOML frontmatter
+++
1
@1 FrontmatterOpen "+++"
+++
1
@1 FrontmatterClose "+++"

## TOML Front Matter - Multiple Lines

TOML with multiple fields
+++
1
@1 FrontmatterOpen "+++"
title = "Document Title"
author = "Author Name"
date = 2025-10-31
tags = ["markdown", "parser"]
1
@1 FrontmatterContent "title = \"Document Title\"\nauthor = \"Author Name\"\ndate = 2025-10-31\ntags = [\"markdown\", \"parser\"]\n"
+++
1
@1 FrontmatterClose "+++"

## JSON Front Matter - Basic

Valid JSON at position 0
{
1
@1 FrontmatterOpen "{"
  "title": "Test"
}
12
@1 FrontmatterContent "  \"title\": \"Test\"\n"
@2 FrontmatterClose "}"

## JSON Front Matter - Empty Object

Empty JSON frontmatter
{
1
@1 FrontmatterOpen "{"
}
1
@1 FrontmatterClose "}"

## JSON Front Matter - Multiple Fields

JSON with multiple fields
{
1
@1 FrontmatterOpen "{"
  "title": "Document Title",
  "author": "Author Name",
  "date": "2025-10-31",
  "tags": ["markdown", "parser"]
}
12
@1 FrontmatterContent "  \"title\": \"Document Title\",\n  \"author\": \"Author Name\",\n  \"date\": \"2025-10-31\",\n  \"tags\": [\"markdown\", \"parser\"]\n"
@2 FrontmatterClose "}"

## Invalid Cases - Not at Position 0

YAML not at start (with leading space)
 ---
1
@1 Whitespace " "
title: test
1
@1 InlineText "---"

YAML not at start (after newline)

---
1
@1 NewLine "\n"
title: test
1
@1 InlineText "---"

## Invalid Cases - Four Dashes

Four dashes is not valid frontmatter
----
1
@1 InlineText "----"
title: test
1
@1 InlineText "title: test"

## Invalid Cases - Content After Opening Fence

YAML with content on same line as opener
--- title
1
@1 InlineText "--- title"

TOML with content on same line as opener
+++ title
1
@1 InlineText "+++ title"

## Invalid Cases - Unclosed Front Matter

Unclosed YAML frontmatter
---
1
@1 FrontmatterOpen "---"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"

## Edge Cases - Fence-like Sequences in Content

YAML with --- in content
---
1
@1 FrontmatterOpen "---"
title: "Test with --- in it"
1
@1 FrontmatterContent "title: \"Test with --- in it\"\n"
---
1
@1 FrontmatterClose "---"

TOML with +++ in content
+++
1
@1 FrontmatterOpen "+++"
title = "Test with +++ in it"
1
@1 FrontmatterContent "title = \"Test with +++ in it\"\n"
+++
1
@1 FrontmatterClose "+++"

## Edge Cases - Blank Lines in Content

YAML with blank lines
---
1
@1 FrontmatterOpen "---"
title: "Test"

author: "Name"
1
@1 FrontmatterContent "title: \"Test\"\n\nauthor: \"Name\"\n"
---
1
@1 FrontmatterClose "---"

## Edge Cases - Indentation in Content

YAML with indented content
---
1
@1 FrontmatterOpen "---"
nested:
  key: value
  another: data
1
@1 FrontmatterContent "nested:\n  key: value\n  another: data\n"
---
1
@1 FrontmatterClose "---"
