// @ts-check

/**
 * @typedef {number} SemanticToken
 */


/**
 * Scan ahead producing provisional tokens, until a decisive resolution point reached.
 * The last token may carry flags reporting what kind of resolution was reached.
 * @param {{
 *  input: string,
 *  startOffset: number,
 *  endOffset: number
 * }} _
 */
export function semantic({ input, startOffset, endOffset }) {

  return scan;

  /** @param {SemanticToken[]} output */
  function scan(output) {

  }
}