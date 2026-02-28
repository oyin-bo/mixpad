// @ts-check

import assert from 'node:assert';
import test from 'node:test';
import { parse } from '../ast/index.js';
import * as NodeTypes from '../ast/node-types.js';

test('AST builder: Parses basic paragraphs and headings', () => {
  const text = `# Hello\nThis is a test.`;
  const doc = parse(text);

  console.log(JSON.stringify(doc, null, 2));

  assert.strictEqual(doc.type, NodeTypes.Document);
  // Heading + NewLine (ignored usually, or mapped as text) + Paragraph = 2 real blocks normally.
  // Right now it caught NewLine as text node.
  let blocks = doc.children ? doc.children.filter(n => n.type !== NodeTypes.Text) : [];
  assert.strictEqual(blocks.length, 2);

  const heading = blocks[0];
  assert.strictEqual(heading.type, NodeTypes.Heading);
  assert.strictEqual(heading.level, 1);
  assert.strictEqual(heading.text, 'Hello');

  const paragraph = blocks[1];
  assert.strictEqual(paragraph.type, NodeTypes.Paragraph);
  assert.strictEqual(paragraph.text, 'This is a test.');
});

test('AST builder: Parses Emphasis and Strong', () => {
  const text = `This is *italic* and **bold**!`;
  const doc = parse(text);

  const para = doc.children[0];
  assert.strictEqual(para.children?.length, 5);

  assert.strictEqual(para.children[0].type, NodeTypes.Text);
  assert.strictEqual(para.children[0].text, 'This is ');

  assert.strictEqual(para.children[1].type, NodeTypes.Emphasis);
  assert.strictEqual(para.children[1].text, 'italic');

  assert.strictEqual(para.children[2].type, NodeTypes.Text);
  assert.strictEqual(para.children[2].text, ' and ');

  assert.strictEqual(para.children[3].type, NodeTypes.Strong);
  assert.strictEqual(para.children[3].text, 'bold');

  assert.strictEqual(para.children[4].type, NodeTypes.Text);
  assert.strictEqual(para.children[4].text, '!');
});
