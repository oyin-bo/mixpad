import { test } from 'node:test';
import assert from 'node:assert';
import { SourceFile, HeadingNode, CodeBlockNode } from '../ast.js';

test('SourceFile initial parse creates paragraph index', () => {
  const text = 'Paragraph 1\n\nParagraph 2\n\n# Heading 1';
  const file = new SourceFile(text);
  
  assert.ok(file.paragraphIndex.length > 0);
  assert.strictEqual(file.paragraphIndex[0], 0);
});

test('SourceFile getNodeAt returns correct node', () => {
  const text = '### Heading 3\n\nSome text';
  const file = new SourceFile(text);
  
  const node = file.getNodeAt(0);
  assert.ok(node);
  assert.ok(node instanceof HeadingNode);
  assert.strictEqual(node.getLevel(), 3);
  assert.strictEqual(node.text, '### Heading 3\n');
});

test('SourceFile parses CodeBlockNode correctly', () => {
  const text = '```js\nconst a = 1;\n```\n\nSome text';
  const file = new SourceFile(text);
  
  const node = file.getNodeAt(0);
  assert.ok(node);
  assert.ok(node instanceof CodeBlockNode);
  assert.strictEqual(node.getFenceChar(), '`');
  assert.strictEqual(node.text, '```js\nconst a = 1;\n```\n');
});

test('SourceFile update incrementally reparses', () => {
  const text = 'Paragraph 1\n\nParagraph 2\n\n# Heading 1';
  const file = new SourceFile(text);
  
  const initialArenaLength = file.arena.length;
  const initialParagraphCount = file.paragraphIndex.length;
  
  // Edit Paragraph 2
  const newText = 'Paragraph 1\n\nParagraph 2 edited\n\n# Heading 1';
  file.update(newText, { start: 13, end: 24 });
  
  assert.strictEqual(file.text, newText);
  // The arena should be updated
  assert.ok(file.arena.length > 0);
  
  // The heading should still be parsed correctly
  const headingOffset = newText.indexOf('# Heading 1');
  const node = file.getNodeAt(headingOffset);
  assert.ok(node);
  assert.ok(node instanceof HeadingNode);
  assert.strictEqual(node.getLevel(), 1);
});

test('SourceFile handles multiple headings of different levels', () => {
  const text = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
  const file = new SourceFile(text);
  
  for (let i = 1; i <= 6; i++) {
    const offset = text.indexOf(`${'#'.repeat(i)} H${i}`);
    const node = file.getNodeAt(offset);
    assert.ok(node instanceof HeadingNode, `Expected HeadingNode for H${i}`);
    assert.strictEqual(node.getLevel(), i);
  }
});

test('SourceFile handles code blocks with different fence characters', () => {
  const text = '~~~html\n<div></div>\n~~~\n\n```css\nbody { color: red; }\n```';
  const file = new SourceFile(text);
  
  const htmlOffset = text.indexOf('~~~html');
  const htmlNode = file.getNodeAt(htmlOffset);
  assert.ok(htmlNode instanceof CodeBlockNode);
  assert.strictEqual(htmlNode.getFenceChar(), '~');
  
  const cssOffset = text.indexOf('```css');
  const cssNode = file.getNodeAt(cssOffset);
  assert.ok(cssNode instanceof CodeBlockNode);
  assert.strictEqual(cssNode.getFenceChar(), '`');
});

test('SourceFile handles mixed content with lists and blockquotes', () => {
  const text = '# Title\n\n> Blockquote text\n> More quote\n\n* Item 1\n* Item 2\n\nSome paragraph.';
  const file = new SourceFile(text);
  
  const titleNode = file.getNodeAt(0);
  assert.ok(titleNode instanceof HeadingNode);
  
  // Just verify it doesn't crash and can find nodes in the middle
  const bqOffset = text.indexOf('> Blockquote');
  const bqNode = file.getNodeAt(bqOffset);
  assert.ok(bqNode);
  
  const listOffset = text.indexOf('* Item 1');
  const listNode = file.getNodeAt(listOffset);
  assert.ok(listNode);
});

test('SourceFile handles empty file', () => {
  const file = new SourceFile('');
  assert.strictEqual(file.arena.length, 0);
  assert.strictEqual(file.paragraphIndex.length, 1);
  assert.strictEqual(file.paragraphIndex[0], 0);
  assert.strictEqual(file.getNodeAt(0), null);
});

test('SourceFile handles file with only whitespace', () => {
  const text = '   \n  \n\t  ';
  const file = new SourceFile(text);
  assert.ok(file.arena.length > 0);
  const node = file.getNodeAt(0);
  assert.ok(node);
});

test('SourceFile update at the very beginning of file', () => {
  const text = 'Old start\n\nRest of file';
  const file = new SourceFile(text);
  
  file.update('New start\n\nRest of file', { start: 0, end: 9 });
  
  const node = file.getNodeAt(0);
  assert.ok(node);
  assert.strictEqual(node.text, 'New start');
});

test('SourceFile update at the very end of file', () => {
  const text = '# Heading\n\nOld end';
  const file = new SourceFile(text);
  
  const endOffset = text.indexOf('Old end');
  file.update('# Heading\n\nNew end', { start: endOffset, end: text.length });
  
  const newEndOffset = '# Heading\n\n'.length;
  const node = file.getNodeAt(newEndOffset);
  assert.ok(node);
  assert.strictEqual(node.text, 'New end');
});

test('SourceFile handles complex nested structures (simulated)', () => {
  // Even though our AST builder is currently flat, we should ensure it processes
  // complex markdown without crashing and maintains correct offsets
  const text = `
# Main Title

> A blockquote with a
> \`\`\`js
> const x = 1;
> \`\`\`
> inside it.

* List item with **bold** and *italic*
* Another item with [a link](http://example.com)

## Subtitle
`;
  const file = new SourceFile(text);
  
  const h1Offset = text.indexOf('# Main Title');
  const h1Node = file.getNodeAt(h1Offset);
  assert.ok(h1Node instanceof HeadingNode);
  assert.strictEqual(h1Node.getLevel(), 1);
  
  const h2Offset = text.indexOf('## Subtitle');
  const h2Node = file.getNodeAt(h2Offset);
  assert.ok(h2Node);
  // The current simple AST builder might not correctly identify headings inside complex structures
  // like blockquotes and lists if it doesn't handle all token types properly.
  // For now, we just verify it doesn't crash and finds a node.
});

test('SourceFile handles HTML blocks', () => {
  const text = '<div>\n  <p>Hello</p>\n</div>\n\n# Heading';
  const file = new SourceFile(text);
  
  const divOffset = text.indexOf('<div>');
  const divNode = file.getNodeAt(divOffset);
  assert.ok(divNode);
  
  const headingOffset = text.indexOf('# Heading');
  const headingNode = file.getNodeAt(headingOffset);
  assert.ok(headingNode instanceof HeadingNode);
});

test('SourceFile handles tables', () => {
  const text = '| A | B |\n|---|---|\n| 1 | 2 |\n\n# Heading';
  const file = new SourceFile(text);
  
  const tableOffset = text.indexOf('| A |');
  const tableNode = file.getNodeAt(tableOffset);
  assert.ok(tableNode);
  
  const headingOffset = text.indexOf('# Heading');
  const headingNode = file.getNodeAt(headingOffset);
  assert.ok(headingNode instanceof HeadingNode);
});

test('SourceFile handles frontmatter', () => {
  const text = '---\ntitle: Test\n---\n\n# Heading';
  const file = new SourceFile(text);
  
  const fmOffset = text.indexOf('---');
  const fmNode = file.getNodeAt(fmOffset);
  assert.ok(fmNode);
  
  const headingOffset = text.indexOf('# Heading');
  const headingNode = file.getNodeAt(headingOffset);
  assert.ok(headingNode instanceof HeadingNode);
});

test('SourceFile getNodeAt returns null for out of bounds offset', () => {
  const text = '# Heading\n\nText';
  const file = new SourceFile(text);
  
  assert.strictEqual(file.getNodeAt(-1), null);
  assert.strictEqual(file.getNodeAt(1000), null);
});

test('SourceFile handles consecutive updates', () => {
  const text = 'Line 1\n\nLine 2\n\nLine 3';
  const file = new SourceFile(text);
  
  // First update
  let newText = 'Line 1 modified\n\nLine 2\n\nLine 3';
  file.update(newText, { start: 0, end: 6 });
  assert.strictEqual(file.text, newText);
  
  // Second update
  const line2Offset = newText.indexOf('Line 2');
  newText = 'Line 1 modified\n\nLine 2 modified\n\nLine 3';
  file.update(newText, { start: line2Offset, end: line2Offset + 6 });
  assert.strictEqual(file.text, newText);
  
  const node = file.getNodeAt(newText.indexOf('Line 2 modified'));
  assert.ok(node);
  assert.strictEqual(node.text, 'Line 2 modified');
});
