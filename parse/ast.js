// @ts-check

import { getTokenFlags, getTokenKind, getTokenLength } from './scan-core.js';
import { semantic } from './semantic.js';
import { IsSafeReparsePoint } from './scan-token-flags.js';

import { ATXHeadingOpen, ATXHeadingClose, FencedOpen, FencedClose, FencedContent, InlineText, NewLine, Whitespace } from './scan-tokens.js';

/**
 * @typedef {import('./scan-tokens.js')[keyof import('./scan-tokens.js')]} TokenKind
 * @typedef {import('./scan-token-flags.js')[keyof import('./scan-token-flags.js')]} TokenFlags
 * @typedef {number} ProvisionalToken
 */

/**
 * The Green Arena is a flat array of integers and optional materialized data.
 * Each node occupies a variable number of slots:
 * - [0] Header (ProvisionalToken): Kind, Width, Flags
 * - [1] First Child Index (0 if none)
 * - [2] Next Sibling Index (0 if none)
 * - [3] Materialized Data (optional, only present if needed)
 */
const NODE_SIZE = 4;

export class SourceFile {
  /**
   * @param {string} text
   */
  constructor(text) {
    /** @type {string} */
    this.text = text;
    
    /** @type {any[]} */
    this.arena = [];
    
    /** @type {number[]} */
    this.paragraphIndex = [];

    this._initialParse();
  }

  _initialParse() {
    const tokens = [];
    semantic({ input: this.text, startOffset: 0, endOffset: this.text.length })(tokens);
    
    this.arena.length = 0;
    this.paragraphIndex.length = 0;
    this.paragraphIndex.push(0); // First paragraph starts at 0

    let currentOffset = 0;
    let lastSiblingIndex = 0;
    
    // Simple AST builder state
    let inHeading = false;
    let headingStartIndex = -1;
    let headingWidth = 0;
    
    let inCodeBlock = false;
    let codeBlockStartIndex = -1;
    let codeBlockWidth = 0;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const kind = getTokenKind(token);
      const flags = getTokenFlags(token);
      const length = getTokenLength(token);
      
      if (flags & IsSafeReparsePoint) {
        this.paragraphIndex.push(currentOffset);
      }
      
      if (kind === ATXHeadingOpen) {
        inHeading = true;
        headingStartIndex = this.arena.length;
        headingWidth = length;
        
        this.arena.push(token); // Header
        this.arena.push(0);     // First Child
        this.arena.push(0);     // Next Sibling
        this.arena.push(null);  // Materialized Data
        
        if (lastSiblingIndex > 0) {
          this.arena[lastSiblingIndex + 2] = headingStartIndex;
        }
        lastSiblingIndex = headingStartIndex;
      } else if (inHeading) {
        headingWidth += length;
        if (kind === ATXHeadingClose || kind === NewLine || i === tokens.length - 1) {
          const originalToken = this.arena[headingStartIndex];
          const newHeader = (originalToken & ~0xFFFF) | (headingWidth & 0xFFFF);
          this.arena[headingStartIndex] = newHeader;
          inHeading = false;
        }
      } else if (kind === FencedOpen) {
        inCodeBlock = true;
        codeBlockStartIndex = this.arena.length;
        codeBlockWidth = length;
        
        this.arena.push(token); // Header
        this.arena.push(0);     // First Child
        this.arena.push(0);     // Next Sibling
        this.arena.push(null);  // Materialized Data
        
        if (lastSiblingIndex > 0) {
          this.arena[lastSiblingIndex + 2] = codeBlockStartIndex;
        }
        lastSiblingIndex = codeBlockStartIndex;
      } else if (inCodeBlock) {
        codeBlockWidth += length;
        if (kind === FencedClose || i === tokens.length - 1) {
          const originalToken = this.arena[codeBlockStartIndex];
          const newHeader = (originalToken & ~0xFFFF) | (codeBlockWidth & 0xFFFF);
          this.arena[codeBlockStartIndex] = newHeader;
          inCodeBlock = false;
        }
      } else {
        // Normal node
        const nodeIndex = this.arena.length;
        this.arena.push(token); // Header
        this.arena.push(0);     // First Child
        this.arena.push(0);     // Next Sibling
        this.arena.push(null);  // Materialized Data
        
        if (lastSiblingIndex > 0) {
          this.arena[lastSiblingIndex + 2] = nodeIndex;
        }
        lastSiblingIndex = nodeIndex;
      }
      
      currentOffset += length;
    }
  }

  /**
   * @param {number} offset
   * @returns {RedNode | null}
   */
  getNodeAt(offset) {
    // Find the paragraph
    let paraIdx = 0;
    for (let i = 1; i < this.paragraphIndex.length; i++) {
      if (this.paragraphIndex[i] > offset) {
        break;
      }
      paraIdx = i;
    }
    
    const baseOffset = this.paragraphIndex[paraIdx];
    
    // Traverse the arena to find the node
    let currentOffset = baseOffset;
    let nodeIndex = 0;
    
    // Find the node index corresponding to the paragraph start
    let searchOffset = 0;
    let searchIndex = 0;
    while (searchIndex < this.arena.length) {
      if (searchOffset === baseOffset) {
        nodeIndex = searchIndex;
        break;
      }
      searchOffset += getTokenLength(this.arena[searchIndex]);
      searchIndex += NODE_SIZE;
    }

    while (nodeIndex < this.arena.length) {
      const token = this.arena[nodeIndex];
      const width = getTokenLength(token);
      
      if (offset >= currentOffset && offset < currentOffset + width) {
        return createRedNode(this, nodeIndex, currentOffset);
      }
      
      currentOffset += width;
      const nextSibling = this.arena[nodeIndex + 2];
      if (nextSibling === 0) {
        // If no next sibling, we might be at the end of the flat list
        // In our flat list implementation, the next node is just nodeIndex + NODE_SIZE
        nodeIndex += NODE_SIZE;
      } else {
        nodeIndex = nextSibling;
      }
    }
    
    return null;
  }

  /**
   * @param {string} newText
   * @param {{start: number, end: number}} changeSpan
   */
  update(newText, changeSpan) {
    // 1. Identify Boundary: Find the paragraph containing the edit
    let paraIdx = 0;
    for (let i = 1; i < this.paragraphIndex.length; i++) {
      if (this.paragraphIndex[i] > changeSpan.start) {
        break;
      }
      paraIdx = i;
    }
    
    const startOffset = this.paragraphIndex[paraIdx];
    
    // For a full incremental parser, we would:
    // 1. Run scan0/semantic from startOffset
    // 2. Check for convergence at the next IsSafeReparsePoint
    // 3. Splice the arena and shift the paragraph index
    
    // Since we don't have the full scanner state exposed yet,
    // we'll do a simplified version: re-parse from the boundary to the end,
    // and replace the arena from that point.
    
    const oldTextLength = this.text.length;
    this.text = newText;
    const delta = newText.length - oldTextLength;
    
    // Re-parse from startOffset
    const tokens = [];
    semantic({ input: this.text, startOffset: startOffset, endOffset: this.text.length })(tokens);
    
    // Find the arena index corresponding to startOffset
    let arenaIndex = 0;
    let currentOffset = 0;
    while (arenaIndex < this.arena.length) {
      if (currentOffset === startOffset) {
        break;
      }
      currentOffset += getTokenLength(this.arena[arenaIndex]);
      arenaIndex += NODE_SIZE;
    }
    
    // Truncate arena and paragraph index
    this.arena.length = arenaIndex;
    this.paragraphIndex.length = paraIdx + 1;
    
    // Append new nodes
    let lastSiblingIndex = arenaIndex > 0 ? arenaIndex - NODE_SIZE : 0;
    currentOffset = startOffset;
    
    let inHeading = false;
    let headingStartIndex = -1;
    let headingWidth = 0;
    
    let inCodeBlock = false;
    let codeBlockStartIndex = -1;
    let codeBlockWidth = 0;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const kind = getTokenKind(token);
      const flags = getTokenFlags(token);
      const length = getTokenLength(token);
      
      if (flags & IsSafeReparsePoint && currentOffset > startOffset) {
        this.paragraphIndex.push(currentOffset);
      }
      
      if (kind === ATXHeadingOpen) {
        inHeading = true;
        headingStartIndex = this.arena.length;
        headingWidth = length;
        
        this.arena.push(token);
        this.arena.push(0);
        this.arena.push(0);
        this.arena.push(null);
        
        if (lastSiblingIndex > 0 && !inHeading && !inCodeBlock) {
          this.arena[lastSiblingIndex + 2] = headingStartIndex;
        }
        lastSiblingIndex = headingStartIndex;
      } else if (inHeading) {
        headingWidth += length;
        if (kind === ATXHeadingClose || kind === NewLine || i === tokens.length - 1) {
          const originalToken = this.arena[headingStartIndex];
          const newHeader = (originalToken & ~0xFFFF) | (headingWidth & 0xFFFF);
          this.arena[headingStartIndex] = newHeader;
          inHeading = false;
        }
      } else if (kind === FencedOpen) {
        inCodeBlock = true;
        codeBlockStartIndex = this.arena.length;
        codeBlockWidth = length;
        
        this.arena.push(token);
        this.arena.push(0);
        this.arena.push(0);
        this.arena.push(null);
        
        if (lastSiblingIndex > 0 && !inHeading && !inCodeBlock) {
          this.arena[lastSiblingIndex + 2] = codeBlockStartIndex;
        }
        lastSiblingIndex = codeBlockStartIndex;
      } else if (inCodeBlock) {
        codeBlockWidth += length;
        if (kind === FencedClose || i === tokens.length - 1) {
          const originalToken = this.arena[codeBlockStartIndex];
          const newHeader = (originalToken & ~0xFFFF) | (codeBlockWidth & 0xFFFF);
          this.arena[codeBlockStartIndex] = newHeader;
          inCodeBlock = false;
        }
      } else {
        const nodeIndex = this.arena.length;
        this.arena.push(token);
        this.arena.push(0);
        this.arena.push(0);
        this.arena.push(null);
        
        if (lastSiblingIndex > 0 && !inHeading && !inCodeBlock) {
          this.arena[lastSiblingIndex + 2] = nodeIndex;
        }
        lastSiblingIndex = nodeIndex;
      }
      
      currentOffset += length;
    }
  }
}

export class RedNode {
  /**
   * @param {SourceFile} sourceFile
   * @param {number} arenaIndex
   * @param {number} absoluteOffset
   */
  constructor(sourceFile, arenaIndex, absoluteOffset) {
    this.sourceFile = sourceFile;
    this.arenaIndex = arenaIndex;
    this.absoluteOffset = absoluteOffset;
  }

  get kind() {
    return getTokenKind(this.sourceFile.arena[this.arenaIndex]);
  }

  get width() {
    return getTokenLength(this.sourceFile.arena[this.arenaIndex]);
  }

  get text() {
    return this.sourceFile.text.substring(
      this.absoluteOffset, 
      this.absoluteOffset + this.width
    );
  }
}

export class HeadingNode extends RedNode {
  getLevel() {
    let level = 0;
    const text = this.sourceFile.text;
    let pos = this.absoluteOffset;
    while (pos < text.length && text.charCodeAt(pos) === 35 /* # */) {
      level++;
      pos++;
    }
    return level;
  }
}

export class CodeBlockNode extends RedNode {
  getFenceChar() {
    return this.sourceFile.text[this.absoluteOffset];
  }
}

export class LinkNode extends RedNode {
  // Link specific methods
}

/**
 * @param {SourceFile} sourceFile
 * @param {number} arenaIndex
 * @param {number} absoluteOffset
 * @returns {RedNode}
 */
function createRedNode(sourceFile, arenaIndex, absoluteOffset) {
  const kind = getTokenKind(sourceFile.arena[arenaIndex]);
  
  if (kind === ATXHeadingOpen) {
    return new HeadingNode(sourceFile, arenaIndex, absoluteOffset);
  } else if (kind === FencedOpen) {
    return new CodeBlockNode(sourceFile, arenaIndex, absoluteOffset);
  }
  
  return new RedNode(sourceFile, arenaIndex, absoluteOffset);
}
