# Front Matter Tests

Comprehensive tests for YAML, TOML, and JSON front matter blocks.

## YAML Front Matter - Basic

Valid YAML front matter at document start:
---
1
@1 FrontmatterOpen
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---
1
@1 FrontmatterClose

## YAML Front Matter - Multiple Fields

YAML with multiple fields:
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

## YAML Front Matter - Empty

Empty YAML front matter (no content):
---
1
@1 FrontmatterOpen
---
1
@1 FrontmatterClose

## YAML Front Matter - With Content After

YAML front matter followed by content:
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

## TOML Front Matter - Basic

Valid TOML front matter at document start:
+++
1
@1 FrontmatterOpen
title = "Test"
1
@1 FrontmatterContent "title = \"Test\"\n"
+++
1
@1 FrontmatterClose

## TOML Front Matter - Multiple Fields

TOML with multiple fields:
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

## TOML Front Matter - Empty

Empty TOML front matter:
+++
1
@1 FrontmatterOpen
+++
1
@1 FrontmatterClose

## JSON Front Matter - Basic

Valid JSON front matter at document start:
{
1
@1 FrontmatterOpen
  "title": "Test"
1
@1 FrontmatterContent "  \"title\": \"Test\"\n"
}
1
@1 FrontmatterClose

## JSON Front Matter - Multiple Fields

JSON with multiple fields:
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

## JSON Front Matter - Empty

Empty JSON object:
{
1
@1 FrontmatterOpen
}
1
@1 FrontmatterClose

## Not Front Matter - YAML Not at Start

YAML fence not at position 0 should be thematic break:
Text before
---
1
@1 InlineText

## Not Front Matter - Four Dashes

Four dashes is not valid front matter:
----
1
@1 InlineText
content
1
@1 InlineText

## Not Front Matter - Content After Opening Fence

Content on same line as opening fence invalidates front matter:
--- invalid
1
@1 InlineText

## Not Front Matter - TOML Not at Start

TOML fence not at position 0:
Text before
+++
1
@1 InlineText

## Not Front Matter - JSON Not at Start

JSON brace not at position 0:
Text before
{
1
@1 InlineText

## Edge Case - YAML with Blank Lines

YAML with blank lines in content:
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

## Edge Case - YAML with Indentation

YAML with indented content:
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

## Edge Case - TOML with Tables

TOML with table syntax:
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

## Edge Case - JSON with Nested Objects

JSON with nested structure:
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

## Edge Case - YAML Trailing Spaces on Fence

YAML fence with trailing spaces (should be valid):
---   
1
@1 FrontmatterOpen
title: "Test"
1
@1 FrontmatterContent "title: \"Test\"\n"
---   
1
@1 FrontmatterClose
