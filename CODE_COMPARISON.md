# Side-by-Side Code Comparison

This document shows the actual implementation differences between the three PRs.

## Core State Variables

### PR #47
```javascript
let next_token_is_reparse_start = (startOffset === 0);
let error_recovery_mode = false;
```
- 2 state variables
- Simple boolean tracking

### PR #48
```javascript
let nextTokenIsReparseStart = (startOffset === 0);
let lastTokenWasNewLine = false;
let inErrorRecovery = false;
```
- 3 state variables
- Tracks NewLine separately

### PR #49
```javascript
let next_token_is_reparse_start = (startOffset === 0);
let in_error_recovery = false;
let consecutive_newlines = 0;
```
- 3 state variables
- Counts consecutive NewLines

## Flag Application Strategy

### PR #47 - Post-Processing (Single Location)
```javascript
while (offset < endOffset) {
  const tokenStartIndex = output.length;
  const shouldMarkAsReparsePoint = next_token_is_reparse_start && !error_recovery_mode;
  next_token_is_reparse_start = false;
  
  // ... [token parsing logic] ...
  
  // Apply flag ONCE at end of iteration
  if (shouldMarkAsReparsePoint && output.length > tokenStartIndex) {
    output[tokenStartIndex] |= IsSafeReparsePoint;
  }
  
  // Detect blank line pattern for NEXT iteration
  if (output.length > tokenStartIndex) {
    const lastToken = output[output.length - 1];
    const lastTokenKind = getTokenKind(lastToken);
    const lastTokenFlags = getTokenFlags(lastToken);
    
    if (lastTokenFlags & ErrorUnbalancedToken) {
      error_recovery_mode = true;
    }
    
    if (lastTokenKind === NewLine) {
      if (output.length >= 2) {
        const prevToken = output[output.length - 2];
        const prevTokenKind = getTokenKind(prevToken);
        
        if (prevTokenKind === NewLine || prevTokenKind === Whitespace) {
          if (!error_recovery_mode) {
            next_token_is_reparse_start = true;
          }
        }
      }
    }
  }
}
```
**Lines of flag application logic**: ~1 location  
**Pattern**: Set flag → Parse → Check state

### PR #48 - Helper Function
```javascript
function markTokensAndUpdateState(previousLength) {
  for (let i = previousLength; i < output.length; i++) {
    const token = output[i];
    
    // Check for error flags
    const hasErrorFlag = (getTokenFlags(token) & ErrorUnbalancedToken) !== 0;
    if (hasErrorFlag) {
      inErrorRecovery = true;
    }
    
    // Apply reparse flag to first new token
    if (i === previousLength && nextTokenIsReparseStart && !inErrorRecovery) {
      output[i] = token | IsSafeReparsePoint;
    }
    
    if (i === previousLength) {
      nextTokenIsReparseStart = false;
    }
    
    // Detect blank lines
    const tokenKind = getTokenKind(token);
    if (tokenKind === NewLine) {
      if (lastTokenWasNewLine) {
        nextTokenIsReparseStart = true;
        inErrorRecovery = false;  // Reset on blank line
      }
      lastTokenWasNewLine = true;
    } else if (tokenKind === Whitespace) {
      // Keep lastTokenWasNewLine as is
    } else {
      lastTokenWasNewLine = false;
    }
  }
  tokenCount = output.length;
}

while (offset < endOffset) {
  const ch = input.charCodeAt(offset++);
  
  switch (ch) {
    case 10 /* \n */:
      const prevLen = output.length;
      output.push(NewLine | 1);
      markTokensAndUpdateState(prevLen);  // Called here
      break;
    
    case 38 /* & */:
      const prevLen = output.length;
      const entityToken = scanEntity(input, offset - 1, endOffset);
      if (entityToken !== 0) {
        output.push(entityToken);
        markTokensAndUpdateState(prevLen);  // And here
        // ...
      }
      // ...
  }
}
```
**Lines of flag application logic**: 1 helper function + ~25 call sites  
**Pattern**: Parse → Call helper → Helper sets flag

### PR #49 - Inline Repetition
```javascript
while (offset < endOffset) {
  const mark_as_reparse_point = next_token_is_reparse_start && !in_error_recovery;
  if (next_token_is_reparse_start) {
    next_token_is_reparse_start = false;
  }
  const token_start_index = output.length;
  
  const ch = input.charCodeAt(offset++);
  
  switch (ch) {
    case 10 /* \n */:
      output.push(NewLine | 1);
      tokenCount++;
      consecutive_newlines++;
      if (consecutive_newlines >= 2) {
        next_token_is_reparse_start = true;
      }
      break;
    
    case 38 /* & */:
      const entityToken = scanEntity(input, offset - 1, endOffset);
      if (entityToken !== 0) {
        output.push(entityToken | (mark_as_reparse_point ? IsSafeReparsePoint : 0));
        tokenCount++;
        offset += length - 1;
      } else {
        const consumed = scanInlineText(input, offset - 1, endOffset, output);
        if (consumed > 0) {
          // REPEATED PATTERN #1
          if (mark_as_reparse_point && output.length > token_start_index) {
            output[token_start_index] |= IsSafeReparsePoint;
          }
          tokenCount = output.length;
          offset += consumed - 1;
        }
      }
      consecutive_newlines = 0;  // REPEATED RESET #1
      break;
    
    case 96 /* ` backtick */:
      const consumed = scanFencedBlock(input, offset - 1, endOffset, output);
      if (consumed > 0) {
        // REPEATED PATTERN #2
        if (mark_as_reparse_point && output.length > token_start_index) {
          output[token_start_index] |= IsSafeReparsePoint;
        }
        tokenCount = output.length;
        consecutive_newlines = 0;  // REPEATED RESET #2
        return tokenCount;
      }
      // ... similar pattern repeated ~28 more times
  }
  
  // Check error recovery
  if (output.length > token_start_index) {
    const first_new_token = output[token_start_index];
    const flags = getTokenFlags(first_new_token);
    if (flags & ErrorUnbalancedToken) {
      in_error_recovery = true;
    }
  }
}
```
**Lines of flag application logic**: ~30 repetitions of the same code  
**Pattern**: Parse → Set flag inline → Reset state (repeated everywhere)

## Blank Line Detection Logic

### PR #47
```javascript
// After emitting last token, check previous token
if (lastTokenKind === NewLine) {
  if (output.length >= 2) {
    const prevToken = output[output.length - 2];
    const prevTokenKind = getTokenKind(prevToken);
    
    // NewLine after NewLine or Whitespace = blank line
    if (prevTokenKind === NewLine || prevTokenKind === Whitespace) {
      if (!error_recovery_mode) {
        next_token_is_reparse_start = true;
      }
    }
  }
}
```
✅ Checks two-token sequence  
✅ Handles both NewLine-NewLine and NewLine-Whitespace-NewLine  
✅ Respects error recovery

### PR #48
```javascript
// In markTokensAndUpdateState helper
const tokenKind = getTokenKind(token);
if (tokenKind === NewLine) {
  if (lastTokenWasNewLine) {
    nextTokenIsReparseStart = true;
    inErrorRecovery = false;  // Clears error recovery!
  }
  lastTokenWasNewLine = true;
} else if (tokenKind === Whitespace) {
  // Keep lastTokenWasNewLine as is
} else {
  lastTokenWasNewLine = false;
}
```
✅ Tracks NewLine state across tokens  
✅ Preserves through whitespace  
⚠️ Clears error recovery on blank lines (questionable)

### PR #49
```javascript
case 10 /* \n */:
  output.push(NewLine | 1);
  tokenCount++;
  consecutive_newlines++;
  if (consecutive_newlines >= 2) {
    next_token_is_reparse_start = true;
  }
  break;

case 32 /* space */:
case 9 /* tab */:
  // ... emit whitespace ...
  // Whitespace doesn't reset consecutive_newlines
  continue;

default:
  // ... any other token ...
  consecutive_newlines = 0;  // Reset counter
```
✅ Explicit counter makes logic clear  
✅ Preserves through whitespace  
✅ Resets on content tokens

## Error Recovery Logic

### PR #47
```javascript
const lastTokenFlags = getTokenFlags(lastToken);

if (lastTokenFlags & ErrorUnbalancedToken) {
  error_recovery_mode = true;
}

// When setting next reparse point:
if (!error_recovery_mode) {
  next_token_is_reparse_start = true;
}
```
✅ Enters error mode on error flag  
✅ Prevents reparse points during errors  
❓ Never exits error mode (per spec: "until legitimately resolved")

### PR #48
```javascript
const hasErrorFlag = (getTokenFlags(token) & ErrorUnbalancedToken) !== 0;
if (hasErrorFlag) {
  inErrorRecovery = true;
}

// In blank line detection:
if (lastTokenWasNewLine) {
  nextTokenIsReparseStart = true;
  inErrorRecovery = false;  // Exits on blank line!
}
```
✅ Enters error mode on error flag  
⚠️ Exits error mode on blank lines (may not match spec)

### PR #49
```javascript
if (output.length > token_start_index) {
  const first_new_token = output[token_start_index];
  const flags = getTokenFlags(first_new_token);
  
  if (flags & ErrorUnbalancedToken) {
    in_error_recovery = true;
  }
}

// When setting next reparse point:
const mark_as_reparse_point = next_token_is_reparse_start && !in_error_recovery;
```
✅ Enters error mode on error flag  
✅ Prevents reparse points during errors  
❓ Never exits error mode

## Performance Analysis

### PR #47
```
Per-token overhead:
  - Boolean check: ~1-2 CPU cycles
  - Array length check: ~1 CPU cycle
  - Conditional branch: ~1-2 CPU cycles
  - Flag OR operation: ~1 CPU cycle
  
Total: ~5-6 CPU cycles per token
```

### PR #48
```
Per-token overhead:
  - Function call: ~10-20 CPU cycles
  - Loop setup: ~5 CPU cycles
  - Per-token in loop: ~10 CPU cycles
  - Return: ~5 CPU cycles
  
Total: ~30-40 CPU cycles per token-producing operation
```

### PR #49
```
Per-token overhead:
  - Boolean checks: ~2-3 CPU cycles
  - Multiple condition evaluations: ~3-5 CPU cycles
  - State variable updates: ~2-3 CPU cycles
  - Flag OR operation: ~1 CPU cycle
  
Total: ~8-12 CPU cycles per token
```

**Winner**: PR #47 (lowest overhead)

## Code Maintainability Score

### Scenario: Need to change when reparse flags are applied

**PR #47**: Edit 1 location (the post-processing block)  
**PR #48**: Edit 1 function + verify all 25 call sites  
**PR #49**: Edit ~30 locations throughout the switch statement

### Scenario: Need to add a new token type

**PR #47**: No changes needed (automatic)  
**PR #48**: No changes needed (automatic)  
**PR #49**: Add flag logic + state reset for new case

### Scenario: Need to change error recovery behavior

**PR #47**: Edit 1-2 lines in error detection  
**PR #48**: Edit helper function logic  
**PR #49**: Review all ~30 locations

## Conclusion

The code comparison clearly shows:

1. **PR #47** has the cleanest architecture with separation of concerns
2. **PR #48** adds abstraction but with performance cost
3. **PR #49** prioritizes explicitness over maintainability

For a zero-allocation, performance-critical parser following the principle of "minimal modifications", **PR #47's approach is optimal**.
