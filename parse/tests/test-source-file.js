// @ts-check
/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getTokenKind, getTokenLength } from '../scan-core.js';
import {
  InlineText, NewLine, Whitespace,
  ATXHeadingOpen, EmphasisOpen, StrongOpen, FencedOpen, FencedContent,
  LinkOpen, ImageMarker, TablePipe, FrontmatterOpen, BlockquoteMarker
} from '../scan-tokens.js';
import {
  NODE_STRIDE,
  NODE_HEADER, NODE_FIRST_CHILD, NODE_NEXT_SIBLING, NODE_MATERIALIZED,
  SourceFile, RedNode, HeadingNode, LinkNode, CodeBlockNode,
  StrongNode, EmphasisNode, TextNode
} from '../source-file.js';

// ── Arena type ────────────────────────────────────────────────────────────────

test('arena is a native JS Array, not a TypedArray', () => {
  const sf = new SourceFile('Hello');
  assert.ok(Array.isArray(sf.arena), 'arena must be a plain Array');
  assert.ok(Array.isArray(sf.paragraphIndex), 'paragraphIndex must be a plain Array');
  assert.ok(Array.isArray(sf.paragraphArenaIndices), 'paragraphArenaIndices must be a plain Array');
});

test('arena supports splice (required by incremental update)', () => {
  const sf = new SourceFile('Hello');
  assert.equal(typeof sf.arena.splice, 'function');
});

// ── Empty text ────────────────────────────────────────────────────────────────

test('empty text: paragraphIndex is empty', () => {
  const sf = new SourceFile('');
  assert.deepEqual(sf.paragraphIndex, []);
  assert.deepEqual(sf.paragraphArenaIndices, []);
});

test('empty text: arena contains only the null sentinel', () => {
  const sf = new SourceFile('');
  assert.equal(sf.arena.length, NODE_STRIDE);
  assert.equal(sf.arena[NODE_HEADER], 0);
  assert.equal(sf.arena[NODE_FIRST_CHILD], 0);
  assert.equal(sf.arena[NODE_NEXT_SIBLING], 0);
  assert.equal(sf.arena[NODE_MATERIALIZED], null);
});

test('empty text: getNodeAt returns null', () => {
  const sf = new SourceFile('');
  assert.equal(sf.getNodeAt(0), null);
});

// ── Single paragraph ──────────────────────────────────────────────────────────

test('single paragraph: paragraphIndex = [0]', () => {
  const sf = new SourceFile('Hello world');
  assert.deepEqual(sf.paragraphIndex, [0]);
  assert.equal(sf.paragraphArenaIndices[0], NODE_STRIDE);
});

test('single paragraph: arena has sentinel + at least one node', () => {
  const sf = new SourceFile('Hello world');
  assert.ok(sf.arena.length > NODE_STRIDE, 'arena must contain real nodes beyond sentinel');
});

test('single paragraph: getNodeAt(0) returns InlineText kind', () => {
  const sf = new SourceFile('Hello world');
  const node = sf.getNodeAt(0);
  assert.ok(node !== null);
  assert.equal(node.kind, InlineText);
});

test('single paragraph: offsets within the same token map to the same node', () => {
  const sf = new SourceFile('Hello world');
  const node0 = sf.getNodeAt(0);
  const node4 = sf.getNodeAt(4);
  assert.ok(node0 !== null && node4 !== null);
  assert.equal(node0.arenaIndex, node4.arenaIndex, 'chars 0 and 4 are in the same InlineText token');
});

// ── Node layout ────────────────────────────────────────────────────────────────

test('node layout: NODE_STRIDE is 6', () => {
  assert.strictEqual(NODE_STRIDE, 6);
});

test('node layout: first real node is at arena index NODE_STRIDE', () => {
  const sf = new SourceFile('Hi');
  assert.equal(sf.paragraphArenaIndices[0], NODE_STRIDE);
});

test('node layout: token length in header matches source width', () => {
  const sf = new SourceFile('Hello');
  const node = sf.getNodeAt(0);
  assert.ok(node !== null);
  assert.equal(node.width, 5);
  assert.equal(getTokenLength(/** @type {number} */(sf.arena[node.arenaIndex + NODE_HEADER])), 5);
});

// ── Two paragraphs ────────────────────────────────────────────────────────────

test('two paragraphs: paragraphIndex has two entries', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  assert.equal(sf.paragraphIndex.length, 2);
  assert.equal(sf.paragraphIndex[0], 0);
  assert.equal(sf.paragraphIndex[1], 7);
});

test('two paragraphs: getNodeAt resolves to correct paragraph nodes', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  const nodeInHello = sf.getNodeAt(0);
  const nodeInWorld = sf.getNodeAt(7);
  assert.ok(nodeInHello !== null && nodeInWorld !== null);
  assert.notEqual(nodeInHello.arenaIndex, nodeInWorld.arenaIndex, 'Hello and World must be different nodes');
  assert.equal(nodeInWorld.kind, InlineText);
  assert.equal(nodeInWorld.text, 'World');
});

test('two paragraphs: sibling chain of paragraph 0 includes NewLine tokens', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  let node = sf.getNodeAt(0);
  const kinds = /** @type {number[]} */ ([]);
  while (node) {
    kinds.push(node.kind);
    node = node.nextSibling;
  }
  assert.ok(kinds.includes(NewLine), 'paragraph 0 must contain NewLine token(s)');
  assert.ok(kinds.includes(InlineText), 'paragraph 0 must contain InlineText token');
});

// ── update() ──────────────────────────────────────────────────────────────────

test('update: inserts a character and shifts second paragraph offset', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  assert.deepEqual(sf.paragraphIndex, [0, 7]);
  sf.update('Hello!\n\nWorld', { start: 5, end: 5 });
  assert.deepEqual(sf.paragraphIndex, [0, 8]);
});

test('update: deletes a character and shifts second paragraph offset', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  sf.update('Hell\n\nWorld', { start: 4, end: 5 });
  assert.deepEqual(sf.paragraphIndex, [0, 6]);
});

test('update: getNodeAt works correctly after an edit', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  sf.update('Hello!\n\nWorld', { start: 5, end: 5 });
  const nodeInHello = sf.getNodeAt(0);
  const nodeInWorld = sf.getNodeAt(8);
  assert.ok(nodeInHello !== null && nodeInWorld !== null);
  assert.notEqual(nodeInHello.arenaIndex, nodeInWorld.arenaIndex);
  assert.equal(nodeInWorld.kind, InlineText);
});

test('update: arena uses splice — same array reference after edit', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  const arenaRef = sf.arena;
  sf.update('Hello!\n\nWorld', { start: 5, end: 5 });
  assert.equal(sf.arena, arenaRef, 'update() must not replace the arena array');
});

test('update: collapsing two paragraphs into one merges paragraphIndex', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  assert.equal(sf.paragraphIndex.length, 2);
  sf.update('Hello World', { start: 5, end: 7 });
  assert.equal(sf.paragraphIndex.length, 1);
  assert.equal(sf.paragraphIndex[0], 0);
});

test('update: empty text after full deletion clears paragraphIndex', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  sf.update('', { start: 0, end: 12 });
  assert.deepEqual(sf.paragraphIndex, []);
});

// ── Headings ──────────────────────────────────────────────────────────────────

test('ATX heading: kind, text, and instanceof HeadingNode', () => {
  const text = '# Heading\n\nSome text.';
  const file = new SourceFile(text);
  const heading = file.getNodeAt(0);
  assert.ok(heading !== null);
  assert.equal(heading.kind, ATXHeadingOpen);
  assert.equal(heading.text, '# Heading\n');
  assert.ok(heading instanceof HeadingNode);
});

test('ATX heading: getLevel() for levels 1–4', () => {
  const text = '# H1\n\n## H2\n\n### H3\n\n#### H4';
  const file = new SourceFile(text);
  const levels = file.paragraphArenaIndices.map(idx => {
    const node = file.getRedNode(idx);
    return node instanceof HeadingNode ? node.getLevel() : 0;
  });
  assert.deepEqual(levels, [1, 2, 3, 4]);
});

test('ATX heading: heading with closing sequence', () => {
  const text = '## Heading ##\n\nOther';
  const file = new SourceFile(text);
  const heading = file.getNodeAt(0);
  assert.ok(heading instanceof HeadingNode);
  assert.equal(heading.getLevel(), 2);
});

test('HeadingNode via getRedNode and paragraphArenaIndices', () => {
  const text = '## Level 2\n\n#### Level 4';
  const sf = new SourceFile(text);
  const h1 = sf.getRedNode(sf.paragraphArenaIndices[0]);
  const h2 = sf.getRedNode(sf.paragraphArenaIndices[1]);
  assert.ok(h1 instanceof HeadingNode);
  assert.ok(h2 instanceof HeadingNode);
  assert.equal(h1.getLevel(), 2);
  assert.equal(h2.getLevel(), 4);
  assert.equal(h2.offset, 12);
});

// ── Emphasis and strong ───────────────────────────────────────────────────────

test('emphasis: kind, text, firstChild InlineText', () => {
  const text = '# Heading\n\nSome text with *emphasis*.';
  const file = new SourceFile(text);
  const emphasisOffset = text.indexOf('*emphasis*');
  const emNode = file.getNodeAt(emphasisOffset);
  assert.ok(emNode !== null);
  assert.equal(emNode.kind, EmphasisOpen);
  assert.equal(emNode.text, '*emphasis*');
  const emTextNode = emNode.firstChild;
  assert.ok(emTextNode !== null);
  assert.equal(emTextNode.kind, InlineText);
  assert.equal(emTextNode.text, 'emphasis');
});

test('emphasis: sibling traversal "a *b* c"', () => {
  const text = 'a *b* c';
  const file = new SourceFile(text);
  const a = file.getNodeAt(0);
  assert.ok(a !== null);
  assert.equal(a.text, 'a');
  const ws = a.nextSibling;
  assert.ok(ws !== null);
  assert.equal(ws.kind, Whitespace);
  const em = ws.nextSibling;
  assert.ok(em !== null);
  assert.equal(em.kind, EmphasisOpen);
  const ws2 = em.nextSibling;
  assert.ok(ws2 !== null);
  assert.equal(ws2.kind, Whitespace);
  const c = ws2.nextSibling;
  assert.ok(c !== null);
  assert.equal(c.text, 'c');
  assert.equal(c.nextSibling, null);
});

test('emphasis: nested siblings in *a **b** c*', () => {
  const text = '*a **b** c*';
  const file = new SourceFile(text);
  const em = file.getNodeAt(0);
  assert.ok(em !== null);
  assert.equal(em.kind, EmphasisOpen);
  const kids = em.getChildren();
  // With coalescing: "a " becomes TextNode, then StrongOpen
  assert.equal(kids[0].text, 'a ');
  assert.ok(kids[1] instanceof StrongNode || kids[1].kind === StrongOpen);
  // " c" becomes TextNode
  assert.equal(kids[2].text, ' c');
});

test('emphasis: triple *** nests EmphasisOpen and StrongOpen', () => {
  const text = '***triple***';
  const file = new SourceFile(text);
  const outer = file.getNodeAt(0);
  assert.ok(outer !== null);
  assert.ok(outer.kind === EmphasisOpen || outer.kind === StrongOpen);
  const inner = outer.firstChild;
  assert.ok(inner !== null);
  assert.ok(inner.kind === EmphasisOpen || inner.kind === StrongOpen);
  const textNode = inner.firstChild;
  assert.ok(textNode !== null);
  assert.equal(textNode.kind, InlineText);
  assert.equal(textNode.text, 'triple');
});

test('emphasis: link inside emphasis', () => {
  const text = 'Text *with [link](url)* inside.';
  const file = new SourceFile(text);
  const em = file.getNodeAt(text.indexOf('*with'));
  assert.ok(em !== null);
  assert.equal(em.kind, EmphasisOpen);
  const kids = em.getChildren();
  const link = kids.find(c => c.kind === LinkOpen);
  assert.ok(link, 'should find a LinkOpen child inside emphasis');
});

// ── Link and image ────────────────────────────────────────────────────────────

test('link: getNodeAt(0) on [link](url) returns LinkOpen', () => {
  const text = '[link](url) and ![img](src)';
  const file = new SourceFile(text);
  const linkNode = file.getNodeAt(0);
  assert.ok(linkNode !== null);
  assert.equal(linkNode.kind, LinkOpen);
  assert.ok(linkNode instanceof LinkNode);
});

test('image: ImageMarker found at correct offset', () => {
  const text = '[link](url) and ![img](src)';
  const file = new SourceFile(text);
  const imgOffset = text.indexOf('![img]');
  const imgNode = file.getNodeAt(imgOffset);
  assert.ok(imgNode !== null);
  assert.equal(imgNode.kind, ImageMarker);
});

// ── Fenced code block ─────────────────────────────────────────────────────────

test('fenced code: FencedOpen container, FencedContent child', () => {
  const text = '```js\nconst x = 1;\n```';
  const file = new SourceFile(text);
  const fence = file.getNodeAt(0);
  assert.ok(fence !== null);
  assert.equal(fence.kind, FencedOpen);
  assert.ok(fence instanceof CodeBlockNode);
  assert.equal(fence.getFenceChar(), '`');
  const content = fence.firstChild;
  assert.ok(content !== null);
  assert.equal(content.kind, FencedContent);
  assert.equal(content.text, 'const x = 1;\n');
});

// ── Document structure ────────────────────────────────────────────────────────

test('document: heading then paragraph', () => {
  const text = '# H1\n\nParagraph with *em*.';
  const file = new SourceFile(text);
  const h1 = file.getNodeAt(0);
  assert.ok(h1 !== null);
  assert.equal(h1.kind, ATXHeadingOpen);
  const pStart = text.indexOf('Paragraph');
  const pNode = file.getNodeAt(pStart);
  assert.ok(pNode !== null);
  assert.ok(pNode.text.startsWith('Paragraph'));
});

test('document: multiple paragraphs correct offsets', () => {
  const text = 'P1\n\n\nP2\n\n\nP3';
  const sf = new SourceFile(text);
  assert.ok(sf.paragraphIndex.length >= 3);
  assert.equal(sf.paragraphIndex[0], 0);
});

// ── getRedNode and paragraphArenaIndices ──────────────────────────────────────

test('getRedNode: returns node at given arena index', () => {
  const sf = new SourceFile('hello');
  const idx = sf.paragraphArenaIndices[0];
  const node = sf.getRedNode(idx);
  assert.ok(node instanceof RedNode);
  assert.equal(node.offset, 0);
  assert.equal(node.width, 5);
});

test('getRedNode: correct offset for second paragraph', () => {
  const text = 'Line 1\n\nLine 2';
  const sf = new SourceFile(text);
  const line2Idx = sf.paragraphArenaIndices[1];
  const line2Node = sf.getRedNode(line2Idx);
  assert.equal(line2Node.offset, 8);
});

test('getRedNode: offset updated after edit', () => {
  const text = 'Line 1\n\nLine 2';
  const sf = new SourceFile(text);
  const newText = 'Line 1 extended\n\nLine 2';
  sf.update(newText, { start: 7, oldEnd: 7, newEnd: 16 });
  const line2Node = sf.getRedNode(sf.paragraphArenaIndices[1]);
  assert.equal(line2Node.offset, 17);
});

// ── Offset accuracy ───────────────────────────────────────────────────────────

test('offset: each sibling in "ab cd" has correct cumulative offset', () => {
  const text = 'ab cd';
  const sf = new SourceFile(text);
  let curr = sf.getNodeAt(0);
  let expectedOffset = 0;
  let count = 0;
  while (curr) {
    assert.equal(curr.offset, expectedOffset, `node "${curr.text}" offset mismatch`);
    expectedOffset += curr.width;
    curr = curr.nextSibling;
    if (++count > 100) break;
  }
  assert.equal(expectedOffset, text.length);
});

test('offset: indented text paragraph at correct offset', () => {
  const text = '   Indent\n\nNext';
  const sf = new SourceFile(text);
  const nextIdx = sf.paragraphArenaIndices[1];
  const nextNode = sf.getRedNode(nextIdx);
  assert.equal(nextNode.offset, 11);
});

// ── Out-of-bounds ─────────────────────────────────────────────────────────────

test('getNodeAt: returns null for negative offset', () => {
  const text = '# Heading\n\nText';
  const file = new SourceFile(text);
  assert.equal(file.getNodeAt(-1), null);
});

test('getNodeAt: returns null for offset beyond text length', () => {
  const text = '# Heading\n\nText';
  const file = new SourceFile(text);
  assert.equal(file.getNodeAt(1000), null);
});

// ── Whitespace-only ───────────────────────────────────────────────────────────

test('whitespace-only text: arena has nodes, getNodeAt works', () => {
  const text = '   \n  \n\t  ';
  const file = new SourceFile(text);
  assert.ok(file.arena.length > NODE_STRIDE);
  assert.ok(file.getNodeAt(0) !== null);
});

// ── Frontmatter ───────────────────────────────────────────────────────────────

test('frontmatter: first node is FrontmatterOpen, heading found after', () => {
  const text = '---\ntitle: Test\n---\n\n# Heading';
  const file = new SourceFile(text);
  const fmNode = file.getNodeAt(0);
  assert.ok(fmNode !== null);
  assert.equal(fmNode.kind, FrontmatterOpen);
  const headingOffset = text.indexOf('# Heading');
  const headingNode = file.getNodeAt(headingOffset);
  assert.ok(headingNode instanceof HeadingNode);
});

// ── Tables ────────────────────────────────────────────────────────────────────

test('tables: TablePipe first, heading found after', () => {
  const text = '| A | B |\n|---|---|\n| 1 | 2 |\n\n# Heading';
  const file = new SourceFile(text);
  const tableNode = file.getNodeAt(0);
  assert.ok(tableNode !== null);
  assert.equal(tableNode.kind, TablePipe);
  const headingNode = file.getNodeAt(text.indexOf('# Heading'));
  assert.ok(headingNode instanceof HeadingNode);
});

// ── HTML blocks ───────────────────────────────────────────────────────────────

test('HTML blocks: correct first node, heading found after', () => {
  const text = '<div>\n  <p>Hello</p>\n</div>\n\n# Heading';
  const file = new SourceFile(text);
  const divNode = file.getNodeAt(0);
  assert.ok(divNode !== null);
  const headingNode = file.getNodeAt(text.indexOf('# Heading'));
  assert.ok(headingNode instanceof HeadingNode);
  assert.equal(headingNode.getLevel(), 1);
});

// ── Blockquotes ───────────────────────────────────────────────────────────────

test('blockquotes: first node is BlockquoteMarker', () => {
  const text = '> Blockquote text\n\n# Heading';
  const file = new SourceFile(text);
  const bqNode = file.getNodeAt(0);
  assert.ok(bqNode !== null);
  assert.equal(bqNode.kind, BlockquoteMarker);
  const headingNode = file.getNodeAt(text.indexOf('# Heading'));
  assert.ok(headingNode instanceof HeadingNode);
});

// ── Consecutive updates ───────────────────────────────────────────────────────

test('consecutive updates: each edit produces correct text and nodes', () => {
  const text = 'Line 1\n\nLine 2\n\nLine 3';
  const file = new SourceFile(text);

  let newText = 'Line 1 modified\n\nLine 2\n\nLine 3';
  file.update(newText, { start: 0, end: 6 });
  assert.equal(file.text, newText);
  assert.equal(file.getNodeAt(0)?.text, 'Line 1 modified');

  const line2Offset = newText.indexOf('Line 2');
  newText = 'Line 1 modified\n\nLine 2 modified\n\nLine 3';
  file.update(newText, { start: line2Offset, end: line2Offset + 6 });
  assert.equal(file.text, newText);
  assert.equal(file.getNodeAt(file.paragraphIndex[1])?.text, 'Line 2 modified');
});

// ── update: boundary edits ────────────────────────────────────────────────────

test('update: edit at the very beginning of file', () => {
  const text = 'Old start\n\nRest of file';
  const file = new SourceFile(text);
  file.update('New start\n\nRest of file', { start: 0, end: 9 });
  const node = file.getNodeAt(0);
  assert.ok(node !== null);
  assert.equal(node.text, 'New start');
});

test('update: edit at the very end of file', () => {
  const text = '# Heading\n\nOld end';
  const file = new SourceFile(text);
  const newText = '# Heading\n\nNew end';
  file.update(newText, { start: text.indexOf('Old end'), end: text.length });
  const node = file.getNodeAt(newText.indexOf('New end'));
  assert.ok(node !== null);
  assert.equal(node.text, 'New end');
});

// ── Recursive children ────────────────────────────────────────────────────────

test('recursive children: countNodes > 1 for *Outer **Inner***', () => {
  const text = '*Outer **Inner***';
  const sf = new SourceFile(text);

  /** @param {RedNode} node @returns {number} */
  function countNodes(node) {
    let count = 1;
    for (const child of node.getChildren()) {
      count += countNodes(child);
    }
    return count;
  }

  const root = sf.getRedNode(sf.paragraphArenaIndices[0]);
  assert.ok(countNodes(root) > 1);
});

// ── Mixed formatting ──────────────────────────────────────────────────────────

test('mixed formatting: EmphasisOpen and StrongOpen found as siblings', () => {
  const text = 'Normal *Italic* **Bold** Code';
  const sf = new SourceFile(text);
  const kinds = /** @type {number[]} */ ([]);
  let curr = sf.getNodeAt(0);
  while (curr) {
    kinds.push(curr.kind);
    curr = curr.nextSibling;
  }
  assert.ok(kinds.includes(EmphasisOpen));
  assert.ok(kinds.includes(StrongOpen));
});

// ── Complex nesting ───────────────────────────────────────────────────────────

test('complex nesting: multi-block document without crash', () => {
  const text = `
# Main Title

> A blockquote

* List item with **bold** and *italic*

## Subtitle
`.trim();
  const file = new SourceFile(text);
  const h1Offset = text.indexOf('# Main Title');
  const h1Node = file.getNodeAt(h1Offset);
  assert.ok(h1Node instanceof HeadingNode);
  assert.equal(h1Node.getLevel(), 1);
  const h2Offset = text.indexOf('## Subtitle');
  const h2Node = file.getNodeAt(h2Offset);
  assert.ok(h2Node instanceof HeadingNode);
  assert.equal(h2Node.getLevel(), 2);
});

// ── Isolation at offset ───────────────────────────────────────────────────────

test('isolation: EmphasisOpen found via sibling walk on "... *Italic*"', () => {
  const text = '... *Italic*';
  const sf = new SourceFile(text);
  const kinds = /** @type {number[]} */ ([]);
  let curr = sf.getRedNode(sf.paragraphArenaIndices[0]);
  while (curr) {
    kinds.push(curr.kind);
    curr = curr.nextSibling;
  }
  assert.ok(kinds.includes(EmphasisOpen));
});
