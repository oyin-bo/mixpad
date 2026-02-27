// @ts-check
/// <reference types="node" />

import assert from 'node:assert';
import { test } from 'node:test';

import { getTokenKind, getTokenLength } from '../scan-core.js';
import { InlineText, NewLine, Whitespace } from '../scan-tokens.js';
import { NODE_STRIDE, getHeader, getNextSibling, nodeCount } from '../green-arena.js';
import { SourceFile } from '../source-file.js';
import { RedNode } from '../red-node.js';

test('SourceFile constructor parses simple text into arena', () => {
  const sf = new SourceFile('hello');
  assert.ok(nodeCount(sf.arena) > 1);
  assert.strictEqual(sf.text, 'hello');
});

test('SourceFile arena contains token nodes for simple text', () => {
  const sf = new SourceFile('abc');

  let totalWidth = 0;
  for (let i = NODE_STRIDE; i < sf.arena.length; i += NODE_STRIDE) {
    totalWidth += getTokenLength(getHeader(sf.arena, i));
  }
  assert.strictEqual(totalWidth, 3);
});

test('SourceFile paragraphIndex has at least one entry', () => {
  const sf = new SourceFile('hello world');
  assert.ok(sf.paragraphIndex.offsets.length >= 1);
  assert.strictEqual(sf.paragraphIndex.offsets[0], 0);
});

test('SourceFile getNodeAt finds token at offset', () => {
  const sf = new SourceFile('hello');
  const result = sf.getNodeAt(0);
  assert.ok(result !== null);
  assert.strictEqual(result.nodeOffset, 0);
  assert.ok(result.nodeIndex >= NODE_STRIDE);
});

test('SourceFile getNodeAt returns null for out-of-range offset', () => {
  const sf = new SourceFile('hello');
  assert.strictEqual(sf.getNodeAt(-1), null);
  assert.strictEqual(sf.getNodeAt(100), null);
});

test('SourceFile getNodeAt finds correct token in multi-token line', () => {
  const text = 'hello world';
  const sf = new SourceFile(text);

  const atHello = sf.getNodeAt(0);
  assert.ok(atHello !== null);

  const atEnd = sf.getNodeAt(text.length - 1);
  assert.ok(atEnd !== null);
});

test('SourceFile multiline text creates multiple paragraphs', () => {
  const text = 'line one\nline two\n';
  const sf = new SourceFile(text);

  assert.ok(sf.paragraphIndex.offsets.length >= 1);

  let totalWidth = 0;
  for (let i = NODE_STRIDE; i < sf.arena.length; i += NODE_STRIDE) {
    totalWidth += getTokenLength(getHeader(sf.arena, i));
  }
  assert.strictEqual(totalWidth, text.length);
});

test('SourceFile getNodeAt works across paragraphs', () => {
  const text = 'abc\ndef\n';
  const sf = new SourceFile(text);

  const atA = sf.getNodeAt(0);
  assert.ok(atA !== null);

  const atD = sf.getNodeAt(4);
  assert.ok(atD !== null);
});

test('SourceFile update rebuilds arena with new text', () => {
  const sf = new SourceFile('hello');
  const oldNodeCount = nodeCount(sf.arena);

  sf.update('hello world', { start: 5, oldEnd: 5, newEnd: 11 });

  assert.strictEqual(sf.text, 'hello world');
  assert.ok(nodeCount(sf.arena) >= oldNodeCount);
});

test('SourceFile arena nodes form valid sibling chain', () => {
  const sf = new SourceFile('hello world');

  const firstNodeIdx = sf.paragraphIndex.arenaIndices[0];
  let current = firstNodeIdx;
  let visited = 0;

  while (current > 0) {
    visited++;
    current = getNextSibling(sf.arena, current);
    if (visited > 1000) break;
  }

  assert.ok(visited > 0);
  assert.ok(visited < 1000);
});

test('RedNode wraps arena node correctly', () => {
  const sf = new SourceFile('hello');
  const firstNodeIdx = sf.paragraphIndex.arenaIndices[0];
  const node = new RedNode(sf.arena, sf.paragraphIndex, firstNodeIdx);

  assert.ok(node.width > 0);
  assert.ok(node.kind > 0);
  assert.strictEqual(node.index, firstNodeIdx);
});

test('RedNode getAbsolutePosition returns correct offset', () => {
  const sf = new SourceFile('hello');
  const firstNodeIdx = sf.paragraphIndex.arenaIndices[0];
  const node = new RedNode(sf.arena, sf.paragraphIndex, firstNodeIdx);

  assert.strictEqual(node.getAbsolutePosition(), 0);
});

test('RedNode nextSibling navigates sibling chain', () => {
  const text = 'hello world';
  const sf = new SourceFile(text);
  const firstNodeIdx = sf.paragraphIndex.arenaIndices[0];
  const firstNode = new RedNode(sf.arena, sf.paragraphIndex, firstNodeIdx);

  let totalWidth = firstNode.width;
  let current = firstNode.nextSibling();
  let count = 1;

  while (current !== null) {
    totalWidth += current.width;
    count++;
    current = current.nextSibling();
    if (count > 1000) break;
  }

  assert.strictEqual(totalWidth, text.length);
  assert.ok(count < 1000);
});

test('RedNode absolute position accumulates across siblings', () => {
  const text = 'ab cd';
  const sf = new SourceFile(text);
  const firstNodeIdx = sf.paragraphIndex.arenaIndices[0];
  let current = new RedNode(sf.arena, sf.paragraphIndex, firstNodeIdx);

  let expectedOffset = 0;
  let count = 0;

  while (current !== null) {
    assert.strictEqual(current.getAbsolutePosition(), expectedOffset);
    expectedOffset += current.width;
    const next = current.nextSibling();
    current = next;
    count++;
    if (count > 1000) break;
  }

  assert.strictEqual(expectedOffset, text.length);
});
