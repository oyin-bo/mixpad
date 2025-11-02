# Front Matter — Implementation and Scanner Design

This document defines the frontmatter parsing implementation for MixPad. Front matter is metadata at the start of a document, typically containing configuration, titles, dates, tags, and other structured data.

## Executive Summary

Front matter support enables documents to carry structured metadata in YAML, TOML, or JSON format at the absolute beginning (position 0). MixPad's scanner treats frontmatter content as opaque slices, delegating actual parsing to external libraries while ensuring correct tokenization for the semantic layer.

**Key implementation principles:**
1. **Position 0 requirement:** Frontmatter is ONLY valid at absolute position 0 of the input
2. **Opaque content:** Scanner does not validate YAML/TOML/JSON syntax — content is captured as raw text
3. **Zero allocation:** Use position indices only; no string extraction during scanning
4. **Three formats:** YAML (`---`), TOML (`+++`), and JSON (`{...}`)
5. **Disambiguation:** Position 0 requirement eliminates ambiguity with thematic breaks and Setext headings

## Goals

- Recognize front matter blocks at the absolute start of a document (position 0)
- Support three standard front matter formats: YAML (`---`), TOML (`+++`), and JSON (`{...}`)
- Capture front matter content as opaque slices for external parser delegation
- Emit provisional tokens suitable for the semantic layer to extract and parse metadata
- Ensure front matter detection does not conflict with thematic breaks, list markers, or other Markdown constructs

## Front Matter Types

### YAML Front Matter

**Syntax:**
```markdown
---
title: "Document Title"
author: "Author Name"
date: 2025-10-31
tags: [markdown, parser, mixpad]
---
# Document content starts here
```

**Requirements:**
- Opening fence: exactly `---` at position 0 (document start)
- Closing fence: exactly `---` on its own line
- Content: arbitrary YAML between fences (opaque to scanner)
- Must allow blank lines, indentation, and YAML syntax within the block
- Only valid at absolute document start (first non-whitespace position must be opening `---`)

### TOML Front Matter

**Syntax:**
```markdown
+++
title = "Document Title"
author = "Author Name"
date = 2025-10-31
tags = ["markdown", "parser", "mixpad"]
+++
# Document content starts here
```

**Requirements:**
- Opening fence: exactly `+++` at position 0 (document start)
- Closing fence: exactly `+++` on its own line
- Content: arbitrary TOML between fences (opaque to scanner)
- Same position and validation rules as YAML variant
- Uses `+` character instead of `-` for fences

### JSON Front Matter

**Syntax:**
```markdown
{
  "title": "Document Title",
  "author": "Author Name",
  "date": "2025-10-31",
  "tags": ["markdown", "parser", "mixpad"]
}
# Document content starts here
```

**Requirements:**
- Opening brace: `{` at position 0 (document start)
- Closing brace: `}` on its own line (or closing the JSON object)
- Content: valid JSON object between braces (opaque to scanner)
- Requires bracket balancing to detect end
- Less common but supported by some Markdown processors

## Scanner Responsibilities

### Detection Phase

1. **Document-start check**: Front matter is only valid at absolute position 0 of the input
2. **Fence recognition**: Detect `---`, `+++`, or `{` at start
3. **Disambiguation**:
   - `---` could be: YAML frontmatter, thematic break, or Setext underline
   - `+++` could be: TOML frontmatter or regular content
   - `{` could be: JSON frontmatter, HTML block, or inline content
   - Position 0 requirement eliminates most ambiguity

### Content Capture

1. **Opaque content**: Treat front matter content as raw text slice
2. **No parsing**: Scanner does not validate YAML/TOML/JSON syntax
3. **No allocation**: Record start/end positions only; defer string extraction
4. **Line tracking**: Maintain line boundaries for error reporting

### Closing Detection

1. **YAML/TOML**: Scan for matching fence (`---` or `+++`) at line start
2. **JSON**: Track brace balance to find closing `}`
3. **EOF handling**: Unclosed front matter is an error; emit error flag and treat content as regular document

## Token Model (Provisional)

Provisional tokens to add:

- **FrontmatterOpen**: Encodes type (YAML/TOML/JSON) in token bits
  - Bits 0-15: Length of opening fence (3 for `---`/`+++`, 1 for `{`)
  - Bits 16-25: Token kind (FrontmatterOpen)
  - Bits 26-27: Front matter type (0=YAML, 1=TOML, 2=JSON)
  
- **FrontmatterContent**: Raw content span between fences
  - Bits 0-15: Content length
  - Bits 16-25: Token kind (FrontmatterContent)
  - Opaque to scanner; parsed by external YAML/TOML/JSON libraries
  
- **FrontmatterClose**: Closing fence or brace
  - Bits 0-15: Length of closing fence (3 for `---`/`+++`, 1 for `}`)
  - Bits 16-25: Token kind (FrontmatterClose)

- **Error handling**: Use existing `ErrorUnbalancedToken` flag when closer not found

## Scanner Algorithm (High-Level)

1. **Entry point**: Only invoke front matter detection if scanning starts at position 0
2. **Type detection**:
   - If `---`: Check for YAML front matter
   - If `+++`: Check for TOML front matter  
   - If `{`: Check for JSON front matter
   - Otherwise: Not front matter, proceed with normal document parsing
3. **Fence validation**:
   - YAML/TOML: Require exactly 3 fence chars followed by newline or EOF
   - JSON: Require opening brace at position 0
4. **Content scan**:
   - YAML/TOML: Scan forward for closing fence at line start
   - JSON: Track brace balance until matching close
5. **Emit tokens**:
   - Balanced: `FrontmatterOpen`, `FrontmatterContent`, `FrontmatterClose`
   - Unbalanced: `FrontmatterOpen | ErrorUnbalancedToken`, `FrontmatterContent | ErrorUnbalancedToken`
6. **Continue**: After front matter (or error), continue normal document scanning

## Edge Cases & Constraints

### Position 0 Requirement

- Front matter MUST start at absolute position 0 (no leading whitespace, BOM, or other content)
- This eliminates ambiguity with similar constructs elsewhere in document
- Exception: Some processors allow leading UTF-8 BOM (`\uFEFF`) — document whether to support

### Fence Validation

- YAML/TOML fences must be exactly 3 characters (`---` or `+++`)
- Longer sequences like `----` or `++++` are NOT valid front matter openers
- Trailing spaces after fence are permitted (commonmark thematic break allows this)
- Any content after fence on same line invalidates front matter (must be newline or EOF)

### Content Rules

- Empty front matter is valid: `---\n---` (zero content lines)
- Blank lines within front matter are preserved
- No Markdown processing inside front matter (opaque content)
- Line endings (LF vs CRLF) are preserved in content slice

### Conflict Resolution

- `---` at position 0 followed by newline: Front matter (not thematic break)
- `---` elsewhere in document: Thematic break or Setext underline (context-dependent)
- `+++` at position 0: Front matter (not inline content)
- `{` at position 0 followed by valid JSON: Front matter (not HTML or inline)

### Multi-Format Documents

- Only ONE front matter block per document
- First valid front matter wins (subsequent fences are regular content)
- Mixing formats (e.g., YAML then TOML) is invalid — first format determines type

## Integration Points

### scan0.js Integration

1. Add early check at scan0 entry: `if (startOffset === 0 && input.length > 0)`
2. Dispatch to `scanFrontmatter(input, 0, endOffset, output)` if applicable
3. If front matter detected, advance offset past closing fence
4. Continue normal scanning from post-frontmatter position

### Semantic Layer Responsibilities

- Extract front matter content using token positions
- Delegate to external parsers: `js-yaml`, `@iarna/toml`, or `JSON.parse`
- Handle parse errors gracefully (invalid YAML/TOML/JSON syntax)
- Expose parsed metadata to application layer
- Maintain source positions for error reporting

## Implementation Constraints (Project Rules)

- **No TypeScript**: Use plain JavaScript with JSDoc comments
- **No build step**: All code must run directly with Node.js
- **No allocations during scan**: Record positions only; defer slicing to semantic layer
- **Annotated tests first**: Write `parse/tests/13-frontmatter.md` before implementation
- **Follow existing patterns**: Mirror structure of `scan-fences.js` and similar modules

## Test Cases (Annotated Markdown)

Create `parse/tests/13-frontmatter.md` covering:

### Happy Paths
- Valid YAML front matter with various data types
- Valid TOML front matter with tables and arrays
- Valid JSON front matter with nested objects
- Empty front matter blocks
- Front matter with trailing content

### Edge Cases
- Three-dash fence vs thematic break (position matters)
- Unclosed front matter (EOF without closing fence)
- Invalid JSON balance (missing closing brace)
- Content after opening fence on same line (invalidates front matter)
- Fence-like sequences inside front matter content

### Negative Cases
- Front matter not at position 0 (should parse as normal content)
- Four or more dashes/plus signs (not valid front matter)
- Mixed fence types (YAML open, TOML close)

## Deliverables (Future)

When this document is expanded, deliver:

1. **parse/docs/13-frontmatter.md** (this file) with detailed implementation plan
2. **parse/tests/13-frontmatter.md** with comprehensive annotated test cases
3. **parse/scan-frontmatter.js** implementing the scanner algorithm
4. **parse/scan-tokens.js** updated with new token constants
5. **scan0.js** updated to delegate to frontmatter scanner at position 0
6. Tests passing via `npm test`

## Implementation Status

**Status**: ✅ Fully implemented and tested (339/339 tests passing)

### Completed Items

1. ✅ **Token definitions** - FrontmatterOpen, FrontmatterContent, FrontmatterClose tokens added to scan-tokens.js
2. ✅ **Type utilities** - FrontmatterType enum and helper functions (getFrontmatterType, getFrontmatterTypeName) exported
3. ✅ **Type bits** - All tokens carry type information in bits 26-27 (0=YAML, 1=TOML, 2=JSON)
4. ✅ **Unified scanner** - scanDelimitedFrontmatter handles both YAML and TOML, eliminating code duplication
5. ✅ **JSON scanner** - Tracks brace balance, handles string escaping, finds matching closer
6. ✅ **scan0 integration** - Early detection at position 0, proper line tracking after frontmatter
7. ✅ **Comprehensive tests** - 44 annotated markdown tests covering all formats and edge cases
8. ✅ **Error handling** - Unclosed frontmatter emits ErrorUnbalancedToken flag
9. ✅ **Disambiguation** - Position 0 requirement prevents conflicts with Setext headings

### Scanner Implementation Details

#### scan-frontmatter.js Module

The frontmatter scanner is implemented in `parse/scan-frontmatter.js` following Pattern B (complex scanner that pushes tokens and returns consumed length).

**Exported utilities:**
```javascript
// Type enum for frontmatter identification
export const FrontmatterType = {
  YAML: 0,
  TOML: 1,
  JSON: 2
};

// Helper to extract type from token
export function getFrontmatterType(token)

// Helper to get human-readable type name
export function getFrontmatterTypeName(token)

// Main scanner entry point
export function scanFrontmatter(input, startOffset, endOffset, output)
```

**Key characteristics:**
- Returns 0 immediately if `startOffset !== 0` (frontmatter only valid at document start)
- Dispatches to format-specific scanners based on first character
- No allocations during scan — uses `charCodeAt()` for character inspection
- Emits 2-3 tokens with type bits: FrontmatterOpen, [FrontmatterContent], FrontmatterClose
- Type information stored in bits 26-27 of all emitted tokens

#### Unified YAML/TOML Scanner Algorithm

YAML (`---`) and TOML (`+++`) are handled by a single `scanDelimitedFrontmatter()` function that accepts the delimiter character as a parameter. This eliminates code duplication while maintaining clarity:

1. **Validate opening fence:**
   - Must be exactly 3 characters (`---` or `+++`)
   - Must be at position 0
   - Must be followed by newline, space/tab, or EOF
   - Content on same line as fence invalidates frontmatter

2. **Capture content:**
   - Scan forward line-by-line looking for closing fence
   - Closing fence must be at line start (beginning of a line)
   - Closing fence must match opening character (can't mix `---` and `+++`)
   - Content between fences is opaque — preserved exactly as-is

3. **Emit tokens with type bits:**
   - Calculate `typeBits = (type & 0x3) << 26` where type is 0 for YAML or 1 for TOML
   - FrontmatterOpen: includes opening fence + newline + type bits
   - FrontmatterContent: all content between fences (may be empty) + type bits
   - FrontmatterClose: includes closing fence + newline + type bits

4. **Error handling:**
   - If no closer found by EOF, emit FrontmatterContent with ErrorUnbalancedToken flag and type bits

#### JSON Scanner Algorithm

JSON frontmatter has different structure due to brace balancing:

1. **Validate opening brace:**
   - Must be `{` at position 0
   - Calculate type bits: `typeBits = (FrontmatterType.JSON & 0x3) << 26`

2. **Track brace balance:**
   - Maintain `braceDepth` counter (starts at 1 after opening `{`)
   - Respect string literals (don't count braces inside quoted strings)
   - Handle escape sequences (`\"` doesn't end string)
   - Track `inString` state and `escapeNext` flag

3. **Find matching closer:**
   - Scan forward character by character
   - Increment depth on `{`, decrement on `}`
   - When depth reaches 0, found matching closer

4. **Emit tokens with type bits:**
   - FrontmatterOpen: just `{` (length 1) + type bits
   - FrontmatterContent: everything between braces (includes newlines and indentation) + type bits
   - FrontmatterClose: just `}` (length 1) + type bits
   - Note: Unlike YAML/TOML, newlines are NOT included in opening/closing tokens

#### scan0.js Integration

Frontmatter detection happens before the main scanning loop:

```javascript
// Check for frontmatter at absolute position 0
if (startOffset === 0) {
  const frontmatterConsumed = scanFrontmatter(input, startOffset, endOffset, output);
  if (frontmatterConsumed > 0) {
    offset += frontmatterConsumed;
    tokenCount += output.length;
    // Update line tracking to skip past frontmatter
    lineStartOffset = offset;
    lineTokenStartIndex = output.length;
    lineCouldBeSetextText = false;
  }
}
```

**Key integration points:**
- Runs BEFORE any other scanning (even before newline detection)
- Updates `offset` to skip past consumed frontmatter
- Resets Setext heading state to prevent treating post-frontmatter content as Setext text
- Only invoked when `startOffset === 0` (document start)

## Performance Characteristics

### Zero-Allocation Compliance

✅ **Fully compliant** with project's zero-allocation principles:
- All character inspection via `charCodeAt(pos)`
- No `substring()`, `slice()`, or `charAt()` calls
- No string allocations during scanning
- Token positions recorded as numeric indices only
- Content extraction deferred to semantic layer

### Time Complexity

- **YAML/TOML:** O(n) where n = frontmatter length
  - Linear scan for closing fence
  - Each character visited at most once
  
- **JSON:** O(n) where n = frontmatter length
  - Linear scan with state tracking
  - Each character visited exactly once
  - String escape handling adds minimal overhead

### Space Complexity

- **Scanner state:** O(1) constant space
  - Small number of integer variables (pos, depth, flags)
  - No buffers or accumulators
  
- **Output tokens:** O(1) for frontmatter
  - Always emits 2-3 tokens regardless of content size
  - Token array provided by caller

## Edge Cases and Special Handling

### Fence Validation (YAML/TOML)

**Valid opening fences:**
```markdown
---
--- 
---  (trailing spaces)
---	(trailing tab)
```

**Invalid opening fences:**
```markdown
---- (four dashes - not frontmatter)
--- content (content on same line)
 --- (leading space - not at position 0)
```

**Valid closing fences:**
```markdown
---
---  (trailing spaces allowed)
```

**Invalid closing fences:**
```markdown
---- (different length - not a fence)
--- content (content after fence)
```

### Content Rules

**Empty frontmatter is valid:**
```markdown
---
---
```
Emits: FrontmatterOpen, FrontmatterClose (no content token)

**Fence-like sequences inside content are preserved:**
```markdown
---
title: "Test with --- inside"
description: "Another --- here"
---
```
Only the first `---` at line start after the opening closes the block.

**Blank lines and indentation preserved:**
```markdown
---
nested:
  key: value
  
  another: data
---
```
All whitespace, newlines, and indentation in content is preserved exactly.

### JSON Brace Balancing

**Nested objects allowed:**
```json
{
  "outer": {
    "inner": {
      "deep": "value"
    }
  }
}
```

**Braces in strings ignored:**
```json
{
  "text": "This { is not a brace",
  "valid": true
}
```

**Escape sequences handled:**
```json
{
  "quote": "She said \"hello\"",
  "backslash": "Path: C:\\Users"
}
```

## Open Questions (Resolved)

1. **Should we support UTF-8 BOM before front matter?**  
   → **Decision:** No. Frontmatter must start at absolute position 0. BOM support can be added as a preprocessing step if needed.

2. **How strict should fence validation be? (trailing spaces, tabs, etc.)**  
   → **Decision:** Allow trailing whitespace after fences. Content on same line as opening fence invalidates frontmatter.

3. **Should unclosed front matter be fatal error or graceful degradation?**  
   → **Decision:** Graceful degradation. Emit FrontmatterContent with ErrorUnbalancedToken flag, allowing semantic layer to decide handling.

4. **Do we expose front matter in provisional tokens or defer to semantic layer entirely?**  
   → **Decision:** Expose via provisional tokens (FrontmatterOpen, Content, Close). Semantic layer extracts and parses content using external libraries.

5. **Should scanner validate that content is well-formed YAML/TOML/JSON, or remain completely opaque?**  
   → **Decision:** Remain completely opaque. Scanner's job is tokenization only. Syntax validation happens in semantic layer.

## References

- CommonMark: No native front matter support (extension territory)
- Jekyll/Hugo: YAML front matter with `---` fences (de facto standard)
- micromark-extension-frontmatter: YAML/TOML support implementation reference
- Pandoc: Supports YAML front matter with `---` fences
- Gray-matter (npm): Popular front matter parsing library

---

**Status**: High-level definition complete. Awaiting expansion into detailed implementation plan with scanner algorithm, token design, and comprehensive test suite.
