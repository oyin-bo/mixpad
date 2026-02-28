// @ts-check

/**
 * Node types represented as numerical enums for fast comparison in hot loops.
 */
export const Document = 1;

// Block Types
export const Paragraph = 2;
export const Heading = 3;
export const Blockquote = 4;
export const List = 5;
export const ListItem = 6;
export const FencedCodeBlock = 7;
// export const HtmlBlock = 8;
export const ThematicBreak = 9;
export const Table = 10;
export const TableRow = 11;
export const TableCell = 12;
export const Frontmatter = 13;
export const FormulaBlock = 14;

// Inline Types
export const Text = 15;
export const Emphasis = 16;
export const Strong = 17;
export const Strikethrough = 18;
export const Link = 19;
export const Image = 20;
export const InlineCode = 21;
export const Autolink = 22;
// export const HtmlTag = 23;
export const HtmlComment = 24;
export const HtmlCData = 25;
export const HtmlDocType = 26;
export const XmlProcessingInstruction = 27;
export const InlineFormula = 28;
export const HtmlElement = 29;

/**
 * Reverse mapping for debugging/serialization
 * @type {Record<number, string>}
 */
export const NodeNames = {
  [Document]: "Document",
  [Paragraph]: "Paragraph",
  [Heading]: "Heading",
  [Blockquote]: "Blockquote",
  [List]: "List",
  [ListItem]: "ListItem",
  [FencedCodeBlock]: "FencedCodeBlock",
  // [HtmlBlock]: "HtmlBlock",
  [ThematicBreak]: "ThematicBreak",
  [Table]: "Table",
  [TableRow]: "TableRow",
  [TableCell]: "TableCell",
  [Frontmatter]: "Frontmatter",
  [FormulaBlock]: "FormulaBlock",
  [Text]: "Text",
  [Emphasis]: "Emphasis",
  [Strong]: "Strong",
  [Strikethrough]: "Strikethrough",
  [Link]: "Link",
  [Image]: "Image",
  [InlineCode]: "InlineCode",
  [Autolink]: "Autolink",
  // [HtmlTag]: "HtmlTag",
  [HtmlComment]: "HtmlComment",
  [HtmlCData]: "HtmlCData",
  [HtmlDocType]: "HtmlDocType",
  [XmlProcessingInstruction]: "XmlProcessingInstruction",
  [InlineFormula]: "InlineFormula",
  [HtmlElement]: "HtmlElement",
};
