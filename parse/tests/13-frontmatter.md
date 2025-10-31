# Frontmatter Tests

Comprehensive tests for YAML, TOML, and JSON frontmatter blocks.

## YAML Frontmatter - Basic

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

## YAML Frontmatter - With Content

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

## YAML Frontmatter - Empty

---
1
@1 FrontmatterOpen
---
1
@1 FrontmatterClose

<--EOF

## YAML Frontmatter - Multiline Content

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

## TOML Frontmatter - Basic

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

## TOML Frontmatter - With Content

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

## TOML Frontmatter - Empty

+++
1
@1 FrontmatterOpen
+++
1
@1 FrontmatterClose

<--EOF

## JSON Frontmatter - Basic

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

## JSON Frontmatter - With Content

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

## JSON Frontmatter - Nested Objects

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

## YAML Frontmatter - Followed by Content

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
@1 NewLine
@2 ATXHeadingOpen "#"

<--EOF

## Invalid - Four Dashes (Not Frontmatter)

----
1
@1 InlineText "----"

<--EOF

## Invalid - Two Dashes (Not Frontmatter)

--
1
@1 InlineText "--"

<--EOF

## Invalid - Not at Position 0

Some text
---
1
@1 InlineText "Some text"

<--EOF

## YAML Frontmatter - With Trailing Spaces

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

## YAML Frontmatter - Unclosed (EOF)

---
1
@1 FrontmatterOpen|ErrorUnbalancedToken
title: "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "title: \"Test\"\n"

<--EOF

## TOML Frontmatter - Unclosed (EOF)

+++
1
@1 FrontmatterOpen|ErrorUnbalancedToken
title = "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "title = \"Test\"\n"

<--EOF

## JSON Frontmatter - Unclosed (EOF)

{
1
@1 FrontmatterOpen|ErrorUnbalancedToken
  "title": "Test"
1
@1 FrontmatterContent|ErrorUnbalancedToken "  \"title\": \"Test\"\n"

<--EOF

## YAML Frontmatter - Contains Fence-like Content

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

## TOML Frontmatter - Contains Fence-like Content

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

## JSON Frontmatter - With Escaped Quotes

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

## Invalid - Content After Opening Fence on Same Line

--- invalid
1
@1 InlineText "--- invalid"

<--EOF

## Invalid - Content After Opening TOML Fence

+++ invalid
1
@1 InlineText "+++ invalid"

<--EOF

## YAML with Blank Lines in Content

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

<--EOF
