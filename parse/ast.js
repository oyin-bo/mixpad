// @ts-check

import { semantic } from "./semantic.js";
import { IsSafeReparsePoint } from "./scan-token-flags.js";
import { getTokenLength, getTokenKind, getTokenFlags } from "./scan-core.js";
import * as Tokens from "./scan-tokens.js";

/**
 * @typedef {import("./scan0.js").ProvisionalToken} ProvisionalToken
 */

/**
 * Green Arena Node Layout
 */
export const NODE_SIZE = 4;
export const HEADER_SLOT = 0;
export const FIRST_CHILD_SLOT = 1;
export const NEXT_SIBLING_SLOT = 2;
export const DATA_SLOT = 3;

/**
 * Red Facade for a node in the AST.
 */
export class RedNode {
  /**
   * @param {SourceFile} sourceFile
   * @param {number} arenaIndex
   */
  constructor(sourceFile, arenaIndex) {
    /** @readonly */
    this.sourceFile = sourceFile;
    /** @readonly */
    this.arenaIndex = arenaIndex;
  }

  get header() { return this.sourceFile.arena[this.arenaIndex + HEADER_SLOT]; }
  get kind() { return getTokenKind(this.header); }
  get width() { return getTokenLength(this.header); }
  get flags() { return getTokenFlags(this.header); }
  get data() { return this.sourceFile.arena[this.arenaIndex + DATA_SLOT]; }

  get offset() {
    return this.sourceFile._calculateOffset(this.arenaIndex);
  }

  /** @returns {RedNode | null} */
  get firstChild() {
    const childIdx = this.sourceFile.arena[this.arenaIndex + FIRST_CHILD_SLOT];
    return childIdx !== 0 ? this.sourceFile.getRedNode(childIdx) : null;
  }

  /** @returns {RedNode | null} */
  get nextSibling() {
    const siblingIdx = this.sourceFile.arena[this.arenaIndex + NEXT_SIBLING_SLOT];
    return siblingIdx !== 0 ? this.sourceFile.getRedNode(siblingIdx) : null;
  }

  getChildren() {
    const children = [];
    let child = this.firstChild;
    while (child) {
      children.push(child);
      child = child.nextSibling;
    }
    return children;
  }
}

/**
 * Entity-Affinitive Node for Headings.
 */
export class HeadingNode extends RedNode {
  getLevel() {
    const text = this.sourceFile.text;
    const pos = this.offset;
    let level = 0;
    while (level < 7 && text[pos + level] === "#") level++;
    return level;
  }
}

/**
 * Entity-Affinitive Node for Links.
 */
export class LinkNode extends RedNode {
  getDestination() {
    // If materialized in Arena's DATA_SLOT
    if (this.data && typeof this.data === "string") return this.data;
    // Otherwise, lazy scan (hypothetically)
    return "";
  }
}

/**
 * Builder to construct the hierarchical Green Arena.
 */
export class GreenArenaBuilder {
  /**
   * @param {any[]} arena
   * @param {number[]} paragraphIndex
   * @param {number[]} paragraphArenaIndices
   */
  constructor(arena, paragraphIndex, paragraphArenaIndices) {
    this.arena = arena;
    this.paragraphIndex = paragraphIndex;
    this.paragraphArenaIndices = paragraphArenaIndices;
    this.stack = [];
    this.lastSiblingStack = [0];
  }

  addNode(token, data = null) {
    const index = this.arena.length;
    this.arena.push(token, 0, 0, data);

    if (this.stack.length > 0) {
      const parentIdx = this.stack[this.stack.length - 1];
      const lastSiblingIdx = this.lastSiblingStack[this.lastSiblingStack.length - 1];
      if (lastSiblingIdx !== 0) {
        this.arena[lastSiblingIdx + NEXT_SIBLING_SLOT] = index;
      } else {
        this.arena[parentIdx + FIRST_CHILD_SLOT] = index;
      }
      this.lastSiblingStack[this.lastSiblingStack.length - 1] = index;
    } else {
      const lastSiblingIdx = this.lastSiblingStack[0];
      if (lastSiblingIdx !== 0) {
        this.arena[lastSiblingIdx + NEXT_SIBLING_SLOT] = index;
      }
      this.lastSiblingStack[0] = index;
    }
    return index;
  }

  openContainer(token, data = null) {
    const index = this.addNode(token, data);
    this.stack.push(index);
    this.lastSiblingStack.push(0);
  }

  closeContainer() {
    this.stack.pop();
    this.lastSiblingStack.pop();
  }
}

export class SourceFile {
  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
    this.arena = [];
    this.paragraphIndex = [0];
    this.paragraphArenaIndices = [0];
    this._redCache = new Map();
    this._fullParse();
  }

  _fullParse() {
    // Waste index 0 to use 0 as null pointer.
    this.arena = [0, 0, 0, null];
    this.paragraphIndex = [0];
    this.paragraphArenaIndices = [NODE_SIZE];
    this._redCache.clear();

    const tokens = [];
    semantic({ input: this.text, startOffset: 0, endOffset: this.text.length })(tokens);
    const builder = new GreenArenaBuilder(this.arena, this.paragraphIndex, this.paragraphArenaIndices);
    
    // lastSiblingStack should point to the wasted node initially to avoid first-node check?
    // Actually, no. The first real node is at index 4.
    // It should NOT have a previous sibling.
    
    let currentOffset = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const kind = getTokenKind(token);
      if (token & IsSafeReparsePoint && i > 0) {
        this.paragraphIndex.push(currentOffset);
        this.paragraphArenaIndices.push(this.arena.length);
      }
      if (this._isContainerKind(kind)) {
        if (this._isClosingKind(kind)) {
          builder.closeContainer();
        } else {
          builder.openContainer(token);
        }
      } else {
        builder.addNode(token);
      }
      currentOffset += getTokenLength(token);
    }
  }

  _isContainerKind(kind) {
    return kind === Tokens.ATXHeadingOpen || kind === Tokens.ATXHeadingClose ||
           kind === Tokens.LinkOpen || kind === Tokens.LinkClose ||
           kind === Tokens.EmphasisOpen || kind === Tokens.EmphasisClose ||
           kind === Tokens.StrongOpen || kind === Tokens.StrongClose ||
           kind === Tokens.StrikethroughOpen || kind === Tokens.StrikethroughClose;
  }

  _isClosingKind(kind) {
    return kind === Tokens.ATXHeadingClose || kind === Tokens.LinkClose ||
           kind === Tokens.EmphasisClose || kind === Tokens.StrongClose ||
           kind === Tokens.StrikethroughClose;
  }

  getRedNode(arenaIndex) {
    let node = this._redCache.get(arenaIndex);
    if (!node) {
      const kind = getTokenKind(this.arena[arenaIndex + HEADER_SLOT]);
      if (kind === Tokens.ATXHeadingOpen) {
        node = new HeadingNode(this, arenaIndex);
      } else if (kind === Tokens.LinkOpen) {
        node = new LinkNode(this, arenaIndex);
      } else {
        node = new RedNode(this, arenaIndex);
      }
      this._redCache.set(arenaIndex, node);
    }
    return node;
  }

  _calculateOffset(arenaIndex) {
    let low = 0;
    let high = this.paragraphArenaIndices.length - 1;
    let pIdx = 0;
    while (low <= high) {
      let mid = (low + high) >> 1;
      if (this.paragraphArenaIndices[mid] <= arenaIndex) {
        pIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    let offset = this.paragraphIndex[pIdx];
    let scanIdx = this.paragraphArenaIndices[pIdx];
    while (scanIdx < arenaIndex) {
      offset += getTokenLength(this.arena[scanIdx + HEADER_SLOT]);
      scanIdx += NODE_SIZE;
    }
    return offset;
  }

  update(newText, changeSpan) {
    this.text = newText;
    this._fullParse(); 
  }
}
