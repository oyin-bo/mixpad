# PR #53 and #54 Analysis: Heading Parsing Review

This directory contains a comprehensive analysis of PRs #53 and #54 that attempted to implement ATX and Setext heading parsing for the MixPad parser.

## Quick Start

👉 **Read this first:** [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)

## The Verdict

**Neither PR correctly implements Setext heading parsing.** Both are missing the critical speculative parsing mechanism that allows retroactive application of heading depth flags.

## Document Overview

### 1. [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) 📋
**Start here for a quick overview**

- What's wrong with both PRs
- Side-by-side comparison
- Key findings
- Next steps

### 2. [ANALYSIS_PR53_PR54.md](ANALYSIS_PR53_PR54.md) 🔍
**Detailed technical analysis**

- Why Setext requires speculative parsing
- Line-by-line code review of both PRs
- Missing implementations
- Bit position conflicts
- Test coverage analysis

### 3. [SPECULATIVE_PARSING_TEST.md](SPECULATIVE_PARSING_TEST.md) 🧪
**Concrete test cases showing the problem**

- Examples of correct vs incorrect behavior
- Test Case 1: Basic Setext promotion
- Test Case 2: Text that is NOT a heading
- Test Case 3: Inline formatting in Setext
- Test Cases 4-7: Edge cases
- Implementation requirements derived from tests

### 4. [IMPLEMENTATION_RECOMMENDATIONS.md](IMPLEMENTATION_RECOMMENDATIONS.md) 🛠️
**Step-by-step guide to fix the issues**

- Critical issues to fix
- Bit position resolution
- Detailed code changes needed
- Implementation phases
- Testing strategy
- Performance considerations

## The Core Problem

Setext headings are ambiguous. When scanning:

```markdown
This is text
===========
```

The parser cannot know "This is text" is a heading until it sees the next line.

### What SHOULD Happen
1. ✅ Buffer "This is text" tokens (don't emit yet)
2. ✅ Look ahead at next line
3. ✅ If underline: apply heading depth, then emit
4. ✅ If not underline: emit without depth

### What ACTUALLY Happens in Both PRs
1. ❌ Emit "This is text" immediately with depth=0
2. ❌ Later emit underline with depth=1
3. ❌ Result: Inconsistent (text=0, underline=1)

## Key Findings Summary

| Aspect | PR #53 | PR #54 |
|--------|--------|--------|
| **ATX headings** | ✓ Works | ✓ Works |
| **Depth encoding** | ❌ Missing | ⚠️ Partial |
| **Buffer infrastructure** | ❌ None | ✓ Present |
| **scan0 integration** | ❌ Missing | ❌ Missing |
| **Speculative parsing** | ❌ Missing | ❌ Missing |
| **Tests** | 56 cases | 27 cases |

## What's Missing from Both PRs

The critical scan0 logic for buffering and pre-scanning:

```javascript
// Pseudocode example - not actual implementation
// At end of line:
if (lineCouldBeSetextText) {
  // Buffer this line's tokens
  bufferTokens();
  
  // Pre-scan next line for underline
  if (nextLineIsValidUnderline) {
    flushWithDepth();  // Apply depth retroactively
  } else {
    flushWithoutDepth();
  }
}
```

**This logic exists in NEITHER PR.**

## Recommended Path Forward

1. Use PR #54 as the base (it has buffer infrastructure)
2. Implement scan0 buffering integration
3. Add qualifying line detection
4. Fix ATX depth propagation
5. Add comprehensive depth tests
6. Verify all speculative test cases

See [IMPLEMENTATION_RECOMMENDATIONS.md](IMPLEMENTATION_RECOMMENDATIONS.md) for details.

## Background: The Design Specification

The design document `parse/docs/11-headings.md` specifies:

> **Opportunistic Pre-Scanning Strategy**
> 
> Following the project's strict allocation discipline:
> - Use a module-level reusable buffer to implement efficient, zero-allocation Setext detection
> - When a line that could be Setext heading text is complete, pre-scan the next line to check if it is a valid underline
> - If valid underline found, emit the buffered tokens with heading-depth flags
> - If invalid, emit buffered tokens without heading flags

Neither PR implements this.

## Why This Matters

Without proper speculative parsing:

1. **Semantic layer gets inconsistent data**
   - Text tokens say depth=0 (not in heading)
   - Underline token says depth=1 (in heading)
   - Cannot reconstruct heading structure correctly

2. **Violates design specification**
   - "All tokens within a heading carry heading depth flags"
   - This is impossible without buffering

3. **Tests will fail**
   - Any test asserting depth on Setext heading text will fail
   - (Current tests don't assert depth, which is another problem)

## Technical Details

### Bit Position for Depth

- Design doc specifies bits 28-30
- But bits 29-30 used for flags (conflict!)
- **Resolution:** Use bits 26-28 (as PR #54 does)

### Depth Propagation

All inline tokens must carry depth:
- InlineText ✓
- AsteriskDelimiter ✓
- EntityNamed ✓
- BacktickBoundary ✓
- Escaped ✓

PR #54 only applies depth to tokens emitted directly by ATX scanner.

## Files in This Analysis

```
EXECUTIVE_SUMMARY.md              - Start here
ANALYSIS_PR53_PR54.md             - Detailed analysis
SPECULATIVE_PARSING_TEST.md       - Test cases
IMPLEMENTATION_RECOMMENDATIONS.md - How to fix
README_ANALYSIS.md                - This file
```

## Related Files in Repository

```
parse/docs/11-headings.md         - Design specification
parse/docs/12-scan0-reparse-points.md - Reparse points
parse/scan0.js                    - Main scanner loop
```

## Contact

This analysis was performed to evaluate PRs #53 and #54 against the design specification in `parse/docs/11-headings.md`.

For questions or clarifications, refer to the individual analysis documents or the design specification.

---

**TL;DR:** Neither PR implements speculative parsing. Both emit Setext text tokens before knowing if they're in a heading. This violates the design spec and produces inconsistent depth flags. Fix by implementing buffering and pre-scanning in scan0.
