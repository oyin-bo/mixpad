# List Parsing in MixPad

**Status:** Planning  
**Date:** 2025-10-05  
**Context:** Comprehensive design for parsing ordered and unordered lists with MixPad's zero-allocation, editor-friendly architecture.

## Executive Summary

Lists are among the most complex structures in Markdown due to:
- **Ambiguous indentation rules** that vary between implementations
- **Interruption semantics** (what can interrupt what)
- **Tight vs loose** rendering based on blank line presence
- **Lazy continuation** allowing partial indentation
- **Nesting complexity** with mixed ordered/unordered lists

MixPad's approach prioritizes:
1. **Intuitiveness over specification compliance** - CommonMark's list rules are notoriously unintuitive
2. **Editor-grade precision** - exact positions for all markers and content
3. **Graceful recovery** - malformed lists degrade predictably
4. **Zero-allocation performance** - packed integer tokens, no temporary objects

## The CommonMark Problem

CommonMark's list specification is ~6000 words long with 70+ examples. Key issues:

**The 4-space vs 2-space debate:**
- CommonMark requires continuation based on marker width + spacing
- `Markdown.pl` allowed 2 spaces, CommonMark allows variable
- Users constantly surprised by indentation rules

**Interruption complexity:**
- Lists can interrupt paragraphs (unlike Gruber's spec)
- Only ordered lists starting with `1.` can interrupt
- Different rules for different marker types

**Lazy continuation confusion:**
- Continuation lines can be less indented than required
- Works for paragraphs but not code blocks or blockquotes
- Creates parser complexity and user confusion

**Tight/loose ambiguity:**
- Blank lines between items make lists "loose"
- Blank lines within items also trigger loose mode
- Nested lists can be tight while parent is loose

MixPad will simplify while maintaining compatibility with common cases.

## Core Principles

### 1. CommonMark Indentation Fidelity

**MixPad follows CommonMark's indentation rules exactly:**

The position of content after the list marker determines continuation indentation. If the marker takes up 2 characters (`- `) and there are no extra spaces, content at column 2+ continues the item. If the marker is `-   ` (with extra spaces), content must be indented further.

```markdown
- foo
  bar     (continuation, indented 2 spaces)

-   foo
    bar   (continuation, indented 4 spaces)
```

**Rationale:** CommonMark's rules, while complex, are **battle-tested**. Changing them would:
- Break existing valid Markdown documents
- Create incompatibility with other parsers
- Risk introducing new ambiguities

This is unlike HTML mixing, where our enhancements don't break existing Markdown.

### 2. Practical Intuitiveness (Within CommonMark)

**Where we can be intuitive:** Error recovery, warnings, and editor feedback—without breaking CommonMark parsing.

**Example - flag but don't break:**
```markdown
- item 1
 item 1 continued (only 1 space - lazy continuation)
- item 2
```

Parse as CommonMark specifies, but flag the lazy continuation with `WarningLazyListContinuation`.

### 3. Forgiving Recovery

**Malformed indentation:**
```markdown
- item 1
 item 1 continued (only 1 space)
- item 2
```

**Strategy:** Treat partially-indented lines as lazy continuation if they could plausibly belong to the item.

**Flag:** Mark with `WarningLazyListContinuation` to help editors show issues.

## Token Vocabulary

### List Marker Tokens

```javascript
// Unordered list markers
BulletListMarker      // -, *, +

// Ordered list markers  
OrderedListMarker     // 1., 2., 1), 2), etc.

// Task list extension (GitHub)
TaskListMarker        // [ ], [x], [X]
```

### Token Encoding

Packed into 31-bit integers:
- **Length** (4-12 bits): Marker length including trailing space
- **Type** (4-6 bits): Token type identifier
- **Indentation** (4-8 bits): Column where marker starts (0-255)
- **Flags** (4-8 bits): Error/warning flags
- **Metadata** (remaining): List-specific data

**Ordered list metadata:**
- Start number (1-999999999)
- Delimiter type (`.` vs `)`)

**Bullet list metadata:**
- Marker character (`-`, `*`, `+`)

### Token Flags

```javascript
ErrorMalformedListMarker       // Invalid marker syntax
WarningLazyListContinuation    // Ambiguous lazy continuation
WarningInconsistentIndentation // Mixing tabs/spaces
WarningMismatchedMarkerType    // Changing bullets mid-list
WarningDeepNesting             // >6 levels deep
```

## Scanning Architecture

### scan0 Phase: List Marker Recognition

**Pattern A** (Return token directly):
- None - list markers always need context

**Pattern B** (Push tokens, return length):
- `scanBulletListMarker` - Recognizes `- `, `* `, `+ `
- `scanOrderedListMarker` - Recognizes `1. `, `2) `, etc.
- `scanTaskListMarker` - Recognizes `[ ]`, `[x]` after bullet

**Invocation:** From `scan0` main loop when line starts with:
1. `-`, `*`, `+` followed by space/tab (bullet list)
2. Digit followed by `.` or `)` and space/tab (ordered list)
3. Check current indentation level to determine if valid marker

### Bullet List Markers

**Syntax:**
```
- item
* item
+ item
```

**Rules:**
1. One of `-`, `*`, `+`
2. Followed by at least one space or tab
3. Can be indented up to 3 spaces from container margin
4. 4+ spaces of indentation = code block, not list

**Implementation:**
```javascript
/**
 * Scan bullet list marker: -, *, or +
 * @pattern simple - returns consumed length (Pattern B)
 */
export function scanBulletListMarker(input, start, end, output, lineIndent) {
  const char = input.charCodeAt(start);
  
  // Must be -, *, or + 
  if (char !== 45 && char !== 42 && char !== 43) return 0;
  
  // Must be followed by space or tab
  if (start + 1 >= end) return 0;
  const next = input.charCodeAt(start + 1);
  if (next !== 32 && next !== 9) return 0;
  
  // Emit marker token (includes marker + one space)
  const markerChar = char;
  output.push(2 | BulletListMarker | (lineIndent << 16) | (markerChar << 24));
  
  return 2;
}
```

### Ordered List Markers

**Syntax:**
```
1. item
2) item
999. item
```

**Rules:**
1. 1-9 digits (`0-9`)
2. Followed by `.` or `)`
3. Followed by at least one space or tab
4. Can be indented up to 3 spaces
5. Start number ≤ 999,999,999

**Implementation:**
```javascript
/**
 * Scan ordered list marker: digits followed by . or )
 * @pattern simple - returns consumed length (Pattern B)
 */
export function scanOrderedListMarker(input, start, end, output, lineIndent) {
  let offset = start;
  let number = 0;
  let digitCount = 0;
  
  // Parse digits (1-9 digits max)
  while (offset < end && digitCount < 9) {
    const ch = input.charCodeAt(offset);
    if (ch >= 48 && ch <= 57) { // 0-9
      number = number * 10 + (ch - 48);
      digitCount++;
      offset++;
    } else {
      break;
    }
  }
  
  if (digitCount === 0 || digitCount > 9) return 0;
  
  // Must have . or ) delimiter
  if (offset >= end) return 0;
  const delim = input.charCodeAt(offset);
  if (delim !== 46 && delim !== 41) return 0; // not . or )
  offset++;
  
  // Must be followed by space or tab
  if (offset >= end) return 0;
  const next = input.charCodeAt(offset);
  if (next !== 32 && next !== 9) return 0;
  offset++;
  
  const length = offset - start;
  const delimBit = delim === 46 ? 0 : 1; // 0 for ., 1 for )
  
  // Pack: length | type | indent | delimiter | start_number
  output.push(
    length | 
    OrderedListMarker | 
    (lineIndent << 16) | 
    (delimBit << 20) |
    (number << 21)
  );
  
  return length;
}
```

### Task List Extension

**Syntax:**
```markdown
- [ ] unchecked
- [x] checked
- [X] also checked
```

**Rules:**
1. Must immediately follow a bullet marker
2. `[` + space or `x`/`X` + `]`
3. Followed by at least one space

**Implementation:**
```javascript
/**
 * Scan task list checkbox after bullet marker
 * Returns 0 if not a task list, length otherwise
 */
export function scanTaskListMarker(input, start, end, output) {
  if (start + 3 >= end) return 0;
  
  if (input.charCodeAt(start) !== 91) return 0; // not [
  
  const check = input.charCodeAt(start + 1);
  const isChecked = (check === 120 || check === 88); // x or X
  const isUnchecked = (check === 32); // space
  
  if (!isChecked && !isUnchecked) return 0;
  if (input.charCodeAt(start + 2) !== 93) return 0; // not ]
  if (input.charCodeAt(start + 3) !== 32) return 0; // not followed by space
  
  const checkedBit = isChecked ? 1 : 0;
  output.push(4 | TaskListMarker | (checkedBit << 16));
  
  return 4;
}
```

## Semantic Phase: List Structure Resolution

### Challenges

1. **Determining list item boundaries** - when does content belong to previous item vs start new item?
2. **Nesting depth calculation** - based on indentation relative to markers
3. **Tight/loose determination** - presence of blank lines
4. **Lazy continuation** - partially indented content
5. **List interruption** - when does a list end?

### Strategy

**Phase approach:**
1. **Collect markers** - scan0 identifies all list markers on block-start lines
2. **Calculate structure** - semantic layer builds hierarchy from indentation
3. **Assign content** - paragraphs, code blocks, etc. belong to items based on indentation
4. **Determine rendering** - tight vs loose based on blank line presence

### Indentation Tracking

**Key insight:** Lists are indentation-sensitive blocks following CommonMark's rules.

The semantic layer must track:

```javascript
// Per list item context
{
  markerIndent: 0,      // Column where marker starts
  markerWidth: 2,       // Width of marker including delimiter (e.g., "- " or "1. ")
  spacesAfterMarker: 1, // Additional spaces between marker and content
  contentIndent: 2,     // markerWidth + spacesAfterMarker
  marker: '- ',         // The actual marker text
  type: 'bullet',       // or 'ordered'
  tight: true           // Initially tight, set false if blank lines found
}
```

**CommonMark's indentation rules:**

**Content belongs to item if:** `lineIndent >= markerIndent + markerWidth + spacesAfterMarker`

**New item starts if:**
- Line has valid list marker at `markerIndent` or less
- AND marker type compatible with list type

**Sublist starts if:**
- Line has valid list marker at `> contentIndent`
- Indented enough to not be at parent's level

### Nesting Example

```markdown
- item 1
  - nested 1.1
    content
  - nested 1.2
- item 2
```

**Structure:**
```
BulletListMarker indent=0 contentIndent=2
  Paragraph "item 1"
  BulletListMarker indent=2 contentIndent=4
    Paragraph "nested 1.1"
    Paragraph "content" (indent=4, belongs to 1.1)
  BulletListMarker indent=2 contentIndent=4
    Paragraph "nested 1.2"
BulletListMarker indent=0 contentIndent=2
  Paragraph "item 2"
```

### Tight vs Loose Lists

**Tight list:**
```markdown
- item 1
- item 2
- item 3
```
**Renders:** `<ul><li>item 1</li>...</ul>` (no `<p>` tags)

**Loose list:**
```markdown
- item 1

- item 2
```
**Renders:** `<ul><li><p>item 1</p></li>...</ul>` (with `<p>` tags)

**Rules:**
1. List is loose if ANY items are separated by blank line
2. List is loose if ANY item contains multiple block elements separated by blank line
3. Otherwise list is tight

**Sublists can have different tight/loose than parent.**

### Lazy Continuation

**CommonMark allows:**
```markdown
- item 1
continuation (not indented enough)
- item 2
```

The "continuation" line belongs to item 1 even though not indented.

**MixPad approach:**
- Allow lazy continuation for paragraph content
- Do NOT allow for code blocks, blockquotes, nested lists
- Flag with `WarningLazyListContinuation`

**Rationale:** Helps editors show user that indentation is ambiguous.

## Interruption Rules

### What can interrupt a list?

1. **Blank line + different block** - unambiguous end
2. **Thematic break** - `---` or `***`
3. **Different marker type** - changes from `-` to `*` or `1.` to `1)`
4. **Dedented marker** - less indented than current list
5. **Four-space indent** - signals code block

### What can a list interrupt?

**Paragraph:**
```markdown
Some text
- list starts (interrupts paragraph)
```

**CommonMark restriction:** Only ordered lists starting with `1.` can interrupt paragraphs.

**MixPad decision:** Follow CommonMark here - it prevents false positives like:
```markdown
The year 1984. The answer is 42.
```

### Implementation

```javascript
/**
 * Can this list marker interrupt a paragraph?
 */
function canInterruptParagraph(marker) {
  if (marker.type === 'bullet') return false; // Never interrupt
  if (marker.type === 'ordered') {
    return marker.startNumber === 1; // Only if starts with 1
  }
  return false;
}
```

## Special Cases & Edge Cases

### Empty List Items

**Valid:**
```markdown
-
- item 2
```

**Renders:** Two items, first is empty.

**Token sequence:**
```
BulletListMarker (length=2)
NewLine
BulletListMarker (length=2)
InlineText "item 2"
```

### Indented Code in Lists

**Four spaces past content indent:**
```markdown
- item
  
      code block
```

**If contentIndent = 2, code needs indent ≥ 6 (2 + 4).**

### Markers Without Space

**Invalid:**
```markdown
-item
1.item
```

**Handling:** Not list markers, treat as regular text.

**May reconsider:** Some implementations accept this. Could add with warning flag.

### Mixed Marker Types

```markdown
- item 1
* item 2
+ item 3
```

**CommonMark:** Three separate lists.

**MixPad:** Follow CommonMark - changing marker type ends list.

**Rationale:** Allows deliberate separation, prevents accidents.

### Start Number Changes

```markdown
1. item 1
2. item 2
5. item 3
```

**Behavior:** Renders as 1, 2, 3 (ignores non-initial numbers).

**HTML:** `<ol start="1"><li>item 1</li>...</ol>`

Only first marker's number matters.

## Testing Strategy

Following MixPad's annotated markdown approach:

```markdown
Simple bullet list:
- item 1
1       2
@1 BulletListMarker "-" indent=0
@2 InlineText "item 1"

Nested list:
- outer
  - inner
1       2
@1 BulletListMarker "-" indent=0
@2 BulletListMarker "-" indent=2

Ordered list:
1. first
1 2     3
@1 OrderedListMarker "1." startNumber=1 delimiter="."
@2 InlineText " "
@3 InlineText "first"

Task list:
- [ ] todo
1 2    3
@1 BulletListMarker "-"
@2 TaskListMarker "[ ]" checked=false
@3 InlineText "todo"

Tight vs loose:
- item 1
- item 2

- item 3
1       2
@1 BulletListMarker "-" (tight=true)
@2 BulletListMarker "-" (tight=false, due to blank line before)
```

## Error Recovery Strategies

### Unclosed Lists

**Scenario:** List reaches EOF without explicit close.

**Strategy:** Close at EOF, no error needed (normal case).

### Malformed Indentation

**Scenario:**
```markdown
- item 1
 partial indent
  - nested?
```

**Strategy:**
1. "partial indent" is lazy continuation (with warning)
2. "- nested?" IS a sublist (indent=2 > contentIndent=2)

**Flag:** `WarningLazyListContinuation` on "partial indent"

### Broken Nesting

**Scenario:**
```markdown
- item
    - deeply nested (4 spaces)
  - back to 2 spaces?
```

**Strategy:** Track nesting stack, "back to 2" closes deep nest, continues at level 1.

### Inconsistent Markers

**Scenario:**
```markdown
- item 1
* item 2
```

**Strategy:** End first list, start new list.

**Flag:** `WarningMismatchedMarkerType` on second marker.

## Performance Considerations

### Zero-Allocation Goals

**Achieve by:**
1. **Token packing** - all marker data in integers
2. **No string slicing** - work with offsets into original input
3. **Indentation as numbers** - column positions, not substring comparisons
4. **Reuse context** - single context object tracks state, no allocations per item

### Incremental Parsing

**Challenge:** Lists can span many lines. How to re-parse efficiently?

**Strategy:**
1. **Line-granular** - re-scan from changed line
2. **Stop at stable boundary** - blank line or dedented marker signals end
3. **Reuse structure** - if indentation pattern unchanged, reuse nesting

**Example:** User types in middle of list item - only re-parse that item and following until stable boundary.

### Speculative Parsing

**When needed:**
- Determining if line is lazy continuation vs new block
## CommonMark Compliance

MixPad follows CommonMark exactly for core parsing, adds value through editor features:

| Feature | CommonMark | MixPad | Notes |
|---------|-----------|--------|-------|
| Indentation model | Marker width + spaces | **Same** | Preserves compatibility |
| Interrupting paragraphs | Only `1.` ordered | **Same** | Prevents false positives |
| Lazy continuation | Always allowed | **Same, flagged** | Parse correctly, warn in editor |
| Marker changes | Ends list | **Same** | Deliberate separation |
| Deep nesting | Unlimited | **Same, >6 warns** | Parse all, warn for UX |
| Tight/loose | Blank line rules | **Same** | Exact CommonMark semantics |

**Our value-add:** Warnings, precise positions, zero-allocation performance, graceful recovery—not syntax changes.
| Feature | CommonMark | MixPad | Rationale |
|---------|-----------|--------|-----------|
| Indentation model | Marker width + spaces | Align with content | Simpler, more consistent |
| Interrupting paragraphs | Only `1.` ordered | Same | Prevents false positives |
| Lazy continuation | Always allowed | Allowed with warning | Editor feedback |
| Marker changes | Ends list | Same | Deliberate separation |
| Deep nesting | Unlimited | >6 warns | Practicality |

## Implementation Checklist

### Block 1: Token Definitions & Basic Scanning
- [ ] Define `BulletListMarker`, `OrderedListMarker`, `TaskListMarker` tokens
- [ ] Implement `scanBulletListMarker`
- [ ] Implement `scanOrderedListMarker`
- [ ] Implement `scanTaskListMarker`
- [ ] Add tests for marker recognition

### Block 2: Indentation & Structure
- [ ] Implement indentation calculation
- [ ] Build list item context tracking
- [ ] Determine content belonging (continuation vs new item)
- [ ] Handle nesting depth
- [ ] Add tests for nesting and indentation

### Block 3: Tight/Loose & Lazy Continuation
- [ ] Implement blank line detection
- [ ] Mark lists as tight or loose
- [ ] Handle lazy continuation
- [ ] Add `WarningLazyListContinuation` flag
- [ ] Add tests for tight/loose rendering

### Block 4: Interruption & Boundaries
- [ ] Implement paragraph interruption rules
- [ ] Detect list endings (marker changes, dedent)
- [ ] Handle thematic breaks
- [ ] Add tests for interruption cases

### Block 5: Error Recovery
- [ ] Handle malformed indentation
- [ ] Recover from broken nesting
- [ ] Mark inconsistent markers with warnings
- [ ] Add tests for error cases

### Block 6: Integration & Performance
- [ ] Integrate with semantic scanner
- [ ] Verify zero-allocation goals
- [ ] Benchmark performance
- [ ] Test incremental parsing

## Open Questions

1. **Should we support Roman numerals** in ordered lists (`i.`, `ii.`, `iii.`)?
   - **Lean:** No - not in CommonMark, adds complexity
   - **Could add later** if user demand exists

2. **What about letter-based lists** (`a.`, `b.`, `c.`)?
   - **Lean:** No - same reasoning
   - **HTML supports** `<ol type="a">` but Markdown doesn't standardize

3. **Deep nesting limit**?
   - **Recommendation:** Warn at >6 levels, still parse
   - **Rationale:** >6 levels usually indicates formatting problem

4. **Allow tabs in markers**?
   - **CommonMark:** Tabs count as up to 4 spaces
   - **MixPad:** Follow CommonMark, but flag inconsistent mixing

5. **Task list syntax variations**?
   - **GitHub:** `[ ]`, `[x]`, `[X]`
   - **Could support:** `[~]` for partially complete?
   - **Lean:** Stick with GitHub syntax for now

## Summary

This design provides:

✅ **Complete token vocabulary** for bullet, ordered, and task lists  
✅ **Simplified indentation model** aligned with visual structure  
✅ **Clear nesting rules** based on content indentation  
✅ **Tight/loose detection** for proper rendering  
✅ **Lazy continuation** with editor warnings  
✅ **Interruption semantics** matching CommonMark where sensible  
✅ **Graceful error recovery** for malformed lists  
✅ **Zero-allocation design** with packed integer tokens  
✅ **Incremental parsing** support for editor use  
✅ **Thorough testing strategy** with annotated markdown  

