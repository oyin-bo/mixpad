// @ts-check

import { ASTBuilder } from './builder.js';
import { semantic } from '../semantic.js';

/**
 * Convenience entry point to parse a full markdown document into a DOM-like AST.
 * 
 * @param {string} sourceText The raw markdown string
 * @returns {import('./node.js').ASTNode} The DocumentNode root
 */
export function parse(sourceText) {
  const builder = new ASTBuilder(sourceText);

  // The semantic scanner requires this pattern
  const scan = semantic({ input: sourceText, startOffset: 0, endOffset: sourceText.length });
  const semanticTokens = [];
  scan(semanticTokens);

  // Instead of streaming line by line here, we stream the whole document's tokens.
  // The AST builder is designed to handle chunking inherently by observing kinds (like Heading/ThematicBreak/NewLines).
  builder.consumeChunk(semanticTokens, 0);

  return builder.finish();
}
