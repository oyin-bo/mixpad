# Front Matter Tests

Comprehensive tests for YAML, TOML, and JSON front matter parsing.

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Document Title"
author: "Author Name"
date: 2025-10-31
tags: [markdown, parser]
1
@1 FrontmatterContent "title: \"Document Title\"\nauthor: \"Author Name\"\ndate: 2025-10-31\ntags: [markdown, parser]\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose "---\n"
# Content starts here
12
@1 ATXHeadingOpen "#"
@2 Whitespace " "

<--EOF
+++
1
@1 FrontmatterOpen "+++\n"
title = "Test"
1
@1 FrontmatterContent "title = \"Test\"\n"
+++
1
@1 FrontmatterClose "+++\n"

<--EOF
+++
1
@1 FrontmatterOpen "+++\n"
+++
1
@1 FrontmatterClose "+++\n"

<--EOF
+++
1
@1 FrontmatterOpen "+++\n"
title = "Document Title"
author = "Author Name"
date = 2025-10-31
tags = ["markdown", "parser"]
1
@1 FrontmatterContent "title = \"Document Title\"\nauthor = \"Author Name\"\ndate = 2025-10-31\ntags = [\"markdown\", \"parser\"]\n"
+++
1
@1 FrontmatterClose "+++\n"

<--EOF
{
1
@1 FrontmatterOpen "{"
  "title": "Test"
1
@1 FrontmatterContent "\n  \"title\": \"Test\"\n"
}
1
@1 FrontmatterClose "}"

<--EOF
{
1
@1 FrontmatterOpen "{"
}
1
@1 FrontmatterClose "}"

<--EOF
{
1
@1 FrontmatterOpen "{"
  "title": "Document Title",
  "author": "Author Name",
  "date": "2025-10-31",
  "tags": ["markdown", "parser"]
1
@1 FrontmatterContent "\n  \"title\": \"Document Title\",\n  \"author\": \"Author Name\",\n  \"date\": \"2025-10-31\",\n  \"tags\": [\"markdown\", \"parser\"]\n"
}
1
@1 FrontmatterClose "}"

<--EOF
 ---
1
@1 Whitespace " "

<--EOF

---
1
@1 InlineText "---"

<--EOF
----
1
@1 InlineText "----"

<--EOF
--- title
1
@1 InlineText "--- title"

<--EOF
+++ title
1
@1 InlineText "+++ title"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Test with --- in it"
1
@1 FrontmatterContent "title: \"Test with --- in it\"\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
+++
1
@1 FrontmatterOpen "+++\n"
title = "Test with +++ in it"
1
@1 FrontmatterContent "title = \"Test with +++ in it\"\n"
+++
1
@1 FrontmatterClose "+++\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
title: "Test"

author: "Name"
1
@1 FrontmatterContent "title: \"Test\"\n\nauthor: \"Name\"\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
nested:
  key: value
  another: data
1
@1 FrontmatterContent "nested:\n  key: value\n  another: data\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
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
@1 FrontmatterClose "---\n"

<--EOF
{
1
@1 FrontmatterOpen "{"
  "text": "She said \"hello\""
1
@1 FrontmatterContent "\n  \"text\": \"She said \\\"hello\\\"\"\n"
}
1
@1 FrontmatterClose "}"

<--EOF
---
1
@1 FrontmatterOpen "---\n"
description: "---"
note: "This has --- in content"
1
@1 FrontmatterContent "description: \"---\"\nnote: \"This has --- in content\"\n"
---
1
@1 FrontmatterClose "---\n"

<--EOF
+++
1
@1 FrontmatterOpen "+++\n"
description = "+++"
note = "This has +++ in content"
1
@1 FrontmatterContent "description = \"+++\"\nnote = \"This has +++ in content\"\n"
+++
1
@1 FrontmatterClose "+++\n"

<--EOF
--- invalid
1
@1 InlineText "--- invalid"

<--EOF
+++ invalid
1
@1 InlineText "+++ invalid"
