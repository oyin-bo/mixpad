// Flags occupy bits 29–30, leaving bit 31 (the sign bit) unused
// and bit 28 free. This ensures all token values are positive and
// leaves a gap between flags and token kinds.
// Flags are allocated from the top down.
export const IsSafeReparsePoint = 0x40000000; // bit 30
export const ErrorUnbalancedToken = 0x20000000; // bit 29

