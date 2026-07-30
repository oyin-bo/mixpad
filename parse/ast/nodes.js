// @ts-check

import { ASTNode } from './node.js';
import * as NodeTypes from './node-types.js';

// Block Types
export class DocumentNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Document, start); this.children = []; }
}
export class ParagraphNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Paragraph, start); this.children = []; }
}
export class HeadingNode extends ASTNode {
  constructor(context, start, level) { super(context, NodeTypes.Heading, start); this.children = []; this._level = level; }
  get text() {
    if (this._textCache !== null) return this._textCache;
    let raw = super.text;
    if (raw.startsWith(' ')) raw = raw.slice(1);
    this._textCache = raw;
    return raw;
  }
}
export class BlockquoteNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Blockquote, start); this.children = []; }
}
export class ListNode extends ASTNode {
  constructor(context, start, isOrdered, indent = 0) {
    super(context, NodeTypes.List, start);
    this.children = [];
    this._isOrdered = isOrdered;
    this.indent = indent;
  }
}
export class ListItemNode extends ASTNode {
  constructor(context, start, contentIndent) { super(context, NodeTypes.ListItem, start); this.children = []; this._contentIndent = contentIndent; }
}
export class FencedCodeBlockNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.FencedCodeBlock, start); this.children = []; }
}
// HtmlBlockNode removed
export class ThematicBreakNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.ThematicBreak, start); }
}
export class TableNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Table, start); this.children = []; }
}
export class TableRowNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.TableRow, start); this.children = []; }
}
export class TableCellNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.TableCell, start); this.children = []; }
}
export class FrontmatterNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Frontmatter, start); this.children = []; }
}
export class FormulaBlockNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.FormulaBlock, start); this.children = []; }
}

// Inline Types
export class TextNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Text, start); }
}
export class EmphasisNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Emphasis, start); this.children = []; }
}
export class StrongNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Strong, start); this.children = []; }
}
export class StrikethroughNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Strikethrough, start); this.children = []; }
}
export class LinkNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Link, start); this.children = []; }
}
export class ImageNode extends LinkNode {
  constructor(context, start) { super(context, start); this.type = NodeTypes.Image; }
}
export class InlineCodeNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.InlineCode, start); }
}
export class AutolinkNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Autolink, start); }
}
// HtmlTagNode removed
export class HtmlCommentNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.HtmlComment, start); }
}
export class HtmlCDataNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.HtmlCData, start); }
}
export class HtmlDocTypeNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.HtmlDocType, start); }
}
export class XmlProcessingInstructionNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.XmlProcessingInstruction, start); }
}
export class InlineFormulaNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.InlineFormula, start); }
}

export class HtmlElementNode extends ASTNode {
  constructor(context, start) { 
    super(context, NodeTypes.HtmlElement, start); 
    this.children = [];
    this.tagName = ""; 
    this.attributes = []; 
  }
}