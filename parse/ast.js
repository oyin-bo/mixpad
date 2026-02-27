// @ts-check

import { getTokenKind, getTokenLength } from './scan-core.js';
import { IsSafeReparsePoint, HeadingDepthMask } from './scan-token-flags.js';
import * as TOKEN from './scan-tokens.js';
import { semantic } from './semantic.js';

/** @typedef {import('./scan0.js').ProvisionalToken} ProvisionalToken */

// Green Arena Layout (4 slots per node)
export const NODE_HEADER = 0;      // ProvisionalToken (Kind, Length, Flags)
export const NODE_FIRST_CHILD = 1;  // Index in Arena
export const NODE_NEXT_SIBLING = 2; // Index in Arena
export const NODE_DATA = 3;         // Materialized data (optional)
export const NODE_SIZE = 4;

// Structural Kind for Paragraph (not in scan-tokens.js)
export const ParagraphKind = 0x500000;

export class RedNode {
  /**
   * @param {SourceFile} file
   * @param {number} arenaIndex
   */
  constructor(file, arenaIndex) {
    this.file = file;
    this.arenaIndex = arenaIndex;
  }

  get kind() {
    return this.file.arena[this.arenaIndex + NODE_HEADER] & 0x03FF0000;
  }

  get width() {
    return getTokenLength(this.file.arena[this.arenaIndex + NODE_HEADER]);
  }

  /**
   * @returns {RedNode | null}
   */
  get firstChild() {
    const idx = this.file.arena[this.arenaIndex + NODE_FIRST_CHILD];
    return idx !== 0 ? this.file._getOrCreateRedNode(idx) : null;
  }

  /**
   * @returns {RedNode | null}
   */
  get nextSibling() {
    const idx = this.file.arena[this.arenaIndex + NODE_NEXT_SIBLING];
    return idx !== 0 ? this.file._getOrCreateRedNode(idx) : null;
  }

  get data() {
    return this.file.arena[this.arenaIndex + NODE_DATA];
  }

  /**
   * Absolute position in the source text.
   * Calculated on-demand by identifying the paragraph and summing previous sibling widths.
   */
  get pos() {
    return this.file._getNodePos(this.arenaIndex);
  }

  get text() {
    const p = this.pos;
    return this.file.text.substring(p, p + this.width);
  }

  /**
   * @returns {RedNode[]}
   */
  getChildren() {
    /** @type {RedNode[]} */
    const children = [];
    let child = this.firstChild;
    while (child) {
      children.push(child);
      child = child.nextSibling;
    }
    return children;
  }
}

export class SourceFile {
  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
    /** @type {any[]} */
    this.arena = [0, 0, 0, null]; // Index 0 is reserved/null node
    /** @type {Map<number, RedNode>} */
    this.redNodes = new Map();
    /** @type {{textOffset: number, arenaIndex: number}[]} */
    this.paragraphIndex = [];
    
    this._fullParse();
  }

  _fullParse() {
    this.arena = [0, 0, 0, null];
    this.paragraphIndex = [];
    this.redNodes.clear();

    const output = [];
    const scan = semantic({ input: this.text, startOffset: 0, endOffset: this.text.length });
    scan(output);

    this._buildTree(output);
  }

  /**
   * @param {ProvisionalToken[]} tokens
   */
  _buildTree(tokens) {
    const stack = [{
      arenaIndex: 0,
      startPos: 0,
      lastChildIndex: 0
    }];

    this.paragraphIndex.push({ textOffset: 0, arenaIndex: 0 });

    let pos = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const kind = getTokenKind(token);
      const len = getTokenLength(token);

      // Handle reparse points (potential block boundaries)
      if (token & IsSafeReparsePoint) {
        this.paragraphIndex.push({ textOffset: pos, arenaIndex: this.arena.length });
      }

      if (this._isOpenToken(kind)) {
        const idx = this._pushArenaNode(token, stack[stack.length - 1], pos);
        // Store opening marker width in DATA for containers
        this.arena[idx + NODE_DATA] = len;
        stack.push({ arenaIndex: idx, startPos: pos, lastChildIndex: 0 });
      } else if (this._isCloseToken(kind)) {
        const top = stack.pop();
        if (top && top.arenaIndex !== 0) {
          const totalWidth = (pos + len) - top.startPos;
          const oldHeader = this.arena[top.arenaIndex + NODE_HEADER];
          this.arena[top.arenaIndex + NODE_HEADER] = (oldHeader & 0xFFFF0000) | (totalWidth & 0xFFFF);
        }
      } else {
        // Auto-close certain blocks on NewLine or at EOF
        const top = stack[stack.length - 1];
        if (kind === TOKEN.NewLine || (i === tokens.length - 1)) {
          if (top && this._isAutoClosed(getTokenKind(this.arena[top.arenaIndex + NODE_HEADER]))) {
            stack.pop();
            const totalWidth = (pos + len) - top.startPos;
            const oldHeader = this.arena[top.arenaIndex + NODE_HEADER];
            this.arena[top.arenaIndex + NODE_HEADER] = (oldHeader & 0xFFFF0000) | (totalWidth & 0xFFFF);
          }
        }
        this._pushArenaNode(token, stack[stack.length - 1], pos);
      }
      
      pos += len;
    }

    // Close any remaining blocks on stack (EOF)
    while (stack.length > 1) {
      const top = stack.pop();
      const totalWidth = pos - top.startPos;
      const oldHeader = this.arena[top.arenaIndex + NODE_HEADER];
      this.arena[top.arenaIndex + NODE_HEADER] = (oldHeader & 0xFFFF0000) | (totalWidth & 0xFFFF);
    }
  }

  _isAutoClosed(kind) {
    return kind === TOKEN.ATXHeadingOpen || 
           kind === TOKEN.FencedOpen || 
           kind === TOKEN.FormulaOpen || 
           kind === TOKEN.FrontmatterOpen;
  }

  /**
   * @param {number} header
   * @param {any} parent
   * @param {number} pos
   * @returns {number}
   */
  _pushArenaNode(header, parent, pos) {
    const idx = this.arena.length;
    const kind = getTokenKind(header);
    const len = getTokenLength(header);
    
    let data = null;
    if (this._shouldMaterialize(kind)) {
      data = this.text.substring(pos, pos + len);
    }
    
    this.arena.push(header, 0, 0, data);
    
    if (parent.lastChildIndex === 0) {
      this.arena[parent.arenaIndex + NODE_FIRST_CHILD] = idx;
    } else {
      this.arena[parent.lastChildIndex + NODE_NEXT_SIBLING] = idx;
    }
    parent.lastChildIndex = idx;
    return idx;
  }

  _shouldMaterialize(kind) {
    return kind === TOKEN.InlineText || 
           kind === TOKEN.AngleLinkURL || 
           kind === TOKEN.RawURL || 
           kind === TOKEN.WWWAutolink || 
           kind === TOKEN.EmailAutolink;
  }

  _isOpenToken(kind) {
    return kind === TOKEN.LinkOpen || kind === TOKEN.ImageMarker || 
           kind === TOKEN.EmphasisOpen || kind === TOKEN.StrongOpen ||
           kind === TOKEN.ATXHeadingOpen || kind === TOKEN.FencedOpen ||
           kind === TOKEN.FormulaOpen || kind === TOKEN.FrontmatterOpen;
  }

  _isCloseToken(kind) {
    return kind === TOKEN.LinkClose || 
           kind === TOKEN.EmphasisClose || kind === TOKEN.StrongClose ||
           kind === TOKEN.ATXHeadingClose || kind === TOKEN.FencedClose ||
           kind === TOKEN.FormulaClose || kind === TOKEN.FrontmatterClose;
  }

  /**
   * @param {number} arenaIndex
   * @returns {RedNode}
   */
  _getOrCreateRedNode(arenaIndex) {
    let node = this.redNodes.get(arenaIndex);
    if (!node) {
      node = new RedNode(this, arenaIndex);
      this.redNodes.set(arenaIndex, node);
    }
    return node;
  }

  /**
   * @param {number} arenaIndex
   * @returns {number}
   */
  _getNodePos(arenaIndex) {
    let low = 0;
    let high = this.paragraphIndex.length - 1;
    let paraIdx = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.paragraphIndex[mid].arenaIndex <= arenaIndex) {
        paraIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (paraIdx === -1) return 0;

    const paraEntry = this.paragraphIndex[paraIdx];
    let startIndex = paraEntry.arenaIndex;
    if (startIndex === 0) startIndex = this.arena[NODE_FIRST_CHILD];
    
    return this._findPosRecursive(startIndex, paraEntry.textOffset, arenaIndex) ?? 0;
  }

  /**
   * @param {number} startIndex
   * @param {number} startPos
   * @param {number} targetIdx
   * @returns {number | null}
   */
  _findPosRecursive(startIndex, startPos, targetIdx) {
    let currentIdx = startIndex;
    let currentPos = startPos;

    while (currentIdx !== 0) {
      if (currentIdx === targetIdx) return currentPos;

      let childIdx = this.arena[currentIdx + NODE_FIRST_CHILD];
      if (childIdx !== 0) {
        const markerWidth = this._getOpeningMarkerWidth(currentIdx);
        const found = this._findPosRecursive(childIdx, currentPos + markerWidth, targetIdx);
        if (found !== null) return found;
      }

      currentPos += getTokenLength(this.arena[currentIdx + NODE_HEADER]);
      currentIdx = this.arena[currentIdx + NODE_NEXT_SIBLING];
    }

    return null;
  }

  /**
   * @param {number} offset
   * @returns {RedNode | null}
   */
  getNodeAt(offset) {
    let low = 0;
    let high = this.paragraphIndex.length - 1;
    let paraIdx = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.paragraphIndex[mid].textOffset <= offset) {
        paraIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (paraIdx === -1) return null;

    const paraEntry = this.paragraphIndex[paraIdx];
    let startIndex = paraEntry.arenaIndex;
    if (startIndex === 0) startIndex = this.arena[NODE_FIRST_CHILD];

    return this._findNodeAt(startIndex, paraEntry.textOffset, offset);
  }

  /**
   * @param {number} startIndex
   * @param {number} startPos
   * @param {number} offset
   * @returns {RedNode | null}
   */
  _findNodeAt(startIndex, startPos, offset) {
    let currentIdx = startIndex;
    let currentPos = startPos;

    while (currentIdx !== 0) {
      const header = this.arena[currentIdx + NODE_HEADER];
      const width = getTokenLength(header);

      if (offset >= currentPos && offset < currentPos + width) {
        // It's in this node or its children
        let childIdx = this.arena[currentIdx + NODE_FIRST_CHILD];
        if (childIdx !== 0) {
          const markerWidth = this._getOpeningMarkerWidth(currentIdx);
          const found = this._findNodeAt(childIdx, currentPos + markerWidth, offset);
          if (found) return found;
        }
        return this._getOrCreateRedNode(currentIdx);
      }

      currentPos += width;
      currentIdx = this.arena[currentIdx + NODE_NEXT_SIBLING];
    }

    return null;
  }

  /**
   * @param {number} arenaIndex
   * @returns {number}
   */
  _getOpeningMarkerWidth(arenaIndex) {
    const header = this.arena[arenaIndex + NODE_HEADER];
    const kind = getTokenKind(header);
    if (this._isOpenToken(kind)) {
      return this.arena[arenaIndex + NODE_DATA] || 0;
    }
    return 0;
  }

  /**
   * @param {string} newText
   * @param {{start: number, length: number}} changeSpan
   */
  update(newText, changeSpan) {
    this.text = newText;
    this._fullParse();
  }
}
