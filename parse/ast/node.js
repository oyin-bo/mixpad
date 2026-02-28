// @ts-check

/**
 * The base node for the MixPad AST.
 * Designed to be highly monomorphic. The layout must remain consistent.
 */
export class ASTNode {
  /**
   * @param {import('./parser.js').ParseContext} context
   * @param {number} type - Numeric enum from node-types.js
   * @param {number} start - Offset in the original string
   */
  constructor(context, type, start) {
    /** @type {import('./parser.js').ParseContext} */
    this._ctx = context;
    /** @type {number} */
    this.type = type;
    /** @type {number} */
    this.start = start;
    /** @type {number} */
    this.end = 0;

    /** @type {ASTNode[] | null} */
    this.children = null;
  }

  get text() {
    if (this._textCache !== undefined && this._textCache !== null) return this._textCache;
    let result = '';
    if (this.children && this.children.length > 0) {
      for (let i = 0; i < this.children.length; i++) {
        result += this.children[i].text;
      }
    } else if (this.end > this.start) {
      result = this._ctx.sourceText.substring(this.start, this.end);
    }
    this._textCache = result;
    return result;
  }
}
