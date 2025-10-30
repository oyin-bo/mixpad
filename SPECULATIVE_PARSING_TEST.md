# Speculative Parsing Test Cases for Setext Headings

This document demonstrates the expected behavior of speculative parsing for Setext headings.

## Test Case 1: Basic Setext Promotion

Input:
```markdown
This becomes a heading
======================
```

### Current Behavior (Both PRs - INCORRECT)

**Token sequence without speculation:**
```
@1 InlineText "This becomes a heading" depth=0  ← WRONG: should be depth=1
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "======================" depth=1
```

**Problem:** The text line was emitted immediately with depth=0 (not in a heading), but later we discover it IS in a heading when we see the underline.

### Correct Behavior (With Speculative Parsing)

**Token sequence with speculation:**
```
@1 InlineText "This becomes a heading" depth=1  ← CORRECT: depth applied retroactively
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "======================" depth=1
```

**What happens internally:**
1. Scanner encounters "This becomes a heading"
2. Recognizes it could be Setext heading text (no block markers, plain text)
3. **Buffers** the InlineText token instead of emitting to output
4. Encounters newline, buffers that too
5. **Pre-scans** next line, sees valid `=` underline
6. **Applies depth=1** to buffered tokens
7. **Flushes** buffered tokens to output (now with depth=1)
8. Emits SetextHeadingUnderline token

## Test Case 2: Text That Is NOT a Heading

Input:
```markdown
This is just paragraph text
Not an underline because mixed
```

### Current Behavior (Both PRs)

**Token sequence without speculation:**
```
@1 InlineText "This is just paragraph text" depth=0  ← CORRECT for this case
@2 NewLine "\n" depth=0
@3 InlineText "Not an underline because mixed" depth=0
```

**Works by accident** - but only because the underline validation fails. If it were a valid underline, we'd have the depth=0 problem from Test Case 1.

### Correct Behavior (With Speculative Parsing)

**Token sequence with speculation:**
```
@1 InlineText "This is just paragraph text" depth=0  ← CORRECT: no depth (not a heading)
@2 NewLine "\n" depth=0
@3 InlineText "Not an underline because mixed" depth=0
```

**What happens internally:**
1. Scanner encounters "This is just paragraph text"
2. Recognizes it could be Setext heading text
3. **Buffers** the InlineText token
4. Encounters newline, buffers that too
5. **Pre-scans** next line, sees "Not an underline because mixed"
6. Underline validation **fails** (not all same character)
7. **Flushes** buffered tokens WITHOUT applying depth (depth=0)
8. Continues scanning "Not an underline..." as regular text

## Test Case 3: Inline Formatting in Setext Heading

Input:
```markdown
**Bold** and *italic* text
==========================
```

### Current Behavior (Both PRs - INCORRECT)

**Token sequence without speculation:**
```
@1 AsteriskDelimiter "**" depth=0  ← WRONG: should be depth=1
@2 InlineText "Bold" depth=0       ← WRONG: should be depth=1
@3 AsteriskDelimiter "**" depth=0  ← WRONG: should be depth=1
@4 InlineText " and " depth=0      ← WRONG: should be depth=1
@5 AsteriskDelimiter "*" depth=0   ← WRONG: should be depth=1
@6 InlineText "italic" depth=0     ← WRONG: should be depth=1
@7 AsteriskDelimiter "*" depth=0   ← WRONG: should be depth=1
@8 InlineText " text" depth=0      ← WRONG: should be depth=1
@9 NewLine "\n" depth=0
@10 SetextHeadingUnderline "==========================" depth=1
```

### Correct Behavior (With Speculative Parsing)

**Token sequence with speculation:**
```
@1 AsteriskDelimiter "**" depth=1  ← CORRECT: all tokens get depth=1
@2 InlineText "Bold" depth=1
@3 AsteriskDelimiter "**" depth=1
@4 InlineText " and " depth=1
@5 AsteriskDelimiter "*" depth=1
@6 InlineText "italic" depth=1
@7 AsteriskDelimiter "*" depth=1
@8 InlineText " text" depth=1
@9 NewLine "\n" depth=0
@10 SetextHeadingUnderline "==========================" depth=1
```

**What happens internally:**
1. Scanner encounters bold delimiter `**`
2. Recognizes line could be Setext heading text
3. **Buffers** every inline token: delimiters, text, emphasis
4. Encounters newline, buffers that too
5. **Pre-scans** next line, sees valid `=` underline
6. **Applies depth=1** to ALL buffered tokens
7. **Flushes** buffered tokens to output (now with depth=1)
8. Emits SetextHeadingUnderline token

**Critical insight:** ALL inline tokens on the heading text line must get the depth flag, not just InlineText tokens.

## Test Case 4: Blank Line Breaks Setext Association

Input:
```markdown
Text line

===
```

### Current and Correct Behavior

**Token sequence:**
```
@1 InlineText "Text line" depth=0   ← CORRECT: blank line breaks association
@2 NewLine "\n" depth=0
@3 NewLine "\n" depth=0              ← Blank line
@4 InlineText "===" depth=0          ← CORRECT: not a heading underline
```

**What happens internally:**
1. Scanner encounters "Text line"
2. Could be Setext heading text, but...
3. Next line is blank (another newline)
4. Blank line disqualifies the line from Setext pre-scan
5. "Text line" emitted normally with depth=0
6. "===" is just inline text (too short to be thematic break, and no preceding text)

## Test Case 5: List Item Not Eligible for Setext

Input:
```markdown
- List item
===
```

### Current and Correct Behavior

**Token sequence:**
```
@1 BulletListMarker "-" depth=0
@2 InlineText "List item" depth=0
@3 NewLine "\n" depth=0
@4 InlineText "===" depth=0          ← Correct: list items don't become Setext headings
```

**What happens internally:**
1. Scanner encounters `- List item`
2. Recognized as bullet list marker + text
3. List lines are **not eligible** for Setext pre-scan
4. Tokens emitted normally
5. "===" on next line is just inline text

**Design note:** The design doc specifies: "Only plain-text lines and lines with safe inline formatting are buffered and pre-scanned."

## Test Case 6: Code Block Not Eligible for Setext

Input:
```markdown
    Indented code
===
```

### Current and Correct Behavior

**Token sequence:**
```
@1 Whitespace "    " depth=0
@2 InlineText "Indented code" depth=0
@3 NewLine "\n" depth=0
@4 InlineText "===" depth=0
```

**What happens internally:**
1. Scanner encounters 4 spaces + text
2. 4+ space indentation = code block
3. Code blocks are **not eligible** for Setext pre-scan
4. Tokens emitted normally
5. "===" is just inline text

## Test Case 7: Setext After ATX Heading

Input:
```markdown
# ATX Heading

Setext text
===========
```

### Expected Behavior

**Token sequence:**
```
@1 ATXHeadingOpen "#" depth=1
@2 Whitespace " " depth=1
@3 InlineText "ATX Heading" depth=1
@4 NewLine "\n" depth=0
@5 NewLine "\n" depth=0              ← Blank line separates
@6 InlineText "Setext text" depth=1  ← New Setext heading
@7 NewLine "\n" depth=0
@8 SetextHeadingUnderline "===========" depth=1
```

**What happens internally:**
1. ATX heading scanned and emitted normally
2. Blank line emitted
3. "Setext text" buffered (qualified line)
4. Next line pre-scanned, valid underline found
5. Buffered tokens flushed with depth=1
6. Underline token emitted

## Implementation Requirements Summary

From these test cases, we can derive the implementation requirements:

### 1. Qualifying Line Detection

A line qualifies for Setext pre-scan buffering if:
- ✓ Not indented 4+ spaces (would be code)
- ✓ Not starting with block marker (`#`, `>`, `-`, `*`, `+` for lists, etc.)
- ✓ Not a blank line
- ✓ Not inside another block structure (HTML, fence, etc.)
- ✓ Contains only inline tokens (InlineText, emphasis delimiters, entities, code, etc.)

### 2. Buffering Strategy

When a qualifying line is complete (ending with newline):
1. Move all tokens from output back into buffer
2. Or scan into buffer directly instead of output
3. Pre-scan next line for underline

### 3. Depth Application

If underline is valid:
- Apply depth bits to EVERY buffered token
- Depth 1 for `=` underline
- Depth 2 for `-` underline

### 4. Flush Strategy

After pre-scan:
- If valid: flush with depth flags
- If invalid: flush without depth flags
- Clear buffer for reuse

### 5. Performance

Most lines should NOT enter buffering:
- Fast-path for code blocks, lists, other blocks
- Only plain text lines buffered
- Pre-scan is single pass, no allocation
- Buffer reused, not reallocated

## Test Harness Integration

These test cases should be added to the annotated markdown test suite:

**File:** `parse/tests/11-setext-speculative.md`

With position markers and assertions that verify:
- Token types
- Token text
- **Token depth flags**

Example format:
```markdown
This becomes a heading
======================
1                     23
@1 InlineText "This becomes a heading" depth=1
@2 NewLine "\n" depth=0
@3 SetextHeadingUnderline "======================" depth=1
```

Note the `depth=1` assertion on token @1 - this is what both PRs are missing.
