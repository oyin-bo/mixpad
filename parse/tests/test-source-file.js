// @ts-check
/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getTokenKind, getTokenLength } from '../scan-core.js';
import { InlineText, NewLine } from '../scan-tokens.js';
import {
  NODE_FIRST_CHILD,
  NODE_HEADER,
  NODE_MATERIALIZED,
  NODE_NEXT_SIBLING,
  NODE_STRIDE,
  SourceFile
} from '../source-file.js';

// ── Arena type ──────────────────────────────────────────────────────────────

test('arena is a native JS Array, not a TypedArray', () => {
  const sf = new SourceFile('Hello');
  assert.ok(Array.isArray(sf.arena), 'arena must be a plain Array');
  assert.ok(Array.isArray(sf.paragraphIndex), 'paragraphIndex must be a plain Array');
});

test('arena supports splice (native array feature required by incremental update)', () => {
  const sf = new SourceFile('Hello');
  assert.equal(typeof sf.arena.splice, 'function');
});

// ── Empty text ───────────────────────────────────────────────────────────────

test('empty text: paragraphIndex is empty', () => {
  const sf = new SourceFile('');
  assert.deepEqual(sf.paragraphIndex, []);
});

test('empty text: arena contains only the null sentinel', () => {
  const sf = new SourceFile('');
  assert.equal(sf.arena.length, NODE_STRIDE);
  assert.equal(sf.arena[0], 0);
  assert.equal(sf.arena[NODE_FIRST_CHILD], 0);
  assert.equal(sf.arena[NODE_NEXT_SIBLING], 0);
  assert.equal(sf.arena[NODE_MATERIALIZED], null);
});

test('empty text: getNodeAt returns 0 (null sentinel)', () => {
  const sf = new SourceFile('');
  assert.equal(sf.getNodeAt(0), 0);
});

// ── Single paragraph ─────────────────────────────────────────────────────────

test('single paragraph: paragraphIndex = [0]', () => {
  const sf = new SourceFile('Hello world');
  assert.deepEqual(sf.paragraphIndex, [0]);
});

test('single paragraph: arena has sentinel + at least one node', () => {
  const sf = new SourceFile('Hello world');
  assert.ok(sf.arena.length > NODE_STRIDE, 'arena must contain real nodes beyond sentinel');
});

test('single paragraph: getNodeAt(0) returns a non-sentinel node with InlineText kind', () => {
  const sf = new SourceFile('Hello world');
  const nodeIdx = sf.getNodeAt(0);
  assert.ok(nodeIdx > 0, 'nodeIdx must be non-zero');
  const header = /** @type {number} */ (sf.arena[nodeIdx + NODE_HEADER]);
  assert.equal(getTokenKind(header), InlineText);
});

test('single paragraph: offsets within the same token map to the same node', () => {
  const sf = new SourceFile('Hello world');
  const node0 = sf.getNodeAt(0);
  const node5 = sf.getNodeAt(5);
  assert.equal(node0, node5, 'chars 0 and 5 are in the same InlineText token');
});

// ── Node layout ───────────────────────────────────────────────────────────────

test('node layout: NODE_STRIDE is 4', () => {
  assert.equal(NODE_STRIDE, 4);
});

test('node layout: first real node starts at offset NODE_STRIDE (after sentinel)', () => {
  const sf = new SourceFile('Hi');
  const nodeIdx = sf.getNodeAt(0);
  assert.equal(nodeIdx, NODE_STRIDE);
});

test('node layout: token length encoded in header matches source width', () => {
  const sf = new SourceFile('Hello');
  const nodeIdx = sf.getNodeAt(0);
  const header = /** @type {number} */ (sf.arena[nodeIdx + NODE_HEADER]);
  assert.equal(getTokenLength(header), 5);
});

// ── Two paragraphs ───────────────────────────────────────────────────────────

test('two paragraphs: paragraphIndex has two entries', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  assert.equal(sf.paragraphIndex.length, 2);
  assert.equal(sf.paragraphIndex[0], 0);
  assert.equal(sf.paragraphIndex[1], 7);
});

test('two paragraphs: getNodeAt resolves to paragraph-1 node for offset in "World"', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  const nodeInHello = sf.getNodeAt(0);
  const nodeInWorld = sf.getNodeAt(7);
  assert.notEqual(nodeInHello, nodeInWorld, '"Hello" and "World" must be different nodes');
  assert.equal(getTokenKind(/** @type {number} */ (sf.arena[nodeInWorld + NODE_HEADER])), InlineText);
});

test('two paragraphs: sibling chain of paragraph 0 includes NewLine tokens', () => {
  // "Hello\n\nWorld" — paragraph 0 has InlineText("Hello"), NewLine, NewLine
  const sf = new SourceFile('Hello\n\nWorld');
  const firstNode = sf.getNodeAt(0);
  let kinds = [];
  let idx = firstNode;
  while (idx) {
    kinds.push(getTokenKind(/** @type {number} */ (sf.arena[idx + NODE_HEADER])));
    idx = /** @type {number} */ (sf.arena[idx + NODE_NEXT_SIBLING]);
  }
  assert.ok(kinds.includes(NewLine), 'paragraph 0 must contain NewLine token(s)');
  assert.ok(kinds.includes(InlineText), 'paragraph 0 must contain InlineText token');
});

// ── update() — text change ────────────────────────────────────────────────────

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
  assert.notEqual(nodeInHello, nodeInWorld);
  assert.equal(getTokenKind(/** @type {number} */ (sf.arena[nodeInWorld + NODE_HEADER])), InlineText);
});

test('update: arena uses splice (grows/shrinks without full rebuild)', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  const arenaRef = sf.arena;

  sf.update('Hello!\n\nWorld', { start: 5, end: 5 });

  // splice() mutates the original array object, so the reference is identical
  assert.equal(sf.arena, arenaRef, 'update() must splice the existing arena array');
});

test('update: collapsing two paragraphs into one merges paragraphIndex', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  assert.equal(sf.paragraphIndex.length, 2);

  // Replace "\n\n" with " " so there is no longer a blank line
  sf.update('Hello World', { start: 5, end: 7 });

  assert.equal(sf.paragraphIndex.length, 1);
  assert.equal(sf.paragraphIndex[0], 0);
});

test('update: empty text after full deletion clears paragraphIndex', () => {
  const sf = new SourceFile('Hello\n\nWorld');
  sf.update('', { start: 0, end: 12 });
  assert.deepEqual(sf.paragraphIndex, []);
});
