// @ts-check

/**
 * Context shared among all AST nodes to allow lazy string evaluation
 * without storing duplicates of the source text.
 */
export class ParseContext {
  /**
   * @param {string} sourceText
   */
  constructor(sourceText) {
    this.sourceText = sourceText;
  }
}
