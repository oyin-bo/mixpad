# HTML Elements Parsing

**Context:** Comprehensive design for HTML element parsing in MixPad, including special content modes (script/style/CDATA/comments) and Markdown-HTML interleaving.

## Executive Summary

HTML elements in MixPad require sophisticated parsing because:

1. **Dual citizenship:** HTML and Markdown are both first-class - Markdown can appear inside HTML, HTML can appear inside Markdown
2. **Multiple content modes:** Normal, raw text (script/style), CDATA, comments, DOCTYPE
3. **Malformed input handling:** Graceful recovery with restorative strategies for unclosed elements
4. **Token granularity:** Enough detail for syntax highlighting, error recovery, and semantic processing

This document plans the complete token vocabulary, scanning patterns, and error handling strategies.

## Core Principles

### HTML and Markdown Interleaving

**Fundamental rule:** Markdown is allowed inside HTML block-level elements (divs, sections, etc.), and HTML inline elements can appear in Markdown text.

**Examples:**

```html
<div class="note">
## This is a Markdown heading inside HTML

- List item with *emphasis*
- Another item with `code`
</div>

Regular Markdown with <span class="highlight">HTML inline</span> mixed in.
```

**Implication:** The scanner must track context to know when to parse Markdown vs. when to consume raw HTML content.

### Restorative Parsing for Malformed Input

**Problem:** Users type unclosed elements during editing:

```markdown
Here is text.

<div class="note">
More text here...

## A heading appears - should this close the div?

Even more text...
```

**Strategy:** When a construct that requires a closing delimiter is not found before EOF, error recovery may attempt to find a heuristic recovery point. If found, the scanner marks the opening token with `ErrorUnbalancedToken`, emits content consumed so far, and resumes at the recovery point. If no recovery point applies, the content extends to EOF with the opening token still flagged. In all cases, no synthetic closing token is emitted.

**Recovery heuristics (construct-specific):**
- **Block-level tags / opening tags:** Recovery point at newline or next `<`
- **Inline tag / attribute values:** Recovery point at newline or `<`
- **HTML comments:** Recovery point at `<` on new line or double-newline
- **CDATA / DOCTYPE / Raw text:** Recovery point at EOF (strict, no early heuristic)
- **XML PI:** Recovery point at newline or EOF

**Always:** Mark the opening token with `ErrorUnbalancedToken` so syntax highlighting and diagnostics can show the issue, but the tokenizer continues robustly.

## Token Vocabulary

### HTML Tag Tokens

The parser will need to produce a variety of token types to represent the different parts of HTML syntax. These include, but are not limited to:

- **Tag Markers:** Tokens for the opening and closing parts of a tag, such as `<`, `</`, `>`, and `/>`.
- **Tag Names:** A token for the name of an HTML element (e.g., `div`, `span`).
- **Attributes:** Tokens for attribute names, the equals sign, and attribute values.
- **Special Content Modes:**
  - **Comments:** Tokens for the comment delimiters (`<!--`, `-->`) and the content within.
  - **CDATA:** Tokens for CDATA section delimiters (`<![CDATA[`, `]]>`) and the content.
  - **DOCTYPE:** Tokens for the `<!DOCTYPE` declaration and its content.
  - **Raw Text:** A token for the raw, unparsed content of elements like `<script>`, `<style>`, and `<textarea>`.
  - **XML Processing Instructions:** Tokens for the target and content of PIs like `<?xml ... ?>`.

### Token Flags

To handle errors gracefully, we will use a minimal set of flags. For now, we will rely on the existing `ErrorUnbalancedToken` flag to mark tokens that are part of a malformed or unclosed structure. If more specific error flags become necessary during implementation, they can be added at that time. The goal is to be frugal with flags and let demonstrated needs drive their creation.


## Scanning Architecture

### Scanner Modules

The parsing logic for different HTML constructs will be encapsulated in separate scanner modules, following the project's established architecture. Each module will be responsible for a specific part of the syntax.

- A module for parsing standard HTML tags, including their names and attributes.
- A module for handling HTML comments.
- A module for CDATA sections.
- A module for DOCTYPE declarations.
- A module for raw text content inside elements like `<script>`, `<style>`, and `<textarea>`.
- A module for XML Processing Instructions.

These modules will be invoked from the main `scan0` loop when a `<` character is encountered. The main loop will use minimal lookahead to determine which specialized scanner to call.


### Pattern Classification

Following the decision criteria from doc 8:

**Pattern A (Return Token):**
- None - all HTML/XML constructs are multi-token

**Pattern B (Push and Return Consumed Length):**
- All HTML/XML scanners - they produce multiple tokens (open, content, close)

### Integration with scan0

The main `scan0` loop will delegate to the appropriate HTML scanning module upon encountering a `<` character. A small amount of lookahead will determine which construct is present (e.g., `<!--` for a comment, `<?` for a PI, `</` for a closing tag, etc.). If no specific HTML construct is identified, the scanner will fall back to treating the `<` as a literal character within inline text.


## HTML Tag Parsing (scan-html-tag.js)

### Tag Structure

```
<tagname attr1="value1" attr2='value2' attr3=unquoted standalone-attr>
^       ^                                                             ^
open    attributes (name, =, value)                                  close

</tagname>
^^       ^
open     close
```

### Token Sequence

**Opening tag:**
1. `HTMLTagOpen` - `<` (length 1)
2. `HTMLTagName` - tag name (length N)
3. For each attribute:
   - `HTMLAttributeName` - attribute name
   - `HTMLAttributeEquals` - `=` (if present)
   - `HTMLAttributeValue` - value (if present, includes quotes)
4. `HTMLTagSelfClosing` - `/>` (length 2) OR `HTMLTagClose` - `>` (length 1)

**Closing tag:**
1. `HTMLTagOpen` - `</` (length 2, with flag indicating close)
2. `HTMLTagName` - tag name
3. `HTMLTagClose` - `>`

### Special Tag Handling

**Void elements** (self-closing by definition):
- `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`
- These never have closing tags
- Flag opening tag with metadata indicating void element

**Raw text elements** (content not parsed as a whole, but may contain sub-tokens):
- `script`, `style`, `textarea`
- After closing `>` of opening tag, invoke a raw text scanner which consumes until the corresponding closing tag (e.g., `</script>`).
- The content of these elements will be tokenized for entities or other relevant syntax, rather than being treated as a single opaque block.


**Deprecated elements** (flag with warning):
- `font`, `center`, `strike`, `big`, `small`, `marquee`, `blink`, `basefont`
- Flag opening tag with `WarningDeprecatedHTMLTag`

### Attribute Parsing

**Quoted values:**
```html
attr="value with &amp; entity"
attr='single quoted'
```
- `HTMLAttributeValue` includes the quotes
- Entities INSIDE attribute values are NOT tokenized separately (deferred to semantic layer)

**Unquoted values:**
```html
attr=simple-value-123
```
- `HTMLAttributeValue` does not include quotes
- Cannot contain spaces, `<`, `>`, `"`, `'`, `=`, `` ` ``

**Standalone attributes (boolean):**
```html
<input type="checkbox" checked disabled>
```
- `HTMLAttributeName` with no `=` or value tokens following

**XML Namespaces (for embedded SVG/MathML):**
```html
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <use xlink:href="#icon" />
</svg>
```
- Namespace prefixes are part of `HTMLAttributeName`: `xmlns`, `xmlns:xlink`, `xlink:href`
- Tag names can also have namespace prefixes: `<svg:rect>`, `<math:mfrac>`
- `HTMLTagName` includes the full qualified name with colon: `svg:rect` stored as single token
- **No special parsing:** Treat colons as regular name characters (XML spec allows this)
- Semantic layer can split on `:` if namespace processing is needed

### Malformed Syntax Run Recovery

When a construct that is required to have a closing delimiter (such as `-->` for comments, `?>` for PIs, `>` for tags, `"` or `'` for quoted attribute values) is not found before EOF, error recovery may apply.

**Fundamental principle:** The opening token for the unclosed construct is always marked with `ErrorUnbalancedToken`. No synthetic closing token is emitted.

**Recovery strategies** (applied in order of preference):

1. **Heuristic recovery point found:**
   - A construct-specific recovery heuristic identifies a likely exit point (e.g., `<` at start-of-line for comments, newline for attribute values, double-newline for raw text).
   - The scanner emits the accumulated content tokens (text, entities, etc.) up to (but not including) the recovery point.
   - The scanner returns consumed length up to the recovery point, allowing the main scanner to resume normally.
   - The opening token is flagged with `ErrorUnbalancedToken`.
   - No synthetic closing token is emitted.
   - Example: `<!-- comment\n<div>` → `[HTMLCommentOpen|ErrorUnbalancedToken, HTMLCommentContent, <div parsed normally>`

2. **No recovery point found (extends to EOF):**
   - The scanner consumes input until EOF.
   - The opening token is flagged with `ErrorUnbalancedToken`.
   - Content tokens are emitted for everything consumed.
   - No synthetic closing token is emitted.
   - Example: `<!-- comment` (EOF) → `[HTMLCommentOpen|ErrorUnbalancedToken, HTMLCommentContent, EOF]`

**Per-construct recovery points (non-exhaustive):**
- **Opening tag:** double newline (with possible whitespace between) or `<`
- **Quoted attribute values:** double newline (with possible whitespace between), `<`, or `>`
- **HTML comments:** double-newline (with possible whitespace between) or `<` on new line (with possible whitespace indent)
- **CDATA:** double newline (with possible whitespace between), `<`, or `>` - and specifically in case `>` will also be taken as a malformed CDATA close token, and parsing continues after
- **DOCTYPE:** newline or `<`
- **XML PI:** newline, `<` or `>` - and specifically in case `>` will also be taken as a malformed PI close token, and parsing continues after
- **Raw text (script/style/textarea):** double newline (with possible whitespace between) or `<`

**Invalid constructs (not error recovery, but early rejection):**
```html
<123-not-valid>
```
**Strategy:** Reject during initial validation (invalid tag name). Return 0, let `scanInlineText` handle as literal text. This is not error recovery; the construct is not recognized as valid syntax.

**Token never emitted as synthetic close:**
No closing token (e.g., `HTMLCommentClose`, `HTMLTagClose`, `HTMLAttributeQuote`) is synthesized during error recovery. Content is consumed, opening token flagged, and scanning resumes at the recovery point or EOF.

## HTML Comments (scan-html-comment.js)

### Comment Structure

```html
<!-- This is a comment with -- double dash inside -->
^                                                   ^
open                                                close
```

### Token Sequence

1. `HTMLCommentOpen` - `<!--` (length 4)
2. `HTMLCommentContent` - entire comment content (length N)
3. `HTMLCommentClose` - `-->` (length 3)

### Special Rules

**Double dash in content:**
```html
<!-- This -- is technically invalid per spec -->
```
**Strategy:** Parse it anyway, flag with warning if desired (or ignore - common in practice)

**Unclosed comment:**
```html
<!-- This comment is never closed

More document content
```
**Strategy:** An unclosed comment should not consume the rest of the file. Instead, a restorative strategy will be used. The parser will look for the next occurrence of `-->` or a standalone `<` on a new line.
- If `-->` is found, the comment will be closed there, and the closing token will be marked with `ErrorUnbalancedToken`.
- If a new tag start `<` is found, the comment will be artificially closed before it, with the missing closing delimiter also marked as a fallback.
This prevents catastrophic parsing failures during editing.


### Conditional Comments (IE legacy)

```html
<!--[if IE]>
  <p>You are using Internet Explorer</p>
<![endif]-->
```

**Strategy:** Treat as regular comment content
**Rationale:** These are obsolete, no special parsing needed

## CDATA Sections (scan-html-cdata.js)

### CDATA Structure

```xml
<![CDATA[ This is <raw> content with no & parsing ]]>
^                                                    ^
open                                                 close
```

### Token Sequence

1. `HTMLCDataOpen` - `<![CDATA[` (length 9)
2. `HTMLCDataContent` - entire content (length N)
3. `HTMLCDataClose` - `]]>` (length 3)

### Special Rules

**CDATA in HTML:**
- Technically only valid in XML/XHTML
- MixPad allows it for compatibility
- No special handling needed beyond tokenization

**Unclosed CDATA:**
**Strategy:** Close at EOF
**Tokens:** Flag opening with `ErrorUnbalancedHTMLTag`, emit artificial close at EOF

**Nested CDATA markers:**
```xml
<![CDATA[ text ]]> more ]]>
```
**Strategy:** First `]]>` closes it (greedy matching)

## DOCTYPE Declarations (scan-html-doctype.js)

### DOCTYPE Structure

```html
<!DOCTYPE html>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://...">
<!doctype html>  <!-- case insensitive -->
^                                                                      ^
open                                                                   close
```

### Token Sequence

1. `HTMLDocTypeOpen` - `<!DOCTYPE` or `<!doctype` (length 9, case-insensitive)
2. `HTMLDocTypeContent` - everything between DOCTYPE and `>` (length N)
3. `HTMLDocTypeClose` - `>` (length 1)

### Special Rules

**Case insensitivity:**
- `<!DOCTYPE`, `<!doctype`, `<!DoCtYpE` all valid
- Store original case in token, don't normalize
- Comparison uses case-insensitive check

**Complex DOCTYPE syntax:**
- PUBLIC/SYSTEM keywords
- Quoted DTD identifiers
- **Strategy:** Don't parse internal structure, treat as single `HTMLDocTypeContent` token
- **Rationale:** DOCTYPEs are rare and complex, semantic layer can parse if needed

**XML DOCTYPE with DTD subset:**
```xml
<!DOCTYPE root [
  <!ELEMENT root (child)>
  <!ATTLIST child id ID #REQUIRED>
]>
```
**Strategy:** Parse until `>` at matching nesting level (handle `[` `]` pairs)
**Complexity:** Track square bracket nesting depth, close at `>` when depth is 0

**Unclosed DOCTYPE:**
**Strategy:** Close at EOF (not newline, since DOCTYPE can be multi-line)
**Tokens:** Flag with `ErrorUnbalancedHTMLTag`

### Implementation Notes

```javascript
/**
 * Scan DOCTYPE declaration.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLDocType(input, start, end, output) {
  // Must start with '<!'
  if (input.charCodeAt(start) !== 60 /* < */ || 
      input.charCodeAt(start + 1) !== 33 /* ! */) return 0;
  
  // Check for 'DOCTYPE' (case-insensitive)
  let offset = start + 2;
  const doctypeStart = offset;
  const expectedDoctype = 'DOCTYPE';
  for (let i = 0; i < 7; i++) {
    if (offset >= end) return 0;
    const ch = input.charCodeAt(offset);
    const expected = expectedDoctype.charCodeAt(i);
    if (ch !== expected && ch !== (expected + 32)) return 0; // case-insensitive
    offset++;
  }
  
  // Emit opening token
  output.push(9 | HTMLDocTypeOpen); // '<!DOCTYPE'
  
  // Scan content until '>' (tracking square brackets for DTD subset)
  const contentStart = offset;
  let bracketDepth = 0;
  let hasContent = false;
  
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    if (ch === 91 /* [ */) bracketDepth++;
    else if (ch === 93 /* ] */) bracketDepth--;
    else if (ch === 62 /* > */ && bracketDepth === 0) {
      // Found closing '>'
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | HTMLDocTypeContent);
        hasContent = true;
      }
      output.push(1 | HTMLDocTypeClose);
      return offset - start + 1;
    }
    offset++;
  }
  
  // EOF without finding '>'
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | HTMLDocTypeContent | ErrorUnbalancedHTMLTag);
  }
  // Artificial close
  output.push(0 | HTMLDocTypeClose | ErrorUnbalancedToken);
  return offset - start;
}
```

## Raw Text Content (for script, style, textarea)

### Context

After parsing opening tags for `<script>`, `<style>`, or `<textarea>`, the content until the closing tag is handled specially. It is not parsed for Markdown or HTML tags, but it *is* parsed for other syntax like HTML entities.

**Example:**
```html
<textarea>
  This is some text &amp; more text.
</textarea>
```
The `&amp;` inside the textarea should be recognized as an entity token.

### Token Sequence

After the `HTMLTagClose` token of an opening `<script>`, `<style>`, or `<textarea>` tag, the scanner will:
1. Tokenize the content for applicable sub-syntaxes (like entities) until it finds the corresponding closing tag.
2. Parse the closing tag normally.

### Scanning Strategy

The scanner for raw text will search for the appropriate closing tag (e.g., `</script>`) in a case-insensitive manner. While scanning, it will invoke other primitive scanners, such as the one for HTML entities. If no closing tag is found by the end of the input, the content will be consumed to the end, and the structure will be marked with `ErrorUnbalancedToken`.


### Special Cases

**Script with escaped closing tag:**
```html
<script>
  document.write("<\/script>"); // Escaped in legacy JS
</script>
```
**Strategy:** Simple search will find the literal `</script>` - acceptable
**Rationale:** Proper handling requires full JavaScript parsing - out of scope

**Style with closing tag in comment:**
```css
<style>
  /* </style> in comment */
  div { color: red; }
</style>
```
**Strategy:** Simple search will close at first `</style>` - acceptable
**Rationale:** Proper handling requires full CSS parsing - out of scope

**Note:** These edge cases are rare and acceptable as limitations. The user can work around by escaping or restructuring.

## XML Processing Instructions (scan-xml-processing-instruction.js)

### XML PI Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/css" href="style.css"?>
<?target content goes here?>
^                           ^
open                        close
```

### Token Sequence

1. `XMLProcessingInstructionOpen` - `<?` (length 2)
2. `XMLProcessingInstructionTarget` - PI target name (length N, e.g., `xml`, `xml-stylesheet`)
3. `XMLProcessingInstructionContent` - everything between target and `?>` (length N, optional)
4. `XMLProcessingInstructionClose` - `?>` (length 2)

### Special Rules

**Target name:**
- Must start with ASCII letter or `_`
- Can contain letters, digits, `-`, `_`, `.`
- Case-sensitive (unlike HTML)
- Common targets: `xml`, `xml-stylesheet`, custom application targets

**XML declaration special case:**
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
```
- Target is `xml` (exactly, lowercase)
- Content contains pseudo-attributes: `version`, `encoding`, `standalone`
- **Strategy:** Tokenize as normal PI, semantic layer can parse pseudo-attributes

**Whitespace after target:**
- Required before content (if content exists)
- `<?xml?>` - valid, no content
- `<?xml version="1.0"?>` - valid, whitespace before content
- `<?xmlversion?>` - invalid (no whitespace), but we'll parse as target `xmlversion`

**Unclosed PI:**
```xml
<?xml version="1.0"
```
**Strategy:** Close at newline or EOF
**Tokens:** Flag with `ErrorUnbalancedHTMLTag`

**PHP-style short tags:**
```php
<? echo "hello"; ?>
```
**Strategy:** Parse as PI with empty target (or single `?` target)
**Note:** Not standard XML, but common in PHP contexts

### Implementation Notes

```javascript
/**
 * Scan XML processing instruction.
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index of '<'
 * @param {number} end - Exclusive end
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanXMLProcessingInstruction(input, start, end, output) {
  // Must start with '<?'
  if (input.charCodeAt(start) !== 60 /* < */ || 
      input.charCodeAt(start + 1) !== 63 /* ? */) return 0;
  
  let offset = start + 2;
  if (offset >= end) return 0;
  
  // Emit opening token
  output.push(2 | XMLProcessingInstructionOpen);
  
  // Parse target name
  const targetStart = offset;
  const firstCh = input.charCodeAt(offset);
  
  // Target must start with letter or underscore
  if (!((firstCh >= 65 && firstCh <= 90) ||   // A-Z
        (firstCh >= 97 && firstCh <= 122) ||  // a-z
        firstCh === 95 /* _ */)) {
    // Invalid target, could be PHP short tag <? ... ?>
    // Treat '?' as target for compatibility
  } else {
    offset++;
    // Continue with valid name characters
    while (offset < end) {
      const ch = input.charCodeAt(offset);
      if ((ch >= 65 && ch <= 90) ||   // A-Z
          (ch >= 97 && ch <= 122) ||  // a-z
          (ch >= 48 && ch <= 57) ||   // 0-9
          ch === 45 /* - */ ||
          ch === 95 /* _ */ ||
          ch === 46 /* . */) {
        offset++;
      } else {
        break;
      }
    }
  }
  
  const targetLength = offset - targetStart;
  if (targetLength > 0) {
    output.push(targetLength | XMLProcessingInstructionTarget);
  }
  
  // Parse content until '?>'
  const contentStart = offset;
  let hasContent = false;
  
  while (offset < end) {
    const ch = input.charCodeAt(offset);
    if (ch === 63 /* ? */ && offset + 1 < end && 
        input.charCodeAt(offset + 1) === 62 /* > */) {
      // Found '?>'
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | XMLProcessingInstructionContent);
        hasContent = true;
      }
      output.push(2 | XMLProcessingInstructionClose);
      return offset - start + 2;
    }
    if (ch === 10 /* newline */ && !hasContent) {
      // Unclosed PI, close at newline
      const contentLength = offset - contentStart;
      if (contentLength > 0) {
        output.push(contentLength | XMLProcessingInstructionContent | ErrorUnbalancedHTMLTag);
      }
      output.push(0 | XMLProcessingInstructionClose | ErrorUnbalancedToken);
      return offset - start;
    }
    offset++;
  }
  
  // EOF without finding '?>'
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | XMLProcessingInstructionContent | ErrorUnbalancedHTMLTag);
  }
  output.push(0 | XMLProcessingInstructionClose | ErrorUnbalancedToken);
  return offset - start;
}
```

### Use Cases

**Embedded SVG with XML declaration:**
```html
<svg xmlns="http://www.w3.org/2000/svg">
  <?xml-stylesheet type="text/css" href="svg-styles.css"?>
  <circle cx="50" cy="50" r="40" />
</svg>
```

**Standalone XML document:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root SYSTEM "example.dtd">
<root>
  <child>content</child>
</root>
```

**RSS/Atom feeds (common in Markdown documentation):**
```xml
<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Feed Title</title>
  </channel>
</rss>
```

## Context Tracking and Markdown Interleaving

### Block vs Inline HTML

The distinction between block and inline HTML elements is a concern for the semantic layer of the parser, not the initial `scan0` tokenizer. `scan0` will tokenize all HTML tags it encounters, regardless of whether they appear on their own line or within a line of text.

**The core principle is that Markdown parsing is always active, even inside HTML elements.** The presence of an HTML tag does not turn off Markdown processing. This means that sequences like `<div>*emphasis*</div>` and `<span>*emphasis*</span>` are both valid and will be parsed accordingly. The `scan0` tokenizer simply produces a stream of tokens (HTML and Markdown mixed), and the semantic layer is responsible for constructing the correct syntax tree from this stream. No special context stack is needed in `scan0` to manage this.


## Error Handling and Error Recovery

The parser's behavior is consistent and predictable at all times. There is no special "editing mode." Error recovery (when a construct is unclosed) is always active, ensuring that input is handled gracefully whether the document is being viewed or actively edited. This provides a stable and unsurprising user experience.

**Core principle:** When a construct requiring a closing delimiter is not found before EOF, the opening token is marked with `ErrorUnbalancedToken`. Content tokens are emitted for what was consumed. No synthetic closing token is emitted. The scanner may attempt heuristic recovery (resume at a recovery point) or extend to EOF, but the opening token always bears the error flag.

### Recovery Summary

| Construct | Unclosed Scenario | Recovery Behavior | Opening Token Flag |
|-----------|------------------|----------|------|
| Opening tag | `<div class="note` (newline) | Attempt recovery at newline or `<`; if found, resume there; otherwise extend to EOF | `ErrorUnbalancedToken` |
| Closing tag | `</div` (newline) | Attempt recovery at newline; if found, resume; otherwise extend to EOF | `ErrorUnbalancedToken` |
| Attribute value (quoted) | `attr="no close` (newline) | Attempt recovery at newline, `<`, or `>`; otherwise extend to EOF | (opening tag marked) |
| Comment | `<!-- no close` (following content) | Attempt recovery at `<` on new line or double-newline; otherwise extend to EOF | `ErrorUnbalancedToken` |
| CDATA | `<![CDATA[ no close` | No early heuristic; extend to EOF | `ErrorUnbalancedToken` |
| DOCTYPE | `<!DOCTYPE html` | No early heuristic; extend to EOF (multi-line allowed) | `ErrorUnbalancedToken` |
| XML PI | `<?xml version="1.0"` | Attempt recovery at newline; otherwise extend to EOF | `ErrorUnbalancedToken` |
| Raw text (script/style/textarea) | `<script>` (no closing tag) | No early heuristic; extend to EOF | (opening tag marked) |

**Invariants:**
- Opening token always flagged when construct is unclosed (recovery or EOF).
- No synthetic closing token emitted.
- No tokens with encoded length zero.
- Recovery only happens when a proper closing delimiter is absent.


## Token Information

Tokens are represented as numbers, which is a highly efficient approach. These numbers are not just arbitrary values; they are packed with information. Through bitwise operations, a single number can encode the token's type, its length in the source text, and any relevant flags (like an error state). Because the scanner processes the input sequentially, the starting offset of a token is known. With the offset and the length encoded in the token itself, the exact source text for any token is implicitly available without needing to store it directly. This design is fundamental to the parser's performance and low memory footprint.


## Testing Strategy (Annotated Markdown)

The correctness of the HTML parser will be verified using the annotated markdown testing approach, as described in [the corresponding design document](./1-annotated-markdown.md). Specific test files will be created to cover the various aspects of HTML parsing.

For example, a test for a simple `<div>` tag would look something like this:
The source line `<div>` would be followed by markers under the `<` and `div` parts, with assertions specifying that the tokens `HTMLTagOpen` and `HTMLTagName` are expected at those positions.

Similarly, tests will be designed to cover:
- Tags with attributes (quoted, unquoted, and standalone).
- Closing tags and self-closing tags.
- HTML comments, including unclosed scenarios.
- CDATA sections.
- DOCTYPE declarations, including complex ones with DTD subsets.
- XML Processing Instructions.
- Raw text elements like `<script>`, `<style>`, and `<textarea>`.
- XML namespaces in tags and attributes.
- All defined error recovery and fallback behaviors.

These tests will serve as a living specification for the parser's behavior.


## Implementation Checklist

### Phase 1: Token Definitions
- Define the necessary HTML token types in the appropriate module.
- Define any necessary error flags, starting with the existing `ErrorUnbalancedToken`.

### Phase 2: Basic Tag Scanning
- Implement the scanner for basic HTML tags (opening, closing, self-closing) and their attributes.
- Ensure it supports XML namespaces (colons in names).
- Add comprehensive tests for these features.
- Integrate the new scanner into the main `scan0` loop.

### Phase 3: Special Content Modes
- Implement the scanners for comments, CDATA, DOCTYPEs, and XML PIs.
- Each implementation should include robust error recovery for unclosed structures.
- Add dedicated tests for each of these special modes.

### Phase 4: Raw Text Elements
- Implement the scanner for raw text elements (`script`, `style`, `textarea`).
- This scanner should correctly identify the closing tag and handle sub-tokenization (e.g., for entities) within the content.
- Add tests for these elements, including unclosed scenarios.

### Phase 5: Error Handling
- Systematically review and test all error handling and restorative strategies across all new scanner modules.
- Ensure that the `ErrorUnbalancedToken` flag is applied correctly in all relevant cases.

### Phase 6: Integration and Performance
- Run the full test suite to ensure no regressions have been introduced.
- Benchmark the performance on documents with heavy HTML usage to validate efficiency.

### Phase 7: Documentation
- Add clear JSDoc comments to all new scanner functions.
- Update any relevant design documents to reflect the final implementation.


## Future Work (Deferred to Semantic Layer)

The following are NOT handled in scan0 but in the semantic scanner:

1. **Tag matching:** Pairing opening and closing tags
2. **Context tracking:** Maintaining nesting stack
3. **Markdown parsing inside HTML:** Recursively parsing Markdown in block-level HTML
4. **Attribute value entity decoding:** Parsing `&amp;` inside attribute values
5. **HTML vs Markdown precedence:** Deciding when to parse Markdown vs raw HTML
6. **Void element validation:** Ensuring void elements don't have closing tags
7. **Deprecated tag warnings:** User-facing warnings for obsolete tags

scan0's job is ONLY to tokenize the raw HTML syntax accurately and efficiently.

## Open Questions

1. **XHTML self-closing syntax:** Should `<div />` be treated as self-closing or as opening tag with immediate close?
   - **Decision:** Treat as self-closing (`HTMLTagSelfClosing`) - compatible with XHTML
   
2. **Entities in attribute values:** Should `<div title="&amp;">` tokenize the entity separately?
   - **Decision:** No, attribute value is one token - semantic layer can parse entities
   
3. **Processing instructions:** Should `<?xml version="1.0"?>` be supported?
   - **Decision:** ✅ YES - added full XML PI support (see section above)
   
4. **HTML5 template tag:** Should `<template>` content be parsed specially?
   - **Decision:** No special handling in scan0, treat as normal tag
   
5. **XML namespace prefix validation:** Should we validate namespace prefixes like `xmlns:*`?
   - **Decision:** No - accept any name with colons, semantic layer validates if needed
   
6. **Mixed case in XML:** Should `<SVG>` vs `<svg>` be handled differently?
   - **Decision:** No - store as-is, semantic layer decides if case matters (XML is case-sensitive, HTML is not)

## Summary

This plan provides:

✅ Complete token vocabulary for HTML elements and special modes  
✅ **XML Processing Instructions** support (`<?xml?>`, `<?xml-stylesheet?>`, etc.)  
✅ **XML namespace** support for embedded SVG/MathML (colons in tag/attribute names)  
✅ **DOCTYPE with DTD subset** support (tracks `[]` nesting)  
✅ Scanning patterns following established conventions (Pattern A/B from doc 8)  
✅ Error recovery strategies for malformed input  
✅ Integration points with scan0 main loop  
✅ Testing strategy using annotated markdown  
✅ Clear separation between scan0 (tokenization) and semantic layer (interpretation)  
✅ Support for Markdown-HTML interleaving (deferred to semantic layer)  
✅ Performance-conscious design (minimal allocation, linear scanning)  

**Next steps:** Begin implementation with Phase 1 (token definitions).