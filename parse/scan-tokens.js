// @ts-check

export const InlineText = 0x100000;
export const Whitespace = 0x200000;
export const NewLine = 0x300000;
export const EntityNamed = 0x400000;
export const EntityDecimal = 0x500000;
export const EntityHex = 0x600000;
export const Escaped = 0x700000;
export const BacktickBoundary = 0x800000;
export const InlineCode = 0x900000;
export const FencedOpen = 0xA00000;
export const FencedContent = 0xB00000;
export const FencedClose = 0xC00000;
export const AsteriskDelimiter = 0xD00000;
export const UnderscoreDelimiter = 0xE00000;
export const TildeDelimiter = 0xF00000;

// HTML Tag Tokens
export const HTMLTagOpen = 0x1000000;
export const HTMLTagClose = 0x1100000;
export const HTMLTagName = 0x1200000;
export const HTMLTagSelfClosing = 0x1300000;
export const HTMLAttributeName = 0x1400000;
export const HTMLAttributeColon = 0x1500000;
export const HTMLAttributeEquals = 0x1600000;
export const HTMLAttributeQuote = 0x1700000;
export const HTMLAttributeValue = 0x1800000;
export const PercentEncoding = 0x1900000;

// HTML Comment Tokens
export const HTMLCommentOpen = 0x1A00000;
export const HTMLCommentContent = 0x1B00000;
export const HTMLCommentClose = 0x1C00000;

// HTML CDATA Tokens
export const HTMLCDataOpen = 0x1D00000;
export const HTMLCDataContent = 0x1E00000;
export const HTMLCDataClose = 0x1F00000;

// HTML DOCTYPE Tokens
export const HTMLDocTypeOpen = 0x2000000;
export const HTMLDocTypeContent = 0x2100000;
export const HTMLDocTypeClose = 0x2200000;

// XML Processing Instruction Tokens
export const XMLProcessingInstructionOpen = 0x2300000;
export const XMLProcessingInstructionTarget = 0x2400000;
export const XMLProcessingInstructionContent = 0x2500000;
export const XMLProcessingInstructionClose = 0x2600000;

// HTML Raw Text Token
export const HTMLRawText = 0x2700000;

// List Marker Tokens
export const BulletListMarker = 0x2800000;
export const OrderedListMarker = 0x2900000;
export const TaskListMarker = 0x2A00000;
