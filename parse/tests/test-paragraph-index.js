// @ts-check
/// <reference types="node" />

import assert from 'node:assert';
import { test } from 'node:test';

import {
  createParagraphIndex, addParagraph, findParagraph,
  getParagraphOffset, getArenaIndex, shiftFrom, spliceParagraphs
} from '../paragraph-index.js';

test('createParagraphIndex returns empty structure', () => {
  const idx = createParagraphIndex();
  assert.deepStrictEqual(idx.offsets, []);
  assert.deepStrictEqual(idx.arenaIndices, []);
});

test('addParagraph stores offset and arena index', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 25, 20);
  addParagraph(idx, 50, 36);

  assert.strictEqual(idx.offsets.length, 3);
  assert.strictEqual(getParagraphOffset(idx, 0), 0);
  assert.strictEqual(getParagraphOffset(idx, 1), 25);
  assert.strictEqual(getParagraphOffset(idx, 2), 50);
  assert.strictEqual(getArenaIndex(idx, 0), 4);
  assert.strictEqual(getArenaIndex(idx, 1), 20);
  assert.strictEqual(getArenaIndex(idx, 2), 36);
});

test('findParagraph returns -1 for empty index', () => {
  const idx = createParagraphIndex();
  assert.strictEqual(findParagraph(idx, 10), -1);
});

test('findParagraph binary searches paragraph offsets', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 20, 16);
  addParagraph(idx, 50, 32);
  addParagraph(idx, 100, 48);

  assert.strictEqual(findParagraph(idx, 0), 0);
  assert.strictEqual(findParagraph(idx, 10), 0);
  assert.strictEqual(findParagraph(idx, 19), 0);
  assert.strictEqual(findParagraph(idx, 20), 1);
  assert.strictEqual(findParagraph(idx, 35), 1);
  assert.strictEqual(findParagraph(idx, 50), 2);
  assert.strictEqual(findParagraph(idx, 99), 2);
  assert.strictEqual(findParagraph(idx, 100), 3);
  assert.strictEqual(findParagraph(idx, 200), 3);
});

test('shiftFrom adjusts downstream paragraph offsets', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 20, 16);
  addParagraph(idx, 50, 32);

  shiftFrom(idx, 1, 5);

  assert.strictEqual(getParagraphOffset(idx, 0), 0);
  assert.strictEqual(getParagraphOffset(idx, 1), 25);
  assert.strictEqual(getParagraphOffset(idx, 2), 55);
});

test('shiftFrom with negative delta', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 20, 16);
  addParagraph(idx, 50, 32);

  shiftFrom(idx, 2, -10);

  assert.strictEqual(getParagraphOffset(idx, 0), 0);
  assert.strictEqual(getParagraphOffset(idx, 1), 20);
  assert.strictEqual(getParagraphOffset(idx, 2), 40);
});

test('spliceParagraphs removes and inserts entries', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 20, 16);
  addParagraph(idx, 50, 32);

  spliceParagraphs(idx, 1, 1, [25, 35], [20, 28]);

  assert.strictEqual(idx.offsets.length, 4);
  assert.strictEqual(getParagraphOffset(idx, 0), 0);
  assert.strictEqual(getParagraphOffset(idx, 1), 25);
  assert.strictEqual(getParagraphOffset(idx, 2), 35);
  assert.strictEqual(getParagraphOffset(idx, 3), 50);
  assert.strictEqual(getArenaIndex(idx, 1), 20);
  assert.strictEqual(getArenaIndex(idx, 2), 28);
});

test('spliceParagraphs removes entries without insert', () => {
  const idx = createParagraphIndex();
  addParagraph(idx, 0, 4);
  addParagraph(idx, 20, 16);
  addParagraph(idx, 50, 32);

  spliceParagraphs(idx, 1, 1);

  assert.strictEqual(idx.offsets.length, 2);
  assert.strictEqual(getParagraphOffset(idx, 0), 0);
  assert.strictEqual(getParagraphOffset(idx, 1), 50);
});
