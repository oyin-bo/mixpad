# Implementation Guide for PR #54: Fixing Setext Heading Parsing

## Why the Current PR #54 Implementation is Insufficient

Your implementation in PR #54 has created the necessary **infrastructure** for proper Setext heading parsing (the buffer, the flush functions, the underline validation), but it has not implemented the **integration logic** that actually uses this infrastructure.

### The Fundamental Problem

Setext headings create a temporal ambiguity in stream-based parsing. When the scanner encounters a line of text, it cannot determine whether that text is:
- Ordinary paragraph content, or
- The content line of a Setext heading

This determination can ONLY be made by examining the NEXT line. Yet by the time the scanner reads the next line, it has already emitted tokens for the previous line to the output stream with incorrect metadata.

**Your current implementation emits tokens eagerly** — as soon as they are scanned, they go into the output array with `depth=0` (not in a heading). When the scanner later discovers an underline on the following line, it's too late to modify the already-emitted tokens from the previous line.

## Definitive Expectation: What Parsing MUST Produce

For Setext headings, ALL tokens on the content line must carry the same heading depth flag as the underline token. This is non-negotiable because:

1. The semantic layer needs uniform depth metadata to reconstruct heading structure
2. The design specification explicitly requires: "all tokens within a heading carry heading depth flags"
3. Without this, the semantic layer receives contradictory information (text says "not in heading", underline says "in heading")

### Case 1: Basic Setext Heading

**Input:**
```markdown
Simple text
===========
```

**Required token output:**
```
Token 1: InlineText "Simple text" depth=1
Token 2: NewLine "\n" depth=0
Token 3: SetextHeadingUnderline "===========" depth=1
```

**Critical point:** Token 1 must have `depth=1` even though at the time of scanning "Simple text", the scanner has not yet seen the underline.

### Case 2: Setext with Inline Formatting

**Input:**
```markdown
**Bold** and *italic*
=====================
```

**Required token output:**
```
Token 1: AsteriskDelimiter "**" depth=1
Token 2: InlineText "Bold" depth=1
Token 3: AsteriskDelimiter "**" depth=1
Token 4: InlineText " and " depth=1
Token 5: AsteriskDelimiter "*" depth=1
Token 6: InlineText "italic" depth=1
Token 7: AsteriskDelimiter "*" depth=1
Token 8: NewLine "\n" depth=0
Token 9: SetextHeadingUnderline "=====================" depth=1
```

**Critical point:** ALL inline tokens (emphasis delimiters, text) must carry `depth=1`. Your current implementation only applies depth to tokens the heading scanner emits directly.

### Case 3: Text That Looks Like It Could Be Setext But Isn't

**Input:**
```markdown
Regular paragraph
Not an underline
```

**Required token output:**
```
Token 1: InlineText "Regular paragraph" depth=0
Token 2: NewLine "\n" depth=0
Token 3: InlineText "Not an underline" depth=0
```

**Critical point:** Because the second line is NOT a valid underline (mixed characters), the first line must be emitted with `depth=0`. But the scanner can only know this after examining the second line.

### Case 4: Edge Case - Blank Line Breaks Association

**Input:**
```markdown
Text line

===
```

**Required token output:**
```
Token 1: InlineText "Text line" depth=0
Token 2: NewLine "\n" depth=0
Token 3: NewLine "\n" depth=0
Token 4: InlineText "===" depth=0
```

**Critical point:** The blank line (Token 3) disqualifies "Text line" from being Setext heading text. The `===` is just literal text. The scanner must recognize that blank lines break Setext association.

### Case 5: Edge Case - List Items Don't Become Setext Headings

**Input:**
```markdown
- List item
===
```

**Required token output:**
```
Token 1: BulletListMarker "-" depth=0
Token 2: InlineText "List item" depth=0
Token 3: NewLine "\n" depth=0
Token 4: InlineText "===" depth=0
```

**Critical point:** Lines that start with block-level constructs (lists, code blocks, ATX headings, HTML tags, etc.) are NOT eligible to become Setext heading text. The scanner must track this.

## The Core Solution Pattern

To achieve the required output, the scanner must implement **speculative parsing with deferred token emission**:

1. **Qualification phase:** When a line completes, determine if it COULD be Setext heading text
   - Not indented 4+ spaces
   - Doesn't start with block markers (list, heading, HTML, etc.)
   - Not a blank line
   - Contains only inline-level tokens

2. **Buffering phase:** If qualified, instead of emitting tokens to the output array, move them to a temporary buffer

3. **Look-ahead phase:** Scan the next line to check if it's a valid Setext underline
   - All `=` characters (level 1) or all `-` characters (level 2)
   - Optional leading indentation (up to 3 spaces)
   - Optional trailing whitespace

4. **Resolution phase:** Based on look-ahead result:
   - If valid underline: apply depth flag to ALL buffered tokens, flush to output, emit underline token
   - If not valid: flush buffered tokens without depth modification, continue normal scanning

5. **Fast-path optimization:** Most lines don't qualify (code blocks, lists, etc.), so the overhead is minimal for typical documents

## What Needs to Change

### Conceptual Changes Needed

**In the main scanning loop (scan0.js):**
- Track whether the current line is eligible for Setext consideration
- At line end (newline), make the buffering decision
- Invoke the look-ahead mechanism
- Route tokens through buffer or directly to output based on Setext eligibility

**In the buffering mechanism (scan-setext-heading.js):**
- Your existing functions are correct but need to be called from scan0
- The buffer should receive tokens that were scanned normally but need delayed emission
- The flush function correctly applies depth bits before emission

**In the ATX heading scanner (scan-atx-heading.js):**
- Currently returns control after emitting opening marker
- Need to ensure ALL subsequent inline tokens on that line also receive the depth flag
- This requires either returning depth context to scan0 or a different coordination mechanism

### Which Files Need Amendment

**Primary integration point:** `parse/scan0.js`
- Add state tracking for "current line could be Setext text"
- Modify newline handling to trigger buffering decision
- Implement look-ahead invocation and conditional flushing
- Add logic to disqualify lines (when code block, list, etc. is detected)

**Buffer coordination:** `parse/scan-setext-heading.js`
- Your existing functions are architecturally sound
- May need minor adjustments to depth bit positions (verify bits 26-28 vs 28-30)
- Ensure flush correctly handles all token types

**Depth propagation:** Consider how inline scanners get depth context
- When ATX heading is active, all inline tokens need the depth flag
- When Setext buffering is active, tokens go to buffer first
- This may require passing additional context to inline scanners or post-processing tokens

### How to Approach the Changes

1. **Start with line qualification logic:** Add tracking in scan0 to know when a line could be Setext text. As you encounter block-level constructs, mark the line as ineligible.

2. **Implement the newline decision point:** When newline is encountered, check if buffering should happen. If yes, extract the line's tokens from output and move them to the Setext buffer.

3. **Add the look-ahead check:** At the buffering decision point, call your existing `checkSetextUnderline` function to examine the next line.

4. **Wire up the flush:** Based on look-ahead result, call your existing `flushSetextBuffer` with or without depth.

5. **Handle the ATX depth propagation separately:** This is an independent concern. Consider whether you want to set a "current heading depth" context variable that inline scanners check, or post-process tokens after emission.

6. **Test incrementally:** Add one piece at a time and verify behavior with simple test cases before moving to complex scenarios.

## Key Architectural Insight

The reason speculative parsing is necessary is that **Markdown's grammar is context-sensitive in the temporal dimension**. The meaning of a line depends on what comes AFTER it, not just what came before. Your scanner is currently forward-only with no backtracking capability, which is correct for performance. The buffer provides the mechanism to delay commitment decisions until sufficient context is available.

Your infrastructure (buffer, flush functions, underline validation) is well-designed. The missing piece is the **decision-making logic** that determines when to use that infrastructure and the **integration points** that route tokens through it.

This is not a flaw in your approach — it's an incomplete implementation. The foundation is solid; it needs the control logic that orchestrates the buffering, look-ahead, and conditional emission based on what the look-ahead discovers.
