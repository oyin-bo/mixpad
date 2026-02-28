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
  get level() { return this._level; }
  get text() {
    // Typically we don't want the `# ` prefix in the heading's textual content, but right now the children span the whole text including whitespace
    // We will let text() on a Heading strip the leading space if the first child is text.
    if (this._textCache !== undefined && this._textCache !== null) return this._textCache;
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
  constructor(context, start, isOrdered) { super(context, NodeTypes.List, start); this.children = []; this._isOrdered = isOrdered; }
  get isOrdered() { return this._isOrdered; }
}
export class ListItemNode extends ASTNode {
  constructor(context, start, contentIndent) { super(context, NodeTypes.ListItem, start); this.children = []; this._contentIndent = contentIndent; }
}
export class FencedCodeBlockNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.FencedCodeBlock, start); this.children = []; this._language = null; this.infoStart = 0; this.infoEnd = 0; }
  get language() {
    if (this._language !== null) return this._language;
    if (this.infoEnd > this.infoStart) { this._language = this._ctx.sourceText.substring(this.infoStart, this.infoEnd).trim(); } else { this._language = ""; }
    return this._language;
  }
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
  constructor(context, start) { super(context, NodeTypes.Text, start); this._textCache = null; }
  get text() {
    if (this._textCache !== null) return this._textCache;
    this._textCache = this._ctx.sourceText.substring(this.start, this.end);
    return this._textCache;
  }
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
  constructor(context, start) { super(context, NodeTypes.Link, start); this.children = []; this.destStart = 0; this.destEnd = 0; this._url = null; }
  get url() {
    if (this._url !== null) return this._url;
    if (this.destStart < this.destEnd) {
      this._url = this._ctx.sourceText.substring(this.destStart, this.destEnd);
    } else { this._url = ""; }
    return this._url;
  }
}
export class ImageNode extends LinkNode {
  constructor(context, start) { super(context, start); this.type = NodeTypes.Image; }
}
export class InlineCodeNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.InlineCode, start); }
}
export class AutolinkNode extends ASTNode {
  constructor(context, start) { super(context, NodeTypes.Autolink, start); this.destStart = 0; this.destEnd = 0; this._url = null; }
  get url() {
    if (this._url !== null) return this._url;
    if (this.destStart < this.destEnd) { this._url = this._ctx.sourceText.substring(this.destStart, this.destEnd); } else { this._url = ""; }
    return this._url;
  }
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