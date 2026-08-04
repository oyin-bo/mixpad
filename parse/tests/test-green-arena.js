// @ts-check
/// <reference types="node" />

import assert from 'node:assert';
import { test } from 'node:test';

import {
  createArena, allocateNode,
  getHeader, getFirstChild, getNextSibling, getMaterialized,
  setFirstChild, setNextSibling, setMaterialized,
  nodeCount, spliceNodes, countChildren, computeWidth,
  NODE_STRIDE
} from '../green-arena.js';

import { InlineText, Whitespace, NewLine } from '../scan-tokens.js';

test('createArena returns array with null sentinel at index 0', () => {
  const arena = createArena();
  assert.strictEqual(arena.length, NODE_STRIDE);
  assert.strictEqual(arena[0], 0);
  assert.strictEqual(arena[1], 0);
  assert.strictEqual(arena[2], 0);
  assert.strictEqual(arena[3], null);
});

test('allocateNode places node at correct index', () => {
  const arena = createArena();
  const header = InlineText | 5;
  const idx = allocateNode(arena, header);

  assert.strictEqual(idx, NODE_STRIDE);
  assert.strictEqual(getHeader(arena, idx), header);
  assert.strictEqual(getFirstChild(arena, idx), 0);
  assert.strictEqual(getNextSibling(arena, idx), 0);
  assert.strictEqual(getMaterialized(arena, idx), null);
});

test('allocateNode with all parameters', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 3);
  const b = allocateNode(arena, Whitespace | 1, a, 0, 'hello');

  assert.strictEqual(getFirstChild(arena, b), a);
  assert.strictEqual(getNextSibling(arena, b), 0);
  assert.strictEqual(getMaterialized(arena, b), 'hello');
});

test('setFirstChild and setNextSibling modify arena', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 3);
  const b = allocateNode(arena, Whitespace | 1);
  const c = allocateNode(arena, InlineText | 4);

  setFirstChild(arena, a, b);
  setNextSibling(arena, b, c);

  assert.strictEqual(getFirstChild(arena, a), b);
  assert.strictEqual(getNextSibling(arena, b), c);
});

test('setMaterialized stores arbitrary data', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 3);

  setMaterialized(arena, a, { url: 'https://example.com' });
  assert.deepStrictEqual(getMaterialized(arena, a), { url: 'https://example.com' });

  setMaterialized(arena, a, 'plain string');
  assert.strictEqual(getMaterialized(arena, a), 'plain string');
});

test('nodeCount reflects allocated nodes plus sentinel', () => {
  const arena = createArena();
  assert.strictEqual(nodeCount(arena), 1);

  allocateNode(arena, InlineText | 5);
  assert.strictEqual(nodeCount(arena), 2);

  allocateNode(arena, Whitespace | 1);
  allocateNode(arena, NewLine | 1);
  assert.strictEqual(nodeCount(arena), 4);
});

test('countChildren follows firstChild-nextSibling chain', () => {
  const arena = createArena();
  const parent = allocateNode(arena, InlineText | 10);
  const c1 = allocateNode(arena, InlineText | 3);
  const c2 = allocateNode(arena, Whitespace | 1);
  const c3 = allocateNode(arena, InlineText | 6);

  setFirstChild(arena, parent, c1);
  setNextSibling(arena, c1, c2);
  setNextSibling(arena, c2, c3);

  assert.strictEqual(countChildren(arena, parent), 3);
  assert.strictEqual(countChildren(arena, c3), 0);
});

test('computeWidth returns header width for leaf nodes', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 7);

  assert.strictEqual(computeWidth(arena, a), 7);
});

test('computeWidth sums children widths for parent nodes', () => {
  const arena = createArena();
  const parent = allocateNode(arena, InlineText | 0);
  const c1 = allocateNode(arena, InlineText | 3);
  const c2 = allocateNode(arena, Whitespace | 2);
  const c3 = allocateNode(arena, InlineText | 5);

  setFirstChild(arena, parent, c1);
  setNextSibling(arena, c1, c2);
  setNextSibling(arena, c2, c3);

  assert.strictEqual(computeWidth(arena, parent), 10);
});

test('spliceNodes removes nodes from arena', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 3);
  const b = allocateNode(arena, Whitespace | 1);
  const c = allocateNode(arena, InlineText | 4);

  assert.strictEqual(nodeCount(arena), 4);

  spliceNodes(arena, b, 1);
  assert.strictEqual(nodeCount(arena), 3);

  assert.strictEqual(getHeader(arena, a), InlineText | 3);
  assert.strictEqual(getHeader(arena, a + NODE_STRIDE), InlineText | 4);
});

test('spliceNodes inserts new nodes', () => {
  const arena = createArena();
  const a = allocateNode(arena, InlineText | 3);
  const b = allocateNode(arena, InlineText | 4);

  const newSlots = [NewLine | 1, 0, 0, null];
  spliceNodes(arena, b, 0, newSlots);

  assert.strictEqual(nodeCount(arena), 4);
  assert.strictEqual(getHeader(arena, b), NewLine | 1);
  assert.strictEqual(getHeader(arena, b + NODE_STRIDE), InlineText | 4);
});

test('arena uses native arrays not typed arrays', () => {
  const arena = createArena();
  assert.ok(Array.isArray(arena));
  assert.ok(!(arena instanceof Int32Array));
  assert.ok(!(arena instanceof Uint32Array));

  allocateNode(arena, InlineText | 5, 0, 0, 'data');
  assert.ok(Array.isArray(arena));
});
