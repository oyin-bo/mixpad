// Flags occupy bits 29–30, leaving bit 31 (the sign bit) unused.
// Heading depth is a dedicated 3-bit field in bits 26–28.
// This ensures all token values are positive and leaves
// a clear layout for kind, depth, and flags.
// Flags are allocated from the top down.
export const IsSafeReparsePoint = 0x40000000; // bit 30
export const ErrorUnbalancedToken = 0x20000000; // bit 29

// Heading depth field (3 bits) — bits 26–28
export const HeadingDepthShift = 26;
export const HeadingDepthMask = 0x1C000000; // 0b111 << 26

// Convenience constants for specific depths (1–7)
export const HeadingDepth1 = 0x04000000; // 1 << 26
export const HeadingDepth2 = 0x08000000; // 2 << 26
export const HeadingDepth3 = 0x0C000000; // 3 << 26
export const HeadingDepth4 = 0x10000000; // 4 << 26
export const HeadingDepth5 = 0x14000000; // 5 << 26
export const HeadingDepth6 = 0x18000000; // 6 << 26
export const HeadingDepth7 = 0x1C000000; // 7 << 26

// Table alignment field (shares bits 26-28 with heading depth, no conflict)
export const TableAlignShift = 26;
export const TableAlignMask = 0x1C000000; // 0b111 << 26

// Table alignment constants (values 0-3 in the 3-bit field)
export const AlignNone = 0x00000000;   // 0 << 26
export const AlignLeft = 0x04000000;   // 1 << 26
export const AlignCenter = 0x08000000; // 2 << 26
export const AlignRight = 0x0C000000;  // 3 << 26

