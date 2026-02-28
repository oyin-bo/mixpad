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

test('AST Builder: HTML Elements - Basic', () => {
    // <span>text</span>
    const text = '<span>text</span>';
    const doc = parse(text);

    // Should be Document -> Paragraph -> HtmlElement(span) -> Text
    const para = doc.children[0];
    assert.strictEqual(para.type, NodeTypes.Paragraph, 'Root should contain Paragraph');

    // @ts-ignore
    const span = para.children[0];
    assert.strictEqual(span.type, NodeTypes.HtmlElement, 'Paragraph should contain HtmlElement');
    // @ts-ignore
    assert.strictEqual(span.tagName, 'span');

    // @ts-ignore
    // Wait, children is generic.
    // If span has children, check content.
    const textNode = span.children[0];
    assert.strictEqual(textNode.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode.text, 'text');
});

test('AST Builder: HTML Elements - Void', () => {
    // <br/>text. 
    // <br> is void, so 'text' should be sibling.
    const text = '<br>text';
    const doc = parse(text);
    const para = doc.children[0];

    // @ts-ignore
    const br = para.children[0];
    assert.strictEqual(br.type, NodeTypes.HtmlElement);
    // @ts-ignore
    assert.strictEqual(br.tagName, 'br');
    // Ensure br has no children (if pushed to blockStack it would capture 'text')
    assert.strictEqual(br.children.length, 0);

    // @ts-ignore
    const textNode = para.children[1];
    assert.strictEqual(textNode.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode.text, 'text');
});

test('AST Builder: HTML Elements - Self Closing', () => {
    // <div />text
    const text = '<div />text';
    const doc = parse(text);
    const para = doc.children[0];

    // @ts-ignore
    const div = para.children[0];
    assert.strictEqual(div.type, NodeTypes.HtmlElement);
    // @ts-ignore
    assert.strictEqual(div.tagName, 'div');
    assert.strictEqual(div.children.length, 0); // Self-closed, didn't capture text

    // @ts-ignore
    const textNode = para.children[1];
    assert.strictEqual(textNode.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode.text, 'text');
});

test('AST Builder: HTML Elements - Nested', () => {
    // <div><span>text</span></div>
    const text = '<div><span>text</span></div>';
    const doc = parse(text);
    const para = doc.children[0];

    // @ts-ignore
    const div = para.children[0];
    assert.strictEqual(div.type, NodeTypes.HtmlElement);
    // @ts-ignore
    assert.strictEqual(div.tagName, 'div');

    // @ts-ignore
    const span = div.children[0];
    assert.strictEqual(span.type, NodeTypes.HtmlElement);
    // @ts-ignore
    assert.strictEqual(span.tagName, 'span');

    // @ts-ignore
    const textNode = span.children[0];
    assert.strictEqual(textNode.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode.text, 'text');
});

test('AST Builder: HTML Elements - Malformed Recovery (Unclosed)', () => {
    // <div>text
    // Missing closing tag. Should contain text.
    const text = '<div>text';
    const doc = parse(text);
    const para = doc.children[0];

    // @ts-ignore
    const div = para.children[0];
    assert.strictEqual(div.type, NodeTypes.HtmlElement);
    // @ts-ignore
    assert.strictEqual(div.tagName, 'div');

    // @ts-ignore
    const textNode = div.children[0];
    assert.strictEqual(textNode.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode.text, 'text');
});

test('AST Builder: HTML Elements - Malformed Recovery (Orphan Close)', () => {
    // text</div>
    const text = 'text</div>';
    const doc = parse(text);
    const para = doc.children[0];

    // @ts-ignore
    const textNode1 = para.children[0];
    assert.strictEqual(textNode1.type, NodeTypes.Text);
    // @ts-ignore
    assert.strictEqual(textNode1.text, 'text');

    // The closing tag should be treated as text?
    // My implementation: Orphand closing tag -> TextNode.
    // @ts-ignore
    const closeTagAsText = para.children[1];
    assert.strictEqual(closeTagAsText.type, NodeTypes.Text);
});

test('AST Builder: Blockquote - Basic', () => {
    const doc = parse('> hello');
    // Document -> Blockquote -> Paragraph -> Text
    const blocks = doc.children.filter(n => n.type !== NodeTypes.Text);
    assert.strictEqual(blocks.length, 1);
    const bq = blocks[0];
    assert.strictEqual(bq.type, NodeTypes.Blockquote);
    const para = bq.children.find(n => n.type === NodeTypes.Paragraph);
    assert.ok(para, 'Blockquote should contain a Paragraph');
    assert.ok(para.text.trim().includes('hello'));
});

test('AST Builder: Blockquote - Nested', () => {
    const doc = parse('>> nested');
    // Document -> Blockquote -> Blockquote -> Paragraph -> Text
    const bq1 = doc.children.find(n => n.type === NodeTypes.Blockquote);
    assert.ok(bq1, 'Document should contain outer Blockquote');
    const bq2 = bq1.children.find(n => n.type === NodeTypes.Blockquote);
    assert.ok(bq2, 'Outer Blockquote should contain inner Blockquote');
    const para = bq2.children.find(n => n.type === NodeTypes.Paragraph);
    assert.ok(para, 'Inner Blockquote should contain a Paragraph');
    assert.ok(para.text.trim().includes('nested'));
});

test('AST Builder: Blockquote - Multi-line', () => {
    const doc = parse('> Hello\n> World');
    // Both lines share the same outer Blockquote container
    const bq = doc.children.find(n => n.type === NodeTypes.Blockquote);
    assert.ok(bq, 'Document should contain a Blockquote');
    const paragraphs = bq.children.filter(n => n.type === NodeTypes.Paragraph);
    assert.ok(paragraphs.length >= 1, 'Blockquote should contain at least one paragraph');
});

test('AST Builder: Table - Basic structure', () => {
    const doc = parse('| a | b |\n|---|---|\n| 1 | 2 |');
    const table = doc.children.find(n => n.type === NodeTypes.Table);
    assert.ok(table, 'Document should contain a Table');
    const rows = table.children.filter(n => n.type === NodeTypes.TableRow);
    assert.strictEqual(rows.length, 2, 'Table should have header row + 1 data row');
    // Header row
    assert.ok(rows[0].isHeader, 'First row should be the header');
    const headerCells = rows[0].children.filter(n => n.type === NodeTypes.TableCell);
    assert.strictEqual(headerCells.length, 2, 'Header row should have 2 cells');
    assert.ok(headerCells[0].text.trim() === 'a', 'First header cell content');
    assert.ok(headerCells[1].text.trim() === 'b', 'Second header cell content');
    // Data row
    const dataCells = rows[1].children.filter(n => n.type === NodeTypes.TableCell);
    assert.strictEqual(dataCells.length, 2, 'Data row should have 2 cells');
    assert.ok(dataCells[0].text.trim() === '1', 'First data cell content');
    assert.ok(dataCells[1].text.trim() === '2', 'Second data cell content');
});

test('AST Builder: Table - Multiple data rows', () => {
    const doc = parse('| x |\n|---|\n| 1 |\n| 2 |\n| 3 |');
    const table = doc.children.find(n => n.type === NodeTypes.Table);
    assert.ok(table, 'Should have a Table');
    const rows = table.children.filter(n => n.type === NodeTypes.TableRow);
    assert.strictEqual(rows.length, 4, '1 header + 3 data rows');
});

test('AST Builder: Table - Followed by paragraph', () => {
    const doc = parse('| a |\n|---|\n| 1 |\n\nAfter');
    const table = doc.children.find(n => n.type === NodeTypes.Table);
    assert.ok(table, 'Should have a Table');
    const para = doc.children.find(n => n.type === NodeTypes.Paragraph);
    assert.ok(para, 'Should have a trailing Paragraph');
    assert.ok(para.text.includes('After'));
});

test('AST Builder: Table - No leading pipe', () => {
  const doc = parse('a | b\n---|---\n1 | 2\n');
  assert.strictEqual(doc.children.length, 1, 'Should produce one Table, not a Paragraph+Table mix');
  const table = doc.children[0];
  assert.strictEqual(table.type, NodeTypes.Table, 'Root child should be Table');
  const rows = table.children.filter(n => n.type === NodeTypes.TableRow);
  assert.strictEqual(rows.length, 2, 'Should have header and data row');
  assert.ok(rows[0].isHeader, 'First row is header');
  const hCells = rows[0].children.filter(n => n.type === NodeTypes.TableCell);
  assert.strictEqual(hCells[0].text.trim(), 'a', 'Header cell 0');
  assert.strictEqual(hCells[1].text.trim(), 'b', 'Header cell 1');
  const dCells = rows[1].children.filter(n => n.type === NodeTypes.TableCell);
  assert.strictEqual(dCells[0].text.trim(), '1', 'Data cell 0');
  assert.strictEqual(dCells[1].text.trim(), '2', 'Data cell 1');
});

test('AST Builder: Table - Cell trailing whitespace trimmed', () => {
  const doc = parse('| spaces  |\n|---|\n| val  |\n');
  const table = doc.children.find(n => n.type === NodeTypes.Table);
  assert.ok(table, 'Table should exist');
  const headerCell = table.children[0].children.find(n => n.type === NodeTypes.TableCell);
  assert.strictEqual(headerCell.text, 'spaces', 'Header cell text should be trimmed');
  const dataCell = table.children[1].children.find(n => n.type === NodeTypes.TableCell);
  assert.strictEqual(dataCell.text, 'val', 'Data cell text should be trimmed');
});

test('AST Builder: Table - Column alignment stored on header cells', () => {
  const doc = parse('| L | C | R | D |\n|:---|:---:|---:|---|\n| a | b | c | d |\n');
  const table = doc.children.find(n => n.type === NodeTypes.Table);
  assert.ok(table, 'Table should exist');
  const headerCells = table.children[0].children.filter(n => n.type === NodeTypes.TableCell);
  assert.strictEqual(headerCells.length, 4, 'Should have 4 header cells');
  assert.strictEqual(headerCells[0].align, 'left', 'First column: left');
  assert.strictEqual(headerCells[1].align, 'center', 'Second column: center');
  assert.strictEqual(headerCells[2].align, 'right', 'Third column: right');
  assert.strictEqual(headerCells[3].align, undefined, 'Fourth column: no alignment');
});

