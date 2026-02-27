// @ts-check
import { SourceFile } from '../source-file.js';
import { scan0 } from '../scan0.js';

// Competitors (assuming they are installed in the main package.json)
import * as commonmark from 'commonmark';
import MarkdownIt from 'markdown-it';
import { marked } from 'marked';
import { micromark } from 'micromark';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const mdIt = new MarkdownIt();
const remarkProcessor = unified().use(remarkParse);

/**
 * @typedef {Object} BenchmarkResult
 * @property {number} [tokenCount]
 * @property {number} [nodeCount]
 * @property {string} [error]
 */

/**
 * @param {string} name
 * @param {string} content
 * @returns {Promise<BenchmarkResult>}
 */
export async function parseWithParser(name, content) {
  switch (name) {
    case 'mixpad-scan0': {
      const output = [];
      const tokenCount = scan0({
        input: content,
        startOffset: 0,
        endOffset: content.length,
        output
      });
      return { tokenCount };
    }

    case 'mixpad-full': {
      const sourceFile = new SourceFile(content);
      // Accessing arena length or similar to get a sense of work done
      return { nodeCount: sourceFile.arena.length / 6 }; // NODE_STRIDE is 6
    }

    case 'marked': {
      const tokens = marked.lexer(content);
      return { tokenCount: tokens.length };
    }

    case 'markdown-it': {
      const tokens = mdIt.parse(content, {});
      return { tokenCount: tokens.length };
    }

    case 'micromark': {
      const out = micromark(content);
      return { tokenCount: 0 }; // micromark doesn't return tokens directly easily
    }

    case 'remark': {
      const tree = remarkProcessor.parse(content);
      return { nodeCount: 1 }; // Placeholder
    }

    case 'commonmark': {
      const reader = new commonmark.Parser();
      const parsed = reader.parse(content);
      return { nodeCount: 1 }; // Placeholder
    }

    default:
      return { error: 'unknown parser' };
  }
}
