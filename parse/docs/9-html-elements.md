# HTML Elements Parsing

**Status:** Planning  
**Date:** 2025-10-05  
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

**Strategy:** Use heuristics to artificially close unclosed elements at likely breakpoints:

- **Block-level elements:** Close at blank line or at next block-level element start
- **Inline elements:** Close at end of line or at `<` (start of new tag)
- **Script/style/CDATA:** Close at explicit closer or EOF
- **Comments:** Close at `-->` or EOF

**Always:** Flag the opening token with `ErrorUnbalancedTokenFallback` so syntax highlighting can show the issue, but rendering/editing behavior remains reasonable.

## Token Vocabulary

### HTML Tag Tokens

```javascript
// scan-tokens.js additions

// HTML tags and attributes
export const HTMLTagOpen = 0x1000000;           // '<' or '</' starting a tag
export const HTMLTagName = 0x1100000;           // tag name (div, span, script, etc.)
export const HTMLAttributeName = 0x1200000;     // attribute name
export const HTMLAttributeEquals = 0x1300000;  // '=' between attribute name and value
export const HTMLAttributeValue = 0x1400000;    // attribute value (quoted or unquoted)
export const HTMLTagClose = 0x1500000;          // '>' or '/>' closing a tag
export const HTMLTagSelfClosing = 0x1600000;    // '/>' specifically

// HTML special content modes
export const HTMLCommentOpen = 0x1700000;       // '<!--'
export const HTMLCommentContent = 0x1800000;    // comment text
export const HTMLCommentClose = 0x1900000;      // '-->'
export const HTMLCDataOpen = 0x1A00000;         // '<![CDATA['
export const HTMLCDataContent = 0x1B00000;      // CDATA content
export const HTMLCDataClose = 0x1C00000;        // ']]>'
export const HTMLDocTypeOpen = 0x1D00000;       // '<!DOCTYPE'
export const HTMLDocTypeContent = 0x1E00000;    // DOCTYPE declaration content
export const HTMLDocTypeClose = 0x1F00000;      // '>' closing DOCTYPE
export const HTMLRawTextContent = 0x2000000;    // Content of script/style elements (not parsed)
export const XMLProcessingInstructionOpen = 0x2100000;  // '<?'
export const XMLProcessingInstructionTarget = 0x2200000; // 'xml', 'xml-stylesheet', etc.
export const XMLProcessingInstructionContent = 0x2300000; // PI content/attributes
export const XMLProcessingInstructionClose = 0x2400000;  // '?>'
```

### Token Flags

```javascript
// scan-token-flags.js additions

export const ErrorUnbalancedHTMLTag = 0x20000;      // Unclosed opening tag
export const ErrorMalformedHTMLTag = 0x40000;       // Invalid tag syntax
export const WarningDeprecatedHTMLTag = 0x80000;    // Deprecated tag (font, center, etc.)
```

## Scanning Architecture

### Scanner Modules

Following the established pattern from doc 8 (scanner invocation patterns):

1. **scan-html-tag.js** - Parse opening/closing tags with attributes (Pattern B - complex)
2. **scan-html-comment.js** - Parse HTML comments (Pattern B - complex)
3. **scan-html-cdata.js** - Parse CDATA sections (Pattern B - complex)
4. **scan-html-doctype.js** - Parse DOCTYPE declarations (Pattern B - complex)
5. **scan-html-raw-text.js** - Parse script/style content (Pattern B - complex)
6. **scan-xml-processing-instruction.js** - Parse XML PIs like `<?xml?>` (Pattern B - complex)

### Pattern Classification

Following the decision criteria from doc 8:

**Pattern A (Return Token):**
- None - all HTML/XML constructs are multi-token

**Pattern B (Push and Return Consumed Length):**
- All HTML/XML scanners - they produce multiple tokens (open, content, close)

### Integration with scan0

```javascript
// In scan0.js main loop:

case 60 /* < */: {
  // Lookahead to determine HTML construct type
  const next = offset < endOffset ? input.charCodeAt(offset) : 0;
  
  // HTML comment: <!--
  if (next === 33 /* ! */ && input.charCodeAt(offset + 1) === 45 /* - */ 
      && input.charCodeAt(offset + 2) === 45 /* - */) {
    const consumed = scanHTMLComment(input, offset - 1, endOffset, output);
    if (consumed > 0) {
      tokenCount = output.length;
      offset += consumed - 1;
      continue;
    }
  }
  
  // HTML CDATA: <![CDATA[
  if (next === 33 /* ! */ && input.startsWith('[CDATA[', offset + 1)) {
    const consumed = scanHTMLCData(input, offset - 1, endOffset, output);
    if (consumed > 0) {
      tokenCount = output.length;
      offset += consumed - 1;
      continue;
    }
  }
  
  // XML Processing Instruction: <?xml?>
  if (next === 63 /* ? */) {
    const consumed = scanXMLProcessingInstruction(input, offset - 1, endOffset, output);
    if (consumed > 0) {
      tokenCount = output.length;
      offset += consumed - 1;
      continue;
    }
  }
  
  // HTML DOCTYPE: <!DOCTYPE
  if (next === 33 /* ! */ && input.substr(offset + 1, 7).toLowerCase() === 'doctype') {
    const consumed = scanHTMLDocType(input, offset - 1, endOffset, output);
    if (consumed > 0) {
      tokenCount = output.length;
      offset += consumed - 1;
      continue;
    }
  }
  
  // HTML tag (opening or closing): <tag> or </tag>
  const consumed = scanHTMLTag(input, offset - 1, endOffset, output);
  if (consumed > 0) {
    tokenCount = output.length;
    offset += consumed - 1;
    continue;
  }
  
  // Fallback: treat as literal '<' in Markdown
  // (could be less-than sign, or malformed tag)
  // Continue to scanInlineText
}
```

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

**Raw text elements** (content not parsed):
- `script`, `style`
- After closing `>` of opening tag, invoke `scanHTMLRawText` which consumes until `</script>` or `</style>`
- Return special `HTMLRawTextContent` token for entire content

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

### Malformed Tag Recovery

**Unclosed opening tag:**
```html
<div class="note
More text here
```
**Strategy:** Close at newline OR at next `<`
**Tokens:**
1. `HTMLTagOpen` with `ErrorUnbalancedHTMLTag` flag
2. `HTMLTagName`
3. Attributes parsed as far as possible
4. Artificial `HTMLTagClose` at newline (flagged as fallback)

**Invalid tag name:**
```html
<123-not-valid>
```
**Strategy:** Treat as literal text, don't tokenize as tag
**Fallback:** Return 0, let `scanInlineText` handle it

**Nested quotes in attributes:**
```html
<div title="He said "hello"">
```
**Strategy:** Parse until first matching quote, flag as malformed
**Tokens:** `HTMLAttributeValue` with `ErrorMalformedHTMLTag` flag

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
**Strategy:** Close at EOF
**Tokens:**
1. `HTMLCommentOpen` with `ErrorUnbalancedHTMLTag` flag
2. `HTMLCommentContent` (everything until EOF)
3. Artificial `HTMLCommentClose` at EOF with `ErrorUnbalancedTokenFallback` flag

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
  output.push(0 | HTMLDocTypeClose | ErrorUnbalancedTokenFallback);
  return offset - start;
}
```

## Raw Text Content (scan-html-raw-text.js)

### Context

After parsing opening tags for `<script>` or `<style>`, the content until the closing tag is NOT parsed as Markdown or HTML.

**Example:**
```html
<script>
  if (x < 5 && y > 10) {
    console.log("This < is not an HTML tag");
  }
</script>

<style>
  div > p { color: red; }
  /* These > and < are CSS selectors */
</style>
```

### Token Sequence

After `HTMLTagClose` of opening `<script>` or `<style>` tag:

1. `HTMLRawTextContent` - entire content until closing tag (length N)
2. Then parse closing tag normally:
   - `HTMLTagOpen` (close variant)
   - `HTMLTagName`
   - `HTMLTagClose`

### Scanning Strategy

```javascript
/**
 * Scan raw text content (script/style).
 * @pattern complex - pushes tokens and returns consumed length (Pattern B)
 * @param {string} input
 * @param {number} start - Index after closing '>' of opening tag
 * @param {number} end - Exclusive end
 * @param {string} tagName - 'script' or 'style' (lowercase)
 * @param {ProvisionalToken[]} output
 * @returns {number} characters consumed or 0
 */
export function scanHTMLRawText(input, start, end, tagName, output) {
  // Search for closing tag: </script> or </style>
  // Case-insensitive search
  const closingTag = '</' + tagName;
  let offset = start;
  
  while (offset < end) {
    const idx = input.indexOf('</', offset);
    if (idx === -1) {
      // No closing tag found - consume until EOF
      const length = end - start;
      output.push(length | HTMLRawTextContent | ErrorUnbalancedHTMLTag);
      return end - start;
    }
    
    // Check if this is the matching closing tag
    let matches = true;
    for (let i = 0; i < tagName.length; i++) {
      const ch = input.charCodeAt(idx + 2 + i);
      const expected = tagName.charCodeAt(i);
      if (ch !== expected && ch !== (expected - 32)) { // case-insensitive
        matches = false;
        break;
      }
    }
    
    // Check for '>' after tag name (or whitespace then '>')
    const afterName = idx + 2 + tagName.length;
    if (matches) {
      const ch = input.charCodeAt(afterName);
      if (ch === 62 /* > */ || ch === 32 || ch === 9 || ch === 10 || ch === 13) {
        // Found it!
        const length = idx - start;
        if (length > 0) {
          output.push(length | HTMLRawTextContent);
        }
        return idx - start; // Caller will parse closing tag
      }
    }
    
    // False alarm, keep searching
    offset = idx + 2;
  }
  
  // EOF reached without finding closer
  const length = end - start;
  if (length > 0) {
    output.push(length | HTMLRawTextContent | ErrorUnbalancedHTMLTag);
  }
  return end - start;
}
```

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
      output.push(0 | XMLProcessingInstructionClose | ErrorUnbalancedTokenFallback);
      return offset - start;
    }
    offset++;
  }
  
  // EOF without finding '?>'
  const contentLength = offset - contentStart;
  if (contentLength > 0) {
    output.push(contentLength | XMLProcessingInstructionContent | ErrorUnbalancedHTMLTag);
  }
  output.push(0 | XMLProcessingInstructionClose | ErrorUnbalancedTokenFallback);
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

**Block-level HTML:**
- Starts on its own line (possibly with leading whitespace)
- Common tags: `div`, `section`, `article`, `aside`, `header`, `footer`, `nav`, `main`, `blockquote`, `ul`, `ol`, `li`, `table`, `p`, `h1-h6`
- **Markdown inside:** Allowed (parsed recursively)

**Inline HTML:**
- Appears within Markdown text
- Common tags: `span`, `a`, `strong`, `em`, `code`, `img`, `br`, `b`, `i`, `u`, `mark`
- **Markdown inside:** Not allowed for most (except special cases like `<div>` used inline)

### Context Stack

To handle nesting, the semantic scanner (not scan0!) maintains a context stack:

```javascript
// In semantic.js (future implementation)
const contextStack = [
  { type: 'document', allowMarkdown: true },
  { type: 'html-div', allowMarkdown: true, tagName: 'div', openOffset: 42 },
  { type: 'markdown-paragraph', allowMarkdown: true },
  { type: 'html-span', allowMarkdown: false, tagName: 'span', openOffset: 156 }
];
```

**Rules:**
1. When `scan0` encounters opening HTML tag, emit tokens
2. Semantic scanner processes tokens and pushes context
3. Next paragraph-chunk from `scan0` respects `allowMarkdown` flag from context
4. When closing tag found, pop context

**Note:** This is semantic-layer concern, not scan0's job. Scan0 just tokenizes ALL tags uniformly.

## Error Handling and Restorative Strategies

### Summary Table

| Construct | Unclosed Scenario | Close At | Flag |
|-----------|------------------|----------|------|
| Opening tag | `<div class="note\n` | Newline or next `<` | `ErrorUnbalancedHTMLTag` on open |
| Closing tag | `</div\n` | Newline | `ErrorMalformedHTMLTag` |
| Comment | `<!-- no close` | EOF | `ErrorUnbalancedHTMLTag` on open |
| CDATA | `<![CDATA[ no close` | EOF | `ErrorUnbalancedHTMLTag` on open |
| DOCTYPE | `<!DOCTYPE html` | EOF | `ErrorUnbalancedHTMLTag` on open |
| DOCTYPE with DTD | `<!DOCTYPE root [\n<!ELEMENT...` | EOF (track `[]` nesting) | `ErrorUnbalancedHTMLTag` on open |
| XML PI | `<?xml version="1.0"` | Newline or EOF | `ErrorUnbalancedHTMLTag` on open |
| Script/style | `<script>` no close | EOF | `ErrorUnbalancedHTMLTag` on content |
| Attribute value | `attr="no close` | Newline or `>` | `ErrorMalformedHTMLTag` on value |

### User Experience During Editing

**Scenario:** User types opening `<div>`:

```markdown
Some text

<div class="note">
```

1. scan0 tokenizes: `HTMLTagOpen`, `HTMLTagName`, `HTMLAttributeName`, `HTMLAttributeValue`, `HTMLTagClose`
2. Semantic scanner sees unclosed `<div>` (no matching `</div>` in paragraph)
3. **During editing:** Leave it open, don't force artificial close yet
4. **On render:** Render as if closed at end of paragraph or next block element
5. **Syntax highlighting:** Show opening tag normally (user is still typing)

**Scenario:** User presses Enter, starts typing heading:

```markdown
Some text

<div class="note">

## Heading
```

1. Blank line triggers paragraph boundary
2. Semantic scanner sees unclosed `<div>` followed by new paragraph with heading
3. **Restorative action:** Artificially close `<div>` before heading
4. **Error flag:** `ErrorUnbalancedHTMLTag` on opening `<div>` token
5. **Syntax highlighting:** Show error on `<div>` line

**Scenario:** User types closing tag:

```markdown
Some text

<div class="note">
Content inside div
</div>

## Heading
```

1. scan0 tokenizes closing tag
2. Semantic scanner matches it with opening tag
3. **Error flag:** Removed (if present)
4. **Syntax highlighting:** Normal rendering

## Token Position Calculation

Following existing provisional token format (doc 3):

**Current format (will migrate to 16-bit length):**
- Bits 0-23: Length (24 bits, max 16,777,215)
- Bits 24-30: Token kind (7 bits, 128 kinds)
- Bit 31: Error/flag bit

**For HTML tokens:**

```javascript
// Example: <div class="note">
// Tokens:
output.push(1 | HTMLTagOpen);                          // '<'
output.push(3 | HTMLTagName);                          // 'div'
output.push(1 | Whitespace);                           // ' '
output.push(5 | HTMLAttributeName);                    // 'class'
output.push(1 | HTMLAttributeEquals);                  // '='
output.push(6 | HTMLAttributeValue);                   // '"note"'
output.push(1 | HTMLTagClose);                         // '>'

// Position calculation (sum of lengths):
// HTMLTagOpen: offset 0, length 1
// HTMLTagName: offset 1, length 3
// Whitespace: offset 4, length 1
// HTMLAttributeName: offset 5, length 5
// etc.
```

**Semantic scanner** will reconstruct positions by summing token lengths, as with other token types.

## Testing Strategy (Annotated Markdown)

Following doc 1 (annotated markdown), create test files:

### parse/tests/7-html-tags.md

```markdown
<div>
1----2
@1 HTMLTagOpen "<"
@2 HTMLTagName "div"

<div class="note">
1----2-3-4-5-6-7
@1 HTMLTagOpen "<"
@2 HTMLTagName "div"
@3 Whitespace " "
@4 HTMLAttributeName "class"
@5 HTMLAttributeEquals "="
@6 HTMLAttributeValue "\"note\""
@7 HTMLTagClose ">"

</div>
1-2---3
@1 HTMLTagOpen "</"
@2 HTMLTagName "div"
@3 HTMLTagClose ">"

<br />
1--2-3
@1 HTMLTagOpen "<"
@2 HTMLTagName "br"
@3 HTMLTagSelfClosing "/>"
```

### parse/tests/8-html-comments.md

```markdown
<!-- comment -->
1---------2-----3
@1 HTMLCommentOpen "<!--"
@2 HTMLCommentContent " comment "
@3 HTMLCommentClose "-->"

<!-- unclosed
1---------2
@1 HTMLCommentOpen "<!--" + ErrorUnbalancedHTMLTag
@2 HTMLCommentContent " unclosed\n" + ErrorUnbalancedTokenFallback
```

### parse/tests/9-html-script-style.md

```markdown
<script>alert("hi")</script>
1------2-3----------4------5
@1 HTMLTagOpen "<"
@2 HTMLTagName "script"
@3 HTMLTagClose ">"
@4 HTMLRawTextContent "alert(\"hi\")"
@5 HTMLTagOpen "</"
(and so on...)
```

### parse/tests/10-html-cdata.md

```markdown
<![CDATA[ <raw> ]]>
1---------2-------3
@1 HTMLCDataOpen "<![CDATA["
@2 HTMLCDataContent " <raw> "
@3 HTMLCDataClose "]]>"
```

### parse/tests/11-html-doctype.md

```markdown
<!DOCTYPE html>
1---------2----3
@1 HTMLDocTypeOpen "<!DOCTYPE"
@2 HTMLDocTypeContent " html"
@3 HTMLDocTypeClose ">"

<!doctype html>
1---------2----3
@1 HTMLDocTypeOpen "<!doctype"
@2 HTMLDocTypeContent " html"
@3 HTMLDocTypeClose ">"

<!DOCTYPE root [
<!ELEMENT root (child)>
]>
1---------2---------------------3
@1 HTMLDocTypeOpen "<!DOCTYPE"
@2 HTMLDocTypeContent " root [\n<!ELEMENT root (child)>\n]"
@3 HTMLDocTypeClose ">"
```

### parse/tests/12-xml-processing-instructions.md

```markdown
<?xml version="1.0"?>
1-2---3--------------4
@1 XMLProcessingInstructionOpen "<?"
@2 XMLProcessingInstructionTarget "xml"
@3 XMLProcessingInstructionContent " version=\"1.0\""
@4 XMLProcessingInstructionClose "?>"

<?xml-stylesheet type="text/css" href="style.css"?>
1-2--------------3----------------------------------4
@1 XMLProcessingInstructionOpen "<?"
@2 XMLProcessingInstructionTarget "xml-stylesheet"
@3 XMLProcessingInstructionContent " type=\"text/css\" href=\"style.css\""
@4 XMLProcessingInstructionClose "?>"

<?target?>
1-2------3
@1 XMLProcessingInstructionOpen "<?"
@2 XMLProcessingInstructionTarget "target"
@3 XMLProcessingInstructionClose "?>"
```

### parse/tests/13-xml-namespaces.md

```markdown
<svg xmlns="http://www.w3.org/2000/svg">
1---2-3-4-----5-6---------------------------7
@1 HTMLTagOpen "<"
@2 HTMLTagName "svg"
@3 Whitespace " "
@4 HTMLAttributeName "xmlns"
@5 HTMLAttributeEquals "="
@6 HTMLAttributeValue "\"http://www.w3.org/2000/svg\""
@7 HTMLTagClose ">"

<svg:rect x="0" y="0" />
1---2----3-4-5-6-7-8-9-10-11
@1 HTMLTagOpen "<"
@2 HTMLTagName "svg:rect"
@3 Whitespace " "
@4 HTMLAttributeName "x"
@5 HTMLAttributeEquals "="
@6 HTMLAttributeValue "\"0\""
@7 Whitespace " "
@8 HTMLAttributeName "y"
@9 HTMLAttributeEquals "="
@10 HTMLAttributeValue "\"0\""
@11 HTMLTagSelfClosing "/>"

<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon" />
1---2-3-4-----------5-6---------------------------7-8-----------9-10------11
@1 HTMLTagOpen "<"
@2 HTMLTagName "use"
@3 Whitespace " "
@4 HTMLAttributeName "xmlns:xlink"
@5 HTMLAttributeEquals "="
@6 HTMLAttributeValue "\"http://www.w3.org/1999/xlink\""
@7 Whitespace " "
@8 HTMLAttributeName "xlink:href"
@9 HTMLAttributeEquals "="
@10 HTMLAttributeValue "\"#icon\""
@11 HTMLTagSelfClosing "/>"
```

## Implementation Checklist

### Phase 1: Token Definitions
- [ ] Add HTML token constants to `scan-tokens.js`
- [ ] Add HTML error flags to `scan-token-flags.js`
- [ ] Update helper functions (getTokenKind, getLength, etc.) if needed

### Phase 2: Basic Tag Scanning
- [ ] Implement `scan-html-tag.js` with Pattern B
  - [ ] Opening tags with attributes
  - [ ] Closing tags
  - [ ] Self-closing tags
  - [ ] Void element detection
  - [ ] XML namespace support (colons in tag/attribute names)
- [ ] Add tests in `parse/tests/7-html-tags.md`
- [ ] Add tests in `parse/tests/13-xml-namespaces.md`
- [ ] Integrate into `scan0.js` at case 60 (`<`)

### Phase 3: Special Content Modes
- [ ] Implement `scan-html-comment.js` with Pattern B
  - [ ] Normal comments
  - [ ] Unclosed comment recovery
- [ ] Add tests in `parse/tests/8-html-comments.md`
- [ ] Implement `scan-html-cdata.js` with Pattern B
  - [ ] Normal CDATA
  - [ ] Unclosed CDATA recovery
- [ ] Add tests in `parse/tests/10-html-cdata.md`
- [ ] Implement `scan-html-doctype.js` with Pattern B
  - [ ] Case-insensitive DOCTYPE
  - [ ] Complex DOCTYPE declarations with DTD subsets
  - [ ] Track square bracket nesting for embedded DTD
- [ ] Add tests in `parse/tests/11-html-doctype.md`
- [ ] Implement `scan-xml-processing-instruction.js` with Pattern B
  - [ ] Parse PI target and content
  - [ ] Handle xml, xml-stylesheet, and custom PIs
  - [ ] Unclosed PI recovery
- [ ] Add tests in `parse/tests/12-xml-processing-instructions.md`

### Phase 4: Raw Text Elements
- [ ] Implement `scan-html-raw-text.js` with Pattern B
  - [ ] Script element content
  - [ ] Style element content
  - [ ] Case-insensitive closing tag search
  - [ ] Unclosed element recovery
- [ ] Add tests in `parse/tests/9-html-script-style.md`
- [ ] Integrate raw text scanning into `scan-html-tag.js` logic
  - Detect script/style tag names
  - Call `scanHTMLRawText` after closing `>`

### Phase 5: Error Handling
- [ ] Implement malformed tag recovery in `scan-html-tag.js`
  - [ ] Unclosed opening tags
  - [ ] Invalid tag names
  - [ ] Malformed attributes
- [ ] Add error-case tests in each test file
- [ ] Verify all error flags are set correctly

### Phase 6: Integration and Performance
- [ ] Run full test suite (`npm test`)
- [ ] Fix any failing tests
- [ ] Performance benchmark on HTML-heavy documents
- [ ] Optimize hot paths if needed

### Phase 7: Documentation
- [ ] Add JSDoc comments to all new scanner functions
- [ ] Update `scan0.js` comments to reference new scanners
- [ ] Add examples to this document based on real test cases
- [ ] Document any edge cases or limitations discovered

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