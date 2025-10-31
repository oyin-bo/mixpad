// @ts-check

// Token kinds occupy bits 16–25.
// This provides 10 bits for token kinds, allowing for 1024 unique kinds.
// Current allocation: 0x01 to 0x2A.
export const InlineText = 0x010000;
export const Whitespace = 0x020000;
export const NewLine = 0x030000;
export const EntityNamed = 0x040000;
export const EntityDecimal = 0x050000;
export const EntityHex = 0x060000;
export const Escaped = 0x070000;
export const BacktickBoundary = 0x080000;
export const InlineCode = 0x090000;
export const FencedOpen = 0x0A0000;
export const FencedContent = 0x0B0000;
export const FencedClose = 0x0C0000;
export const AsteriskDelimiter = 0x0D0000;
export const UnderscoreDelimiter = 0x0E0000;
export const TildeDelimiter = 0x0F0000;

// HTML Tag Tokens
export const HTMLTagOpen = 0x100000;
export const HTMLTagClose = 0x110000;
export const HTMLTagName = 0x120000;
export const HTMLTagSelfClosing = 0x130000;
export const HTMLAttributeName = 0x140000;
export const HTMLAttributeColon = 0x150000;
export const HTMLAttributeEquals = 0x160000;
export const HTMLAttributeQuote = 0x170000;
export const HTMLAttributeValue = 0x180000;
export const PercentEncoding = 0x190000;

// HTML Comment Tokens
export const HTMLCommentOpen = 0x1A0000;
export const HTMLCommentContent = 0x1B0000;
export const HTMLCommentClose = 0x1C0000;

// HTML CDATA Tokens
export const HTMLCDataOpen = 0x1D0000;
export const HTMLCDataContent = 0x1E0000;
export const HTMLCDataClose = 0x1F0000;

// HTML DOCTYPE Tokens
export const HTMLDocTypeOpen = 0x200000;
export const HTMLDocTypeContent = 0x210000;
export const HTMLDocTypeClose = 0x220000;

// XML Processing Instruction Tokens
export const XMLProcessingInstructionOpen = 0x230000;
export const XMLProcessingInstructionTarget = 0x240000;
export const XMLProcessingInstructionContent = 0x250000;
export const XMLProcessingInstructionClose = 0x260000;

// HTML Raw Text Token
export const HTMLRawText = 0x270000;

// List Marker Tokens
export const BulletListMarker = 0x280000;
export const OrderedListMarker = 0x290000;
export const TaskListMarker = 0x2A0000;

// Heading Tokens
export const ATXHeadingOpen = 0x2B0000;
export const ATXHeadingClose = 0x2C0000;
export const SetextHeadingUnderline = 0x2D0000;

// Table Tokens
export const TablePipe = 0x2E0000;
export const TableDelimiterCell = 0x2F0000;
export const TableCellContent = 0x300000;
