// @ts-check

/**
 * The base node for the MixPad AST.
 *
 * The layout is deliberately uniform: every optional field a concrete node kind
 * may use is declared and initialised here, so nodes never gain properties after
 * creation and all instances share one hidden class. Subclasses differ only by
 * which of these fields they populate.
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

    /** @type {string | null} */
    this._textCache = null;
    /** @type {number} heading level 1-6 */
    this._level = 0;
    /** @type {boolean} ordered vs bullet list */
    this._isOrdered = false;
    /** @type {number} list indentation */
    this.indent = 0;
    /** @type {number} list item content indent */
    this._contentIndent = 0;
    /** @type {string | null} cached fenced code info string */
    this._language = null;
    /** @type {number} fenced info span start */
    this.infoStart = 0;
    /** @type {number} fenced info span end */
    this.infoEnd = 0;
    /** @type {number} link/image/autolink destination span start */
    this.destStart = 0;
    /** @type {number} link/image/autolink destination span end */
    this.destEnd = 0;
    /** @type {string | null} cached destination */
    this._url = null;
    /** @type {string} html element tag name, lowercased */
    this.tagName = "";
    /** @type {{name: string, value: (string | null)}[] | null} html attributes */
    this.attributes = null;
    /** @type {('left' | 'center' | 'right' | null)} table cell alignment */
    this.align = null;
    /** @type {boolean} table header row flag */
    this.isHeader = false;
  }

  get text() {
    if (this._textCache !== null) return this._textCache;
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

  get level() { return this._level; }

  get isOrdered() { return this._isOrdered; }

  get url() {
    if (this._url !== null) return this._url;
    this._url = this.destStart < this.destEnd
      ? this._ctx.sourceText.substring(this.destStart, this.destEnd)
      : "";
    return this._url;
  }

  get language() {
    if (this._language !== null) return this._language;
    this._language = this.infoEnd > this.infoStart
      ? this._ctx.sourceText.substring(this.infoStart, this.infoEnd).trim()
      : "";
    return this._language;
  }
}
