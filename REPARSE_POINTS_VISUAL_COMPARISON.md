# Visual Comparison of Reparse Points Implementations

## Architecture Diagrams

### PR #47: Post-Process Pattern (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ Main Scan Loop                                               │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ START OF ITERATION                        │              │
│  │ • Capture shouldMarkAsReparsePoint        │              │
│  │ • Reset next_token_is_reparse_start       │              │
│  └──────────────────────────────────────────┘              │
│                      ↓                                       │
│  ┌──────────────────────────────────────────┐              │
│  │ TOKEN EMISSION (unchanged)                │              │
│  │ • case 10: NewLine                        │              │
│  │ • case 38: Entity                         │              │
│  │ • case 92: Escape                         │              │
│  │ • ... all other cases ...                 │              │
│  └──────────────────────────────────────────┘              │
│                      ↓                                       │
│  ┌──────────────────────────────────────────┐              │
│  │ END OF ITERATION                          │              │
│  │ • Apply IsSafeReparsePoint to first token │              │
│  │ • Check for blank line pattern            │              │
│  │   - NewLine after NewLine                 │              │
│  │   - NewLine after Whitespace              │              │
│  │ • Update error_recovery_mode              │              │
│  │ • Set next_token_is_reparse_start         │              │
│  └──────────────────────────────────────────┘              │
│                      ↓                                       │
│                 (next iteration)                            │
└─────────────────────────────────────────────────────────────┘

State Variables (2):
• next_token_is_reparse_start: boolean
• error_recovery_mode: boolean

Touch Points: 1 (end of loop)
Code Added: 53 lines
```

### PR #48: Helper Function Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ Main Scan Loop                                               │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ TOKEN EMISSION (all modified)             │              │
│  │                                           │              │
│  │ case 10: NewLine                          │              │
│  │   const prevLen = output.length           │              │
│  │   output.push(NewLine)                    │              │
│  │   markTokensAndUpdateState(prevLen) ──────┼──┐          │
│  │                                           │  │          │
│  │ case 38: Entity                           │  │          │
│  │   const prevLen = output.length           │  │          │
│  │   output.push(entityToken)                │  │          │
│  │   markTokensAndUpdateState(prevLen) ──────┼──┤          │
│  │                                           │  │          │
│  │ ... every case modified similarly ...     │  │          │
│  └──────────────────────────────────────────┘  │          │
│                                                 │          │
│  ┌──────────────────────────────────────────┐  │          │
│  │ Helper: markTokensAndUpdateState()       │◄─┘          │
│  │                                           │              │
│  │ for each new token:                       │              │
│  │   • Check ErrorUnbalancedToken            │              │
│  │   • Apply IsSafeReparsePoint to first     │              │
│  │   • Track lastTokenWasNewLine             │              │
│  │   • Detect two consecutive NewLines       │              │
│  │   • Clear error recovery on blank line    │              │
│  │                                           │              │
│  │ tokenCount = output.length                │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘

State Variables (3):
• nextTokenIsReparseStart: boolean
• lastTokenWasNewLine: boolean
• inErrorRecovery: boolean

Touch Points: ~15 (every case statement)
Code Added: 106 lines
```

### PR #49: Inline Counter Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ Main Scan Loop                                               │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ START OF ITERATION                        │              │
│  │ • Capture mark_as_reparse_point           │              │
│  │ • Reset next_token_is_reparse_start       │              │
│  │ • Store token_start_index                 │              │
│  └──────────────────────────────────────────┘              │
│                      ↓                                       │
│  ┌──────────────────────────────────────────┐              │
│  │ TOKEN EMISSION (all modified)             │              │
│  │                                           │              │
│  │ case 10: NewLine                          │              │
│  │   output.push(NewLine)                    │              │
│  │   consecutive_newlines++                  │              │
│  │   if (consecutive_newlines >= 2)          │              │
│  │     next_token_is_reparse_start = true    │              │
│  │                                           │              │
│  │ case 38: Entity                           │              │
│  │   token |= mark_as_reparse_point ? ... : 0│              │
│  │   output.push(entityToken)                │              │
│  │   consecutive_newlines = 0                │              │
│  │                                           │              │
│  │ case 92: Escape (scanInlineText)          │              │
│  │   scanInlineText(...)                     │              │
│  │   if (mark_as_reparse_point)              │              │
│  │     output[token_start_index] |= flag     │              │
│  │   consecutive_newlines = 0                │              │
│  │                                           │              │
│  │ ... every case has inline logic ...       │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘

State Variables (3):
• next_token_is_reparse_start: boolean
• in_error_recovery: boolean
• consecutive_newlines: number

Touch Points: ~20 (every case, multiple points)
Code Added: 137 lines
```

## Comparison Matrix

| Aspect | PR #47 ⭐ | PR #48 | PR #49 |
|--------|---------|---------|---------|
| **Architecture** | Post-process | Helper function | Inline |
| **Lines Added** | **53** ✅ | 106 | 137 |
| **Touch Points** | **1** ✅ | ~15 | ~20 |
| **State Variables** | **2** ✅ | 3 | 3 |
| **Complexity** | **Low** ✅ | Medium | High |
| **Maintainability** | **Excellent** ✅ | Good | Moderate |
| **Test Count** | 250 | 247 | **252** ✅ |
| **Test Coverage** | Basic | Good | **Comprehensive** ✅ |
| **Existing Test Updates** | ❌ | ✅ | ✅ |
| **Code Repetition** | **Minimal** ✅ | Moderate | High |

## Token Emission Patterns

### PR #47: Clean Separation
```javascript
// Cases remain unchanged:
case 38:
  const entityToken = scanEntity(input, offset - 1, endOffset);
  if (entityToken !== 0) {
    output.push(entityToken);  // ← No changes here
    tokenCount++;
    offset += length - 1;
  }
  continue;

// Single location handles reparse logic:
// (at end of while loop)
if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
  output[tokenStartIndex] |= IsSafeReparsePoint;
}
```

### PR #48: Consistent Pattern
```javascript
// Every case follows same pattern:
case 38:
  const prevLen = output.length;  // ← Added
  const entityToken = scanEntity(input, offset - 1, endOffset);
  if (entityToken !== 0) {
    output.push(entityToken);
    markTokensAndUpdateState(prevLen);  // ← Added
    offset += length - 1;
  }
  continue;
```

### PR #49: Varied Patterns
```javascript
// Simple tokens use inline OR:
case 38:
  const entityToken = scanEntity(input, offset - 1, endOffset);
  if (entityToken !== 0) {
    output.push(entityToken | (mark_as_reparse_point ? IsSafeReparsePoint : 0));  // ← Modified
    consecutive_newlines = 0;  // ← Added
    offset += length - 1;
  }
  continue;

// Multi-token cases use post-apply:
case 92:
  const consumed = scanInlineText(input, offset - 1, endOffset, output);
  if (consumed > 0) {
    if (mark_as_reparse_point && output.length > token_start_index) {  // ← Added
      output[token_start_index] |= IsSafeReparsePoint;  // ← Added
    }
    consecutive_newlines = 0;  // ← Added
    tokenCount = output.length;
    offset += consumed - 1;
  }
  continue;
```

## Test Coverage Comparison

### Basic Coverage (All PRs)
- ✅ File start (offset 0)
- ✅ Single newline (no reparse)
- ✅ Blank line (reparse)
- ✅ Multiple blank lines (reparse)
- ✅ Whitespace-only line (reparse)

### Extended Coverage

| Test Scenario | PR #47 | PR #48 | PR #49 |
|---------------|--------|--------|--------|
| Entity after blank line | ❌ | ❌ | ✅ |
| Emphasis after blank line | ❌ | ❌ | ✅ |
| HTML tag after blank line | ❌ | ❌ | ✅ |
| List marker after blank line | ❌ | ❌ | ✅ |
| Code fence after blank line | ❌ | ❌ | ✅ |
| Error recovery blocks reparse | ✅ | ❌ | ✅ |
| Error recovery EOF marker | ✅ | ❌ | ❌ |
| Multiple tokens after blank | ❌ | ✅ | ❌ |
| Updated existing emphasis tests | ❌ | ✅ | ✅ |

## Recommended Hybrid Approach

```
┌─────────────────────────────────────────────────────────────┐
│ RECOMMENDED: PR #47 Base + Enhancements                      │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Take from PR #47:                                      │  │
│ │ • Clean post-process architecture (53 lines)           │  │
│ │ • Minimal touch points (1 location)                    │  │
│ │ • Simple state machine (2 variables)                   │  │
│ │ • Blank line detection logic                           │  │
│ └────────────────────────────────────────────────────────┘  │
│                            +                                 │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Add from PR #49:                                       │  │
│ │ • Comprehensive test scenarios                         │  │
│ │ • Entity, emphasis, HTML, list, fence tests           │  │
│ │ • Test file: 12-reparse-points.md                     │  │
│ └────────────────────────────────────────────────────────┘  │
│                            +                                 │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Add from PR #48:                                       │  │
│ │ • Existing test updates (6-emphasis.md)                │  │
│ │ • Consider: error recovery clearing on blank line      │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ RESULT: Best architecture + comprehensive testing           │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### PR #47: Best Performance ✅
- Single check at end of loop
- No function call overhead
- Minimal branching

### PR #48: Moderate Performance
- Function call on every token emission
- Loop through new tokens in helper
- Additional state updates

### PR #49: Acceptable Performance
- Inline checks (good for branch prediction)
- No function calls
- But many more branches overall

## Maintenance Scenarios

### Adding a New Token Type

**PR #47**: No changes needed ✅
```javascript
case 999: /* new token */
  output.push(NewTokenType);
  tokenCount++;
  continue;
// Reparse logic works automatically
```

**PR #48**: Add helper call
```javascript
case 999: /* new token */
  const prevLen = output.length;
  output.push(NewTokenType);
  markTokensAndUpdateState(prevLen);  // ← Must remember this
  continue;
```

**PR #49**: Add inline logic
```javascript
case 999: /* new token */
  output.push(NewTokenType | (mark_as_reparse_point ? IsSafeReparsePoint : 0));
  consecutive_newlines = 0;  // ← Must remember this
  continue;
```

### Debugging a Reparse Issue

**PR #47**: Single location ✅
- Set breakpoint at end of loop
- Examine previous tokens
- Check state variables

**PR #48**: Helper function
- Set breakpoint in helper
- Called from many locations
- Need to check caller context

**PR #49**: Multiple locations
- Must check each case
- 20+ locations to consider
- Easy to miss a case

## Conclusion

**PR #47 provides the optimal foundation** with:
- ✅ Minimal code changes
- ✅ Best maintainability
- ✅ Cleanest architecture
- ✅ Best performance

**Enhanced with tests from PR #49** for:
- ✅ Comprehensive coverage
- ✅ Real-world token scenarios
- ✅ Confidence in correctness

This combination delivers production-ready reparse points implementation.
