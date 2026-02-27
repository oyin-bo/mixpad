// @ts-check
import assert from 'node:assert';
import { test } from 'node:test';
import { SourceFile, RedNode, NODE_SIZE } from '../ast.js';
import * as Tokens from '../scan-tokens.js';
import { getTokenKind, getTokenLength } from '../scan-core.js';

test('SourceFile basic full parse', () => {
  const text = '### Heading\n\nParagraph text.';
  const sourceFile = new SourceFile(text);

  assert.strictEqual(sourceFile.text, text);
  assert.ok(sourceFile.arena.length > 0);
  
  // Verify heading node
  const headingArenaIdx = sourceFile.paragraphArenaIndices[0];
  const headingNode = sourceFile.getRedNode(headingArenaIdx);
  
  assert.strictEqual(getTokenKind(headingNode.header), Tokens.ATXHeadingOpen);
  assert.strictEqual(headingNode.offset, 0);
});

test('SourceFile incremental update position calculation', () => {
  const text = 'Line 1\n\nLine 2';
  const sourceFile = new SourceFile(text);
  
  // Offset of "Line 2" should be 8 (Line 1\n\n)
  const line2Idx = sourceFile.paragraphArenaIndices[1];
  const line2Node = sourceFile.getRedNode(line2Idx);
  assert.strictEqual(line2Node.offset, 8);
  
  // Update "Line 1" to "Line 1 extended"
  const newText = 'Line 1 extended\n\nLine 2';
  sourceFile.update(newText, { start: 7, oldEnd: 7, newEnd: 7 + 9 }); // inserting " extended"
  
  assert.strictEqual(sourceFile.text, newText);
  
  // After update, "Line 2" offset should be 8 + 9 = 17
  const line2NodeUpdate = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[1]);
  assert.strictEqual(line2NodeUpdate.offset, 17);
});

test('Heading level extraction', () => {
  const text = '## Level 2\n\n#### Level 4';
  const sourceFile = new SourceFile(text);
  const heading1 = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[0]);
  const heading2 = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[1]);

  assert.strictEqual(heading1.getLevel(), 2);
  assert.strictEqual(heading2.getLevel(), 4);
});

test('Multiple paragraphs and empty lines', () => {
  const text = 'P1\n\n\nP2\n\n\nP3';
  const sourceFile = new SourceFile(text);
  // paragraphArenaIndices should track distinct reparse points
  assert.ok(sourceFile.paragraphIndex.length >= 3);
  assert.strictEqual(sourceFile.paragraphIndex[0], 0);
  // Exact offsets depend on semantic scanner's reparse point placement
});

test('Nested emphasis structure', () => {
  const text = '*Combined **Bold***';
  const sourceFile = new SourceFile(text);
  const root = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[0]); // EmphasisOpen
  assert.strictEqual(root.kind, Tokens.EmphasisOpen);

  const children = root.getChildren();
  assert.ok(children.length >= 1);
  assert.ok(children.some(c => c.kind === Tokens.StrongOpen || c.kind === Tokens.InlineText));
});

test('Link node hierarchy', () => {
  const text = 'Check [this link](url) now.';
  const sourceFile = new SourceFile(text);
  let linkNode = null;
  let scanIdx = 0;
  while (scanIdx < sourceFile.arena.length) {
    if (getTokenKind(sourceFile.arena[scanIdx]) === Tokens.LinkOpen) {
      linkNode = sourceFile.getRedNode(scanIdx);
      break;
    }
    scanIdx += NODE_SIZE;
  }
  assert.ok(linkNode);
  assert.strictEqual(linkNode.kind, Tokens.LinkOpen);
  assert.ok(linkNode.getChildren().length > 0);
});

test('Incremental: insert at start', () => {
  const text = 'Original content';
  const sourceFile = new SourceFile(text);
  const newText = 'Prepend! Original content';
  sourceFile.update(newText, { start: 0, oldEnd: 0, newEnd: 9 });

  assert.strictEqual(sourceFile.paragraphIndex[0], 0);
  assert.strictEqual(sourceFile.text, newText);
});

test('Incremental: delete in middle', () => {
  const text = 'Part 1\n\nPart 2\n\nPart 3';
  const sourceFile = new SourceFile(text);
  const initialCount = sourceFile.paragraphIndex.length;

  const newText = 'Part 1\n\nPart 3';
  sourceFile.update(newText, { start: 8, oldEnd: 16, newEnd: 8 });
  assert.strictEqual(sourceFile.text, newText);
  assert.ok(sourceFile.paragraphIndex.length < initialCount);
});

test('Recursive children traversal', () => {
  const text = '*Outer **Inner***';
  const sourceFile = new SourceFile(text);

  /** @param {RedNode} node */
  function countNodes(node) {
    let count = 1;
    for (const child of node.getChildren()) {
      count += countNodes(child);
    }
    return count;
  }

  const root = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[0]);
  const total = countNodes(root);
  assert.ok(total > 1);
});

test('Reparse point with heading', () => {
  const text = 'Text before\n\n# Heading\n\nText after';
  const sourceFile = new SourceFile(text);
  // Heading usually starts a new reparse point
  const hasHeadingOffset = sourceFile.paragraphIndex.some(offset => text.substring(offset, offset + 1) === '#');
  assert.ok(hasHeadingOffset);
});

test('Whitespace preservation in offsets', () => {
  const text = '   Indent\n\nNext';
  const sourceFile = new SourceFile(text);
  const nextNodeIdx = sourceFile.paragraphArenaIndices[1];
  const nextNode = sourceFile.getRedNode(nextNodeIdx);
  assert.strictEqual(nextNode.offset, 11); // "   Indent\n\n"
});

test('Isolation at offset', () => {
  const text = '... *Italic*';
  const sourceFile = new SourceFile(text);
  const info = [];
  let curr = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[0]);
  while (curr) {
    info.push(curr.kind);
    curr = curr.nextSibling;
  }
  assert.ok(info.indexOf(Tokens.EmphasisOpen) !== -1);
});

test('Mixed formatting with multiple nodes', () => {
  const text = 'Normal *Italic* **Bold** Code';
  const sourceFile = new SourceFile(text);
  const info = [];
  let curr = sourceFile.getRedNode(sourceFile.paragraphArenaIndices[0]);
  while (curr) {
    info.push(curr.kind);
    curr = curr.nextSibling;
  }
  assert.ok(info.indexOf(Tokens.EmphasisOpen) !== -1);
  assert.ok(info.indexOf(Tokens.StrongOpen) !== -1);
});
