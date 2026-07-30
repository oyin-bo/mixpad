// @ts-check

import { ASTNode } from './node.js';
import * as NodeTypes from './node-types.js';

/** @typedef {import('./parser.js').ParseContext} ParseContext */

// Block Types
export class DocumentNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Document, start); this._container(); }
}
export class ParagraphNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Paragraph, start); this._container(); }
}
export class HeadingNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start @param {number} level */
  constructor(context, start, level) { super(context, NodeTypes.Heading, start); this._container(); this._level = level; }
}
export class BlockquoteNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Blockquote, start); this._container(); }
}
export class ListNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start @param {boolean} isOrdered @param {number} [indent] */
  constructor(context, start, isOrdered, indent = 0) {
    super(context, NodeTypes.List, start);
    this._container();
    this._isOrdered = isOrdered;
    this.indent = indent;
  }
}
export class ListItemNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start @param {number} contentIndent */
  constructor(context, start, contentIndent) { super(context, NodeTypes.ListItem, start); this._container(); this._contentIndent = contentIndent; }
}
export class FencedCodeBlockNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.FencedCodeBlock, start); this._container(); }
}
export class ThematicBreakNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.ThematicBreak, start); }
}
export class TableNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Table, start); this._container(); }
}
export class TableRowNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.TableRow, start); this._container(); }
}
export class TableCellNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.TableCell, start); this._container(); }
}
export class FrontmatterNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Frontmatter, start); this._container(); }
}
export class FormulaBlockNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.FormulaBlock, start); this._container(); }
}

// Inline Types
export class TextNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Text, start); }
}
export class EmphasisNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Emphasis, start); this._container(); }
}
export class StrongNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Strong, start); this._container(); }
}
export class StrikethroughNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Strikethrough, start); this._container(); }
}
export class LinkNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Link, start); this._container(); }
}
export class ImageNode extends LinkNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, start); this.type = NodeTypes.Image; }
}
export class InlineCodeNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.InlineCode, start); }
}
export class AutolinkNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.Autolink, start); }
}
export class HtmlCommentNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.HtmlComment, start); }
}
export class HtmlCDataNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.HtmlCData, start); }
}
export class HtmlDocTypeNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.HtmlDocType, start); }
}
export class XmlProcessingInstructionNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.XmlProcessingInstruction, start); }
}
export class InlineFormulaNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) { super(context, NodeTypes.InlineFormula, start); }
}

export class HtmlElementNode extends ASTNode {
  /** @param {ParseContext} context @param {number} start */
  constructor(context, start) {
    super(context, NodeTypes.HtmlElement, start);
    this._container();
    this._initAttributes();
  }
}