# Headings — Implementation & Test Plan

Comprehensive design for ATX and Setext heading parsing in MixPad's scanner layer, following zero-allocation principles.

## Executive Summary

Headings are fundamental block-level constructs in Markdown that establish document structure. MixPad must support both ATX-style (`#` prefix) and Setext-style (underline) headings with proper token-level recognition while maintaining zero-allocation scanning principles.

**Key challenges:**
1. **Dual syntax:** ATX (`# Heading`) and Setext (`Heading\n===`) require different recognition strategies
2. **Level encoding:** Six levels for ATX (1-6 `#` characters), two for Setext (`=` and `-`)
3. **Ambiguity resolution:** Setext underlines can conflict with thematic breaks and list markers
4. **Line-start context:** Headings are block-level and require precise line-start detection
5. **Whitespace handling:** Leading/trailing spaces, optional closing `#` sequences
6. **Heading depth per-token:** All tokens within a heading carry a 3-bit depth field, permitting the semantic layer to reconstruct heading scope
7. **Zero-allocation constraints:** Must use indices and bit-packed tokens, no substring creation; opportunistic pre-scanning with module-level reusable buffer

This document specifies the token vocabulary, scanner algorithms, ambiguity resolution rules, and annotated-markdown tests that will drive implementation.

## Core Principles

### Scanner Responsibility vs Semantic Layer

**Scanner layer (this document):**
- Detect heading markers (ATX `#` sequences, Setext underlines)
- Emit inline tokens with heading-depth metadata encoded in bits (3-bit depth field)
- Validate syntactic constraints (line-start position, whitespace rules)
- Handle ambiguous cases with clear precedence rules (Setext vs thematic break, etc.)
- Use opportunistic, zero-allocation pre-scanning to disambiguate Setext underlines before committing tokens to output

**Semantic layer (future):**
- Build heading AST nodes from tokens carrying heading-depth metadata
- Extract heading text content from inline tokens
- Generate document outline/TOC
- Handle heading nesting semantics
- Process inline formatting within heading text (already tokenized by scanner)

### Zero-Allocation and Opportunistic Pre-Scanning Strategy

Following the project's strict allocation discipline:
- Use `input.charCodeAt(pos)` for character inspection
- Encode heading level and metadata in token bit fields
- Return consumed length, never create substrings in scanner
- Push numeric tokens to output array
- **Opportunistic pre-scan:** When a line that might be Setext heading text is complete, pre-scan the next line (in a module-level reusable buffer, no allocation) to check if it is a valid underline. If valid underline found, emit the buffered tokens with heading-depth flags. If invalid, emit buffered tokens without heading flags (as normal paragraph/text).
- **Module-level buffer:** Use a single reusable array at module scope (e.g., in `scan-heading-setext.js` or passed via `scan0`) to buffer line tokens during pre-scan. Since `scan0` is non-reentrant, this buffer can be safely reused across multiple line scans without allocation overhead.
- **Fast path:** Most paragraph lines will not trigger Setext pre-scan (they are clearly not candidates, e.g., code blocks, list items, other block markers). Only lines that could potentially be Setext heading text are pre-scanned, and the buffer is flushed immediately after disambiguation.

## Token Vocabulary

### Heading Depth Encoding (All Tokens)

**Heading depth field (3 bits = levels 0-7):**
- Bits 28-30: Heading depth (0 = not in heading, 1-6 = ATX levels 1-6, 7 = Setext level 2, etc. — reserved for semantic layer to define)
- All tokens emitted while inside a heading MUST carry the corresponding depth in bits 28-30
- This includes ATX opening/closing markers, underline markers, and ALL inline tokens (InlineText, emphasis delimiters, entities, code, etc.)

### ATX Heading Tokens

**ATXHeadingOpen** - Opening marker sequence
- Bits 0-15: Length (1-6, the number of `#` characters)
- Bits 20-27: Token type (ATXHeadingOpen = 0x2B00000)
- Bits 28-30: Heading depth (derived from `#` count: 1-6)
- Bit 31: HasClosingSequence flag (1 if optional closing `#` present)

**ATXHeadingClose** - Optional closing marker sequence (if present)
- Bits 0-15: Length (number of trailing `#` characters)
- Bits 20-27: Token type (ATXHeadingClose = 0x2D00000)
- Bits 28-30: Heading depth (same as opening)
- Bit 31: Reserved

**Inline tokens within ATX headings** (InlineText, emphasis delimiters, entities, etc.)
- All carry the same heading depth in bits 28-30 as the ATX opening marker
- Scanner emits these normally but with heading-depth flags set

### Setext Heading Tokens

**No SetextHeadingText token type.** Instead:
- The content line is scanned as normal inline tokens (InlineText, emphasis, entities, code, etc.)
- These inline tokens are buffered in a module-level pre-scan array
- When a valid Setext underline is detected on the next line, the buffered tokens are flushed to the main output array WITH heading-depth flags set (depth 1 for `=`, depth 2 for `-`)

**SetextHeadingUnderline** - The underline sequence (validation marker, not content)
- Bits 0-15: Length (underline length including leading indent)
- Bits 20-27: Token type (SetextHeadingUnderline = 0x2F00000)
- Bits 28-29: Underline character (0 for `=` → depth 1, 1 for `-` → depth 2)
- Bits 30: Underline char as depth flag (depth = 1 + underline_char_bit)
- Bit 31: Reserved

### Error Handling and Recovery

- Invalid ATX heading syntax (no space after `#`, 7+ hashes) → return 0, fall through to inline text
- Invalid Setext underline syntax → buffered tokens emitted without heading flags; underline treated as thematic break or literal text
- No special error tokens needed; invalid headings are simply not recognized as headings

## ATX Heading Parsing (scan-atx-heading.js)

### Syntax Rules

**Valid ATX heading:**
```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

**With optional closing sequence:**
```markdown
# Heading 1 #
## Heading 2 ##
### Heading 3 ###########  (closing can be longer)
```

**Constraints:**
1. Must start at line start or after up to 3 spaces indentation
2. Requires 1-6 `#` characters (7+ is not a heading)
3. Must have at least one space or tab after opening `#` sequence
4. Content runs until end of line or optional closing sequence
5. Closing sequence (if present) must be preceded by space/tab
6. Closing sequence can be any length of `#` characters
7. 4+ spaces indentation = code block, not heading

### Token Sequence and Heading Depth

**Simple ATX heading:**
```markdown
## Hello world
```
Tokens (all carry heading depth = 2):
1. `ATXHeadingOpen` (length=2, depth=2, no-closing-flag)
2. `InlineText` (length=11, "Hello world", depth=2)

**ATX with emphasis inside:**
```markdown
## **Bold** heading
```
Tokens (all carry heading depth = 2):
1. `ATXHeadingOpen` (length=2, depth=2)
2. `AsteriskDelimiter` (length=2, "**", depth=2, CanOpen)
3. `InlineText` (length=4, "Bold", depth=2)
4. `AsteriskDelimiter` (length=2, "**", depth=2, CanClose)
5. `InlineText` (length=8, " heading", depth=2)

**ATX with closing sequence:**
```markdown
## Hello world ##
```
Tokens (all carry heading depth = 2):
1. `ATXHeadingOpen` (length=2, depth=2, has-closing-flag)
2. `InlineText` (length=11, "Hello world", depth=2)
3. `ATXHeadingClose` (length=2, depth=2)

### Scanner Algorithm

**Detection (in scan0.js):**
- When `charCodeAt(pos) === 35` (`#`) at potential line start
- Check line indentation <= 3 spaces (use `countIndentation` helper)
- Count consecutive `#` characters (1-6 required, 7+ fails)
- Verify space or tab follows the `#` sequence

**Opening sequence:**
1. Validate line-start context (indentation <= 3)
2. Count consecutive `#` chars: `openLen`
3. Require `openLen` in range [1, 6]
4. Require `charCodeAt(pos + openLen)` is space (32) or tab (9)
5. Compute heading depth = `openLen` (1-6)
6. Emit `ATXHeadingOpen` token with depth = `openLen` in bits 28-30

**Content scanning:**
1. Start after opening sequence + required space
2. Scan forward, emitting inline tokens (InlineText, emphasis, entities, code, etc.)
3. Set heading depth in every emitted token's bits 28-30 to match opening depth
4. Scan to find:
   - End of line (newline or EOF)
   - OR closing sequence (space/tab + `#` chars + space/tab/EOL)
5. If closing sequence found:
   - Emit `ATXHeadingClose` with same depth
   - Set `HasClosingSequence` flag in opening token
6. If no closing sequence:
   - Continue emitting inline tokens until EOL
   - Trim trailing spaces from last token or emit as separate whitespace handling

**Closing sequence detection:**
- Must be preceded by space (32) or tab (9)
- Count consecutive `#` characters (any length >= 1)
- Must be followed by space, tab, newline, or EOF
- If these conditions fail, treat `#` chars as part of content (emit as InlineText with depth flag)

### Edge Cases

**Heading with no content:**
```markdown
##
##  
```
**Strategy:** Valid heading, emit empty `ATXHeadingText` (length=0)
**Note:** This is a valid zero-length token for text content, not structural marker

**Seven or more `#` characters:**
```markdown
####### Not a heading
```
**Strategy:** Not a valid heading, return 0, let `scanInlineText` handle as literal

**No space after `#`:**
```markdown
##NoSpace
```
**Strategy:** Not a valid heading, return 0, treat as inline text

**Leading spaces (up to 3):**
```markdown
   ## Valid heading
    ## Not a heading (4 spaces = code)
```
**Strategy:** Use `countIndentation` to validate <= 3

**Closing sequence ambiguity:**
```markdown
## Heading with # in middle ## not closing
## Heading with closing ##
```
**Strategy:** Scan from end of line backwards to find last valid closing sequence (must be preceded by space and followed by EOL/space)

**Escaped `#` in content:**
```markdown
## Heading with \# escaped
```
**Strategy:** Scanner doesn't process escapes, that's semantic layer's job. Include `\#` in content.

**Mixed with inline formatting:**
```markdown
## **Bold** and *italic* heading
```
**Strategy:** Scanner emits heading tokens, inline formatting tokens come after during content processing

## Setext Heading Parsing (scan-setext-heading.js)

### Syntax Rules

**Valid Setext heading:**
```markdown
Heading 1
=========

Heading 2
---------
```

**Constraints:**
1. Heading text must be on previous line (single line only)
2. Underline must be all `=` (level 1) or all `-` (level 2)
3. Minimum 1 underline character required
4. Underline can have up to 3 spaces leading indentation
5. Underline can have trailing spaces (ignored)
6. Heading text line cannot be indented 4+ spaces (would be code)
7. Underline cannot be mixed: `=-=` is not valid

### Token Sequence and Heading Depth

**Setext heading with depth flag propagation:**
```markdown
Hello world
===========
```
Tokens:
1. `InlineText` (length=11, "Hello world", depth=1 — *set during Setext confirmation*)
2. `NewLine` (from previous scanning, depth=0)
3. `SetextHeadingUnderline` (length=11, char='=', depth=1)

Note: The underline token marks the Setext pattern; all buffered tokens from the preceding line get retroactively flagged with depth=1.

### Opportunistic Pre-Scanning Algorithm

The scanner uses a **module-level reusable token buffer** to implement efficient, zero-allocation Setext detection:

**Execution flow:**

1. **Normal line scanning (scan0.js main loop):**
   - When a line that could be Setext heading text is complete (ended with newline), check if the line qualifies as potential heading content.
   - Qualify: not code, not list, not another block structure, not blank.
   - For qualifying lines, proceed to step 2 instead of immediately emitting tokens.

2. **Pre-scan next line (module-level buffer in scan-setext-heading.js):**
   - Call `checkSetextUnderline(input, lineEnd, nextLineStart, ...)` to pre-scan the next line.
   - This function scans the next line's characters (without allocation) to determine if it is a valid Setext underline.
   - Use a module-level integer to record: underline char (`=` or `-`), underline length, and validity flag.
   - **Return immediately** — do not emit tokens yet.

3. **Disambiguation:**
   - If valid underline detected: buffered tokens (from the previous line) are emitted WITH heading-depth flags (1 for `=`, 2 for `-`). Then emit the underline token. Consume the underline line entirely.
   - If invalid underline: buffered tokens are emitted WITHOUT heading flags (as normal content). The underline line is processed normally by subsequent block/inline scanners.

4. **Buffer management:**
   - The module-level buffer is a reusable array, e.g., `let setextBuffer = []` at the top of `scan-setext-heading.js` or passed by reference from `scan0`.
   - Tokens are pushed to this buffer during line scanning, then flushed to the main output array (with or without depth flags).
   - Buffer is cleared after each disambiguation; no persistent state between lines.
   - **Non-reentrant guarantee:** Since `scan0` is non-reentrant, this buffer is safe from concurrency issues.

**Pseudo-code illustration:**

```javascript
// In scan0.js main loop, when end of line is reached:
if (isQualifyingLineForSetextPossibility(tokens)) {
  const setextResult = checkSetextUnderline(input, pos, endOfLine);
  if (setextResult.isValid) {
    // Flush buffered tokens WITH heading depth
    flushSetextBuffer(setextBuffer, output, setextResult.depth);
    // Emit underline token
    emitSetextUnderlineToken(output, setextResult);
    pos += setextResult.consumedLength;
  } else {
    // Flush buffered tokens WITHOUT heading depth
    flushSetextBuffer(setextBuffer, output, 0);
  }
  setextBuffer.clear();
}
```

**Fast-path optimization:**
Most paragraph lines will not enter the pre-scan path. Conditions that disqualify a line from Setext consideration:
- Indented 4+ spaces (code block)
- Starts with block marker (`#`, `>`, `- `, `* `, `+ `, etc.)
- Blank line
- Already identified as another block type (list, code fence, HTML, etc.)

Only **plain text lines** and **lines with safe inline formatting** are buffered and pre-scanned. This keeps the common case fast.

### Buffered Tokens and Depth Flagging

When a Setext underline is confirmed:
- All buffered tokens (inline tokens from the previous line) are flushed to the output array.
- Before emission, the heading-depth bits (28-30) of each token are updated to the Setext depth:
  - Depth 1 for `=` underline
  - Depth 2 for `-` underline
- This is done via bit-or operation: `token |= (depth << 28)`
- No token is re-allocated; only the numeric value is modified.

### Ambiguity Resolution

**Setext vs Thematic Break:**
```markdown
Text line
---
```
This could be:
- Setext level 2 heading (text + underline)
- Text paragraph followed by thematic break

**Rule:** If previous line contains text (non-blank, not indented 4+), treat `---` as Setext underline. Otherwise, thematic break takes precedence.

**Setext vs List Marker:**
```markdown
Text
- item
```
**Rule:** Single `-` followed by space is list marker, not Setext. Require 2+ `-` characters for Setext underline. (Common Markdown disambiguates similarly.)

**Multiple underline characters:**
```markdown
Text
-
--
---
```
**Strategy:** Minimum 1 character is technically valid per spec. Accept 1+; semantic layer can validate heading level constraints if needed.

### Edge Cases

**Empty underline:**
```markdown
Text

===
```
**Strategy:** Blank line breaks Setext association; underline is not connected to text. Emit text tokens without heading depth; treat `===` as potential thematic break.

**Mixed underline characters:**
```markdown
Text
=-=
```
**Strategy:** Not valid Setext. Underline buffer check fails; text emitted normally, `=-=` treated as inline text or literal.

**Underline with trailing non-space characters:**
```markdown
Text
=== extra
```
**Strategy:** Invalid underline pattern (trailing non-space). Buffer check fails; not Setext.

**Indented text with underline:**
```markdown
    Code line
    ===
```
**Strategy:** Text indented 4+ spaces = code block. Disqualified from Setext pre-scan; `===` is separate line (possibly code or literal).

## Integration with scan0

### Line-Start Context Tracking

Headings require reliable line-start detection. The scanner must know:
- Current position is at line start (after newline or at input start)
- Current indentation level (0-3 spaces allowed for headings)
- Whether the current line qualifies for Setext pre-scan (plain text, inline formatting only, no block markers)

**Implementation:**
- `scan0` tracks `lineStart` position and `lineIndent` count
- When `#` encountered: check `lineIndent <= 3`, then call `scanATXHeading`
- When `=` or `-` encountered at potential underline position: check if could be Setext underline; call `checkSetextUnderline` only if previous line qualifies
- Use module-level buffer in `scan-setext-heading.js` (or passed by reference) to stage tokens during pre-scan

### Dispatch Logic

**For ATX headings:**
```javascript
case 35: // #
  if (lineIndent <= 3) {
    const consumed = scanATXHeading(input, pos, end, output);
    if (consumed > 0) {
      pos += consumed;
      continue;
    }
  }
  // Fall through to inline text if not valid heading
  break;
```

**For Setext heading pre-scan (opportunistic, only on qualifying lines):**
```javascript
// At end of line in scan0:
if (isQualifyingLineForSetext(lastTokenTypes)) {
  const setextCheck = checkSetextUnderline(input, pos, endPos);
  if (setextCheck.isValid) {
    // Flush buffered tokens WITH depth flags, emit underline
    flushSetextBuffer(output, setextCheck.depth);
    pos += setextCheck.consumedLength;
  } else {
    // Flush without heading flags
    flushSetextBuffer(output, 0);
  }
}
```

**Fast path (most paragraphs skip pre-scan):**
- Code blocks, lists, other block markers: no pre-scan, emit tokens normally
- Blank lines: no pre-scan
- Only plain-text lines with optional inline formatting: enter pre-scan

## Scanner Module Specifications

### parse/scan-atx-heading.js

Export function following Pattern B:

```javascript
/**
 * Scan ATX-style heading (# prefix)
 * 
 * Scans the opening # sequence, then scans content as inline tokens,
 * setting heading depth (bits 28-30) on all emitted tokens.
 * 
 * @param {string} input - The input text
 * @param {number} start - Start index (position of first #)
 * @param {number} end - End index (exclusive)
 * @param {number[]} output - Array to push tokens into
 * @returns {number} Number of characters consumed, or 0 if not valid ATX heading
 */
export function scanATXHeading(input, start, end, output) {
  // Validate opening sequence (1-6 #, followed by space)
  // Emit ATXHeadingOpen with depth = # count
  // Scan content, emitting inline tokens with depth flags set
  // If closing sequence found, emit ATXHeadingClose with depth flags
  // Returns total length consumed (including content and newline)
}
```

**Helper functions:**
```javascript
/**
 * Extract heading depth from token (0-7, where 1-6 are ATX levels)
 * @param {number} token - Any token from heading
 * @returns {number} Depth 1-6 for ATX, 0 if not in heading
 */
export function getHeadingDepth(token) {
  return (token >> 28) & 0x7;
}

/**
 * Check if ATX heading has closing sequence
 * @param {number} token - ATXHeadingOpen token
 * @returns {boolean}
 */
export function hasATXClosingSequence(token) {
  return ((token >> 31) & 1) === 1;
}
```

### parse/scan-setext-heading.js

Module-level reusable buffer and functions:

```javascript
// Module-level buffer (reused across all Setext pre-scans, non-reentrant)
let setextBuffer = [];

/**
 * Check if next line is a valid Setext underline.
 * Does NOT allocate; scans via charCodeAt.
 * 
 * @param {string} input - The input text
 * @param {number} underlineStart - Index where underline line begins
 * @param {number} end - End index (exclusive)
 * @returns {object} { isValid: boolean, depth: 1|2, consumedLength: number }
 */
export function checkSetextUnderline(input, underlineStart, end) {
  // Scan for all= or all- pattern
  // Return validity and depth (1 for =, 2 for -)
  // Consume exactly to end of line (including newline if present)
}

/**
 * Flush buffered tokens to output array, applying heading depth if valid Setext.
 * Clears buffer for reuse.
 * 
 * @param {number[]} output - Main output token array
 * @param {number} depth - Heading depth (0 if not Setext, 1 or 2 if valid)
 */
export function flushSetextBuffer(output, depth) {
  for (let i = 0; i < setextBuffer.length; i++) {
    let token = setextBuffer[i];
    if (depth > 0) {
      // Apply heading depth to lower 3 bits of upper nibble
      token = (token & ~(0x7 << 28)) | ((depth & 0x7) << 28);
    }
    output.push(token);
  }
  setextBuffer.length = 0; // Clear for reuse
}

/**
 * Add token to Setext buffer (during line pre-scan)
 * @param {number} token - Token to buffer
 */
export function bufferSetextToken(token) {
  setextBuffer.push(token);
}

/**
 * Get underline character from SetextHeadingUnderline token
 * @param {number} token
 * @returns {'=' | '-'}
 */
export function getSetextUnderlineChar(token) {
  // Derive from depth: depth 1 = '=', depth 2 = '-'
  const depth = (token >> 28) & 0x7;
  return depth === 1 ? '=' : '-';
}
```

**Integration pattern in scan0.js:**
```javascript
// When end of line reached on a qualifying paragraph line:
if (isPlainTextLine(lastTokens)) {
  const setextResult = checkSetextUnderline(input, lineEndPos, end);
  if (setextResult.isValid) {
    flushSetextBuffer(output, setextResult.depth);
    // Emit underline token
    const underlineToken = SetextHeadingUnderline | (setextResult.depth << 28) | setextResult.consumedLength;
    output.push(underlineToken);
    pos += setextResult.consumedLength;
  } else {
    flushSetextBuffer(output, 0); // No heading flags
  }
}
```

## Annotated-Markdown Tests

Following the project's testing philosophy, create comprehensive test files under `parse/tests/`:

**Development tip:** During implementation, run individual tests using `--test-name-pattern` to quickly verify specific cases without running the entire suite. For example:
```bash
node --test --test-name-pattern="Level 1" parse/tests/test-produce-annotated.js
```

### 9-atx-headings.md

Test coverage:
- All six levels (# through ######)
- With and without closing sequences
- With various content (plain text, empty, whitespace)
- Leading indentation (0-3 spaces valid, 4+ invalid)
- Invalid cases (no space after #, 7+ hashes)
- Edge cases (trailing spaces, closing sequence detection)
- Inline formatting within heading text (all tokens carry depth flags)

Example test format (all tokens within heading carry depth in bits 28-30):
```markdown
# Level 1
1       2
@1 ATXHeadingOpen "#" depth=1
@2 InlineText "Level 1" depth=1

## **Bold** heading
1        2        3        4
@1 ATXHeadingOpen "##" depth=2
@2 AsteriskDelimiter "**" depth=2 CanOpen
@3 InlineText "Bold" depth=2
@4 AsteriskDelimiter "**" depth=2 CanClose
@5 InlineText " heading" depth=2

### Heading 3 ###
1        2              3
@1 ATXHeadingOpen "###" depth=3 has-closing
@2 InlineText "Heading 3" depth=3
@3 ATXHeadingClose "###" depth=3

####### Too many hashes
1
@1 InlineText "####### Too many hashes"
```

### 9-setext-headings.md

Test coverage:
- Level 1 (= underline) and level 2 (- underline)
- Varying underline lengths (1 character, multiple, long)
- Leading indentation on underline (0-3 spaces)
- Invalid cases (blank line before underline, mixed characters)
- Ambiguity cases (vs thematic break, vs list marker)
- Multi-line text (only last line becomes heading when valid underline found)
- All inline tokens within Setext heading carry depth flags

Example test format (tokens buffered and flushed with depth flags when valid underline confirmed):
```markdown
Heading 1
=========
1                      2
@1 InlineText "Heading 1" depth=1
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "=========" depth=1

Text
-
1                  2
@1 InlineText "Text" depth=2
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "-" depth=2

**Bold** setext
================
1                  2                  3                  4
@1 AsteriskDelimiter "**" depth=1 CanOpen
@2 InlineText "Bold" depth=1
@3 AsteriskDelimiter "**" depth=1 CanClose
@4 InlineText " setext" depth=1
@5 NewLine "\n" depth=0
@6 SetextHeadingUnderline "================" depth=1

Text

===
1                  2                  3
@1 InlineText "Text"
@2 NewLine "\n\n"
@3 InlineText "==="
```

Note: When Setext underline is invalid (or conditions prevent pre-scan), all buffered tokens are flushed without depth flags.

### 9-heading-edge-cases.md

Test coverage:
- Headings at start of input (no preceding newline)
- Headings at end of input (no trailing newline)
- Consecutive headings (both ATX and Setext)
- Headings with inline code, emphasis, entities
- Headings with escaped characters (escaped content processed during inline scan)
- Unicode in heading text
- Very long headings (test length field boundaries)
- Interaction with other block structures
- Pre-scan not triggered: code blocks, lists, HTML blocks remain non-heading

## Performance Considerations

### Zero-Allocation Compliance

**Character inspection:**
- Use `charCodeAt(pos)` exclusively
- Never call `substring`, `slice`, or `charAt`
- No regular expressions

**Token encoding:**
- Pack level and flags into token bits
- Use bit shifts and masks for encoding/decoding
- No object creation for token metadata

**Content extraction:**
- Store only start position and length in tokens
- Semantic layer retrieves content via `input.substring(start, start+length)`
- Scanner never creates text substrings

### Length Field Constraints

**Current design uses 16 bits for length:**
- Maximum token length: 65,535 characters
- Heading text longer than this must be split into multiple tokens
- Or use 20-bit length field (lower 20 bits) as in some other scanners

**Recommendation:** Use 20-bit length (bits 0-19) to match existing token patterns in the codebase. This allows heading text up to ~1M characters.

### Lookahead Efficiency

**ATX headings:**
- Minimal lookahead: count `#` chars (max 7 characters)
- Check for space after `#` sequence (1 character)
- Scan to EOL or closing sequence (linear scan, unavoidable)

**Setext headings:**
- Requires checking previous line (already scanned)
- Underline validation: scan until EOL (linear)
- Token array modification: O(1) to replace last token

## Error Handling and Recovery

### Invalid Syntax Fallback

When heading syntax is invalid:
1. Return 0 from scanner
2. Let `scan0` fall through to next dispatcher
3. Content processed as inline text, thematic break, or list marker

**No error tokens needed** - invalid headings are simply not recognized, content parsed as other constructs.

### Malformed Headings

**ATX with invalid level:**
```markdown
####### Seven hashes
```
**Strategy:** Not a heading, treat as inline text (starts with `#` characters)

**Setext with invalid underline:**
```markdown
Text
=-=
```
**Strategy:** Not valid, treat `=-=` as inline text

### Edge of Input

**Heading at EOF without newline:**
```markdown
## Heading at end
```
**Strategy:** Valid heading, content runs until `end` of input

**Incomplete Setext:**
```markdown
Text line
=
[EOF]
```
**Strategy:** Valid Setext heading (minimum 1 underline character)

## Implementation Order

Recommended sequence to minimize risk and enable incremental testing:

### Phase 1: ATX Headings (Lower Risk)
1. Write annotated-markdown tests for ATX (`9-atx-headings.md`)
2. Implement `scan-atx-heading.js` with full validation
3. Wire into `scan0.js` for `#` character dispatch
4. Run tests, iterate until passing

### Phase 2: Setext Headings (Higher Risk)
1. Write annotated-markdown tests for Setext (`9-setext-headings.md`)
2. Implement `scan-setext-heading.js` with token upgrade logic
3. Wire into `scan0.js` for `=` and `-` character dispatch
4. Handle ambiguity with thematic breaks and list markers
5. Run tests, iterate until passing

### Phase 3: Edge Cases and Integration
1. Write edge case tests (`9-heading-edge-cases.md`)
2. Test interaction with other block constructs
3. Validate zero-allocation compliance (no allocations in scanner)
4. Performance smoke tests (long headings, many headings)

### Phase 4: Documentation and Review
1. Update this document with implementation notes
2. Document any deviations or design decisions
3. Add examples to main README if appropriate

## Architectural Highlights: Module-Level Buffer and Fast-Path Design

### Zero-Allocation Pre-Scanning

The Setext heading implementation uses a **module-level reusable buffer** (`setextBuffer`) to achieve opportunistic disambiguation without allocations:

- **Single buffer, reused:** The buffer is declared at module scope in `scan-setext-heading.js` and persists across all line scans.
- **Non-reentrant guarantee:** Since `scan0` is non-reentrant (only one scan pass at a time), this module-level state is safe from concurrency issues.
- **Clear and reuse:** After each line's pre-scan result (valid or invalid), the buffer is cleared (`setextBuffer.length = 0`) and reused for the next line. No allocation overhead.
- **Bit-or depth application:** When flushing with a valid Setext depth, tokens are modified via bit-or operation: `token = (token & ~mask) | (depth << 28)`. This is O(1) per token and requires no new allocations.

### Fast-Path: Most Paragraphs Do Not Pre-Scan

The pre-scan only triggers for lines that qualify as potential Setext heading text. Most input skips the buffer entirely:

**Lines that skip pre-scan (common cases):**
- Code blocks (4+ space indent)
- List items (`- `, `* `, `+ ` or ordered markers)
- Block quotes (`>`)
- Other block-level markers (HTML, fences, etc.)
- Blank lines

**Lines that enter pre-scan buffer:**
- Plain-text paragraphs
- Inline-formatted content (emphasis, code, entities, etc. — anything emitted by inline scanners)

This design ensures the overhead of buffering is only paid for candidate lines, not the entire document.

### Token Depth Propagation

All tokens emitted within a heading (ATX or Setext) carry a 3-bit depth field in bits 28-30:

- **ATX:** Depth is set immediately when emitting the opening marker and applies to all subsequent tokens on that line.
- **Setext:** Tokens are buffered without depth during the first line scan. If the next line's pre-scan confirms a valid underline, the buffered tokens are flushed with depth bits applied (depth 1 for `=`, depth 2 for `-`).

This allows the semantic layer to reconstruct heading scope and structure without requiring a separate parse pass.

### Functional Requirements
- ✅ All six ATX levels recognized correctly
- ✅ Optional closing sequences handled
- ✅ Setext level 1 and 2 recognized
- ✅ Indentation rules enforced (0-3 spaces)
- ✅ Invalid headings fall back gracefully
- ✅ Ambiguity with thematic breaks resolved correctly

### Architectural Requirements
- ✅ Zero allocations in scanner (no substrings/slices)
- ✅ Tokens use bit-packed integers only
- ✅ Pattern B followed (push tokens, return length)
- ✅ No regular expressions used
- ✅ JavaScript with JSDoc (no TypeScript)
- ✅ Line-start context properly tracked

### Testing Requirements
- ✅ All annotated-markdown tests pass
- ✅ Edge cases covered comprehensively
- ✅ Run via `npm test` with no failures
- ✅ No infinite loops (timeout protection active)
- ✅ No zero-length structural tokens emitted

### Code Quality
- ✅ JSDoc comments on all exported functions
- ✅ Helper functions for token metadata extraction
- ✅ Consistent naming with existing scanners
- ✅ No trailing commas (project convention)
- ✅ Array types use `T[]` not `Array<T>` style

## Future Enhancements (Deferred)

The following are explicitly out of scope for scanner implementation:

### Semantic Processing
- Heading ID generation for anchors
- Duplicate heading detection
- Heading nesting validation
- Table of contents generation
- Heading numbering schemes

### Inline Content
- Emphasis/strong within headings (handled by inline scanners)
- Link parsing within headings
- Entity decoding
- Inline code processing

### Advanced Features
- Custom heading attributes (e.g., `{#custom-id}`)
- Heading level limits/validation
- Accessible heading structure
- Markdown extensions (PHP Markdown Extra, etc.)

These features belong in the semantic/parser layer and will be addressed in future work.

## Conclusion

This plan provides a complete specification for heading recognition at the scanner level. The implementation should be straightforward and low-risk, following established patterns from HTML element parsing and code fence implementation.

**Key success factors:**
1. Write tests first (annotated-markdown as specification)
2. Implement ATX before Setext (simpler, lower risk)
3. Maintain zero-allocation discipline throughout
4. Handle ambiguity cases explicitly and document decisions
5. Integrate incrementally with frequent test runs

The resulting scanner will provide stable, efficient heading tokens for the semantic layer to build document structure without requiring re-parsing or allocation during the scan phase.
