package mixpad

// NodeKind enumerates AST node types (mirrors ast/node-types.js).
type NodeKind uint8

const (
	KindDocument NodeKind = iota + 1
	KindParagraph
	KindHeading
	KindBlockquote
	KindList
	KindListItem
	KindFencedCodeBlock
	KindThematicBreak
	KindTable
	KindTableRow
	KindTableCell
	KindFrontmatter
	KindFormulaBlock
	KindText
	KindEmphasis
	KindStrong
	KindStrikethrough
	KindLink
	KindImage
	KindInlineCode
	KindAutolink
	KindHtmlComment
	KindHtmlCData
	KindHtmlDocType
	KindXmlProcessingInstruction
	KindInlineFormula
	KindHtmlElement
)

var nodeNames = map[NodeKind]string{
	KindDocument: "Document", KindParagraph: "Paragraph", KindHeading: "Heading",
	KindBlockquote: "Blockquote", KindList: "List", KindListItem: "ListItem",
	KindFencedCodeBlock: "FencedCodeBlock", KindThematicBreak: "ThematicBreak",
	KindTable: "Table", KindTableRow: "TableRow", KindTableCell: "TableCell",
	KindFrontmatter: "Frontmatter", KindFormulaBlock: "FormulaBlock",
	KindText: "Text", KindEmphasis: "Emphasis", KindStrong: "Strong",
	KindStrikethrough: "Strikethrough", KindLink: "Link", KindImage: "Image",
	KindInlineCode: "InlineCode", KindAutolink: "Autolink",
	KindHtmlComment: "HtmlComment", KindHtmlCData: "HtmlCData",
	KindHtmlDocType: "HtmlDocType", KindXmlProcessingInstruction: "XmlProcessingInstruction",
	KindInlineFormula: "InlineFormula", KindHtmlElement: "HtmlElement",
}

func (k NodeKind) String() string {
	if n, ok := nodeNames[k]; ok {
		return n
	}
	return "Unknown"
}

// Alignment for table cells.
type Alignment uint8

const (
	AlignNone Alignment = iota
	AlignLeft
	AlignCenter
	AlignRight
)

// Attr is an HTML attribute name/value pair.
type Attr struct {
	Name     string
	Value    string
	HasValue bool
}

// Node is stored in the document arena; children are arena indices. Every field
// a concrete kind might use is declared here so all nodes share one layout.
type Node struct {
	Kind          NodeKind
	Start         int32
	End           int32
	Children      []int32
	Level         uint8
	Ordered       bool
	Indent        int32
	ContentIndent int32
	Align         Alignment
	IsHeader      bool
	Checked       bool
	DestStart     int32
	DestEnd       int32
	InfoStart     int32
	InfoEnd       int32
	TagName       string
	Attrs         []Attr
}

// Document is the parse result: source plus the node arena (root at index 0).
type Document struct {
	Src   string
	Nodes []Node
}

func (d *Document) Root() int32              { return 0 }
func (d *Document) Node(i int32) *Node       { return &d.Nodes[i] }
func (d *Document) Children(i int32) []int32 { return d.Nodes[i].Children }

// Text returns the source a node spans, concatenating children when present.
func (d *Document) Text(i int32) string {
	n := &d.Nodes[i]
	if len(n.Children) > 0 {
		var b []byte
		for _, c := range n.Children {
			b = append(b, d.Text(c)...)
		}
		return string(b)
	}
	if n.End > n.Start {
		return d.Src[n.Start:n.End]
	}
	return ""
}

// URL returns a link/image/autolink destination.
func (d *Document) URL(i int32) string {
	n := &d.Nodes[i]
	if n.DestEnd > n.DestStart {
		return d.Src[n.DestStart:n.DestEnd]
	}
	return ""
}

// Language returns a fenced code block's info string (trimmed).
func (d *Document) Language(i int32) string {
	n := &d.Nodes[i]
	if n.InfoEnd > n.InfoStart {
		return trimSpace(d.Src[n.InfoStart:n.InfoEnd])
	}
	return ""
}

func trimSpace(s string) string {
	i, j := 0, len(s)
	for i < j && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\n' || s[j-1] == '\r') {
		j--
	}
	return s[i:j]
}
