package mixpad

// Token is a packed provisional/semantic token, mirroring MixPad's 32-bit layout.
//
//	bits 0-15   length   (0xFFFF)
//	bits 16-25  kind      (0x03FF0000, 10 bits)
//	bits 26-28  heading depth (0x1C000000)
//	bits 29-30  flags     (0x60000000)
//	bit  31     unused
type Token = uint32

const (
	lengthMask   = 0x0000FFFF
	kindMask     = 0x03FF0000
	flagsMask    = 0x60000000
	headDepthMsk = 0x1C000000
	headDepthShf = 26
)

// Flags (bits 29-30).
const (
	IsSafeReparsePoint  = 0x40000000
	ErrorUnbalancedFlag = 0x20000000
)

// Token kinds (bits 16-25) — values identical to the JS reference.
const (
	kInlineText    = 0x010000
	kWhitespace    = 0x020000
	kNewLine       = 0x030000
	kEntityNamed   = 0x040000
	kEntityDecimal = 0x050000
	kEntityHex     = 0x060000
	kEscaped       = 0x070000

	kBacktickBoundary = 0x080000
	kInlineCode       = 0x090000
	kFencedOpen       = 0x0A0000
	kFencedContent    = 0x0B0000
	kFencedClose      = 0x0C0000
	kAsteriskDelim    = 0x0D0000
	kUnderscoreDelim  = 0x0E0000
	kTildeDelim       = 0x0F0000

	kHTMLTagOpen        = 0x100000
	kHTMLTagClose       = 0x110000
	kHTMLTagName        = 0x120000
	kHTMLTagSelfClosing = 0x130000
	kHTMLAttrName       = 0x140000
	kHTMLAttrColon      = 0x150000
	kHTMLAttrEquals     = 0x160000
	kHTMLAttrQuote      = 0x170000
	kHTMLAttrValue      = 0x180000
	kPercentEncoding    = 0x190000

	kHTMLCommentOpen    = 0x1A0000
	kHTMLCommentContent = 0x1B0000
	kHTMLCommentClose   = 0x1C0000

	kHTMLCDataOpen    = 0x1D0000
	kHTMLCDataContent = 0x1E0000
	kHTMLCDataClose   = 0x1F0000

	kHTMLDocTypeOpen    = 0x200000
	kHTMLDocTypeContent = 0x210000
	kHTMLDocTypeClose   = 0x220000

	kXMLPIOpen    = 0x230000
	kXMLPITarget  = 0x240000
	kXMLPIContent = 0x250000
	kXMLPIClose   = 0x260000

	kHTMLRawText = 0x270000

	kBulletListMarker  = 0x280000
	kOrderedListMarker = 0x290000
	kTaskListMarker    = 0x2A0000

	kATXHeadingOpen         = 0x2B0000
	kATXHeadingClose        = 0x2C0000
	kSetextHeadingUnderline = 0x2D0000

	kTablePipe             = 0x2E0000
	kTableDelimiterRowMark = 0x2F0000

	kFrontmatterOpen    = 0x300000
	kFrontmatterContent = 0x310000
	kFrontmatterClose   = 0x320000

	kBlockquoteMarker = 0x330000
	kThematicBreak    = 0x340000

	kLinkOpen       = 0x350000
	kLinkClose      = 0x360000
	kImageMarker    = 0x370000
	kLinkDestOpen   = 0x380000
	kLinkDestClose  = 0x390000
	kLinkTitleQuote = 0x3A0000

	// Semantic (resolved) kinds
	kEmphasisOpen       = 0x3B0000
	kEmphasisClose      = 0x3C0000
	kStrongOpen         = 0x3D0000
	kStrongClose        = 0x3E0000
	kStrikethroughOpen  = 0x3F0000
	kStrikethroughClose = 0x400000
	kLinkLabel          = 0x410000
	kLinkDestination    = 0x420000
	kLinkTitle          = 0x430000
	kTableDelimiterCell = 0x440000

	kFormulaOpen    = 0x450000
	kFormulaContent = 0x460000
	kFormulaClose   = 0x470000

	kAngleLinkOpen  = 0x480000
	kAngleLinkURL   = 0x490000
	kAngleLinkEmail = 0x4A0000
	kAngleLinkClose = 0x4B0000
	kRawURL         = 0x4C0000
	kWWWAutolink    = 0x4D0000
	kEmailAutolink  = 0x4E0000
)

func tokLen(t Token) int     { return int(t & lengthMask) }
func tokKind(t Token) Token  { return t & kindMask }
func tokFlags(t Token) Token { return t & flagsMask }
func headingDepth(t Token) int {
	return int((t & headDepthMsk) >> headDepthShf)
}
func withDepth(t Token, depth int) Token {
	return (t &^ headDepthMsk) | (Token(depth&0x7) << headDepthShf)
}
