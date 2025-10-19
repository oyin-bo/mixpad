# Safe Reparse Points

This document outlines the design and contract for "safe reparse points" (shortened to "reparse points") to enable efficient incremental parsing.

## 1. Definition

A **safe reparse point** is a position in the document from which scanning can begin with absolutely no prior state influencing the outcome.

The start of the file (offset 0) and the end of the file (EOF) are implicit safe reparse points.

## 2. The `IsSafeReparsePoint` Flag

A new token flag, `IsSafeReparsePoint`, will be introduced.

- This flag is set on a token to signify that its starting position (`token.offset`) is a safe reparse point.
- The flag marks the **entry point** of a region that can be parsed independently of any preceding content.

## 3. Scanner (`scan0`) Responsibility

The scanner's role is to identify safe reparse points and mark the corresponding tokens with the `IsSafeReparsePoint` flag.

### Mechanism

The scanner will use a simple, forward-only internal state to make this determination. It will **not** use look-behind logic.

A conceptual implementation:
1. The scanner maintains a private internal flag, e.g., `next_token_is_reparse_start`, initialized to `true` (to handle the start of the file at offset 0).
2. At the beginning of its loop to produce the next token, the scanner checks this internal flag.
3. If `next_token_is_reparse_start` is `true`, the new token it is about to emit receives the `IsSafeReparsePoint` flag. The internal flag is then immediately reset to `false`.
4. The scanner proceeds to parse the token.
5. After parsing, it analyzes the outcome. If the token completes a pattern that creates a safe boundary (e.g., a blank line) and the scanner is not in an error-recovery state, it sets `next_token_is_reparse_start` to `true` for the *next* iteration.

This ensures the flag is set on the incoming token of a new safe region, based on the result of parsing the previous region.

### Impact of Error Recovery

If the scanner enters an error-recovery mode (e.g., due to an unclosed comment), its internal state becomes "tainted." It will not set `next_token_is_reparse_start` to `true` again until the structural error is legitimately resolved. This correctly prevents the creation of unreliable reparse points in ambiguous regions of the document.

## 4. Caller Responsibility

The caller (the incremental parsing engine) must adhere to a strict contract.

### `scan0` Contract

The `scan0` function will always be called on a range between two known safe reparse points. It is the caller's responsibility to ensure this. If the caller has no information about reparse points, it must scan the entire file.

### Incremental Parsing Logic

When an edit occurs, the caller will:
1. Identify the change range.
2. Find the closest known safe reparse point *before* the change.
3. Re-scan from that point to a point sufficiently past the edit, or to the next known safe reparse point.
4. **Compare the newly generated reparse points with the old ones** in the scanned region.

If the new reparse points no longer align with the old ones, it means the edit has invalidated the structure downstream. In this case, the caller is responsible for re-issuing a larger `scan0` call, expanding the range to the next known-good safe reparse point, or scanning to the end of the file if necessary.
