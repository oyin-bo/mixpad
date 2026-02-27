// @ts-check
import assert from 'node:assert';
import { test } from 'node:test';
import { SourceFile } from '../ast.js';
import * as TOKEN from '../scan-tokens.js';

test('SourceFile basic construction', () => {
  const text = '# Heading\n\nSome text with *emphasis*.';
  const file = new SourceFile(text);

  assert.strictEqual(file.text, text);

  // Check Heading
  const heading = file.getNodeAt(0);
  assert.ok(heading);
  assert.strictEqual(heading.kind, TOKEN.ATXHeadingOpen);
  assert.strictEqual(heading.text, '# Heading\n');

  // Check Emphasis
  const emphasisOffset = text.indexOf('*emphasis*');
  const emNode = file.getNodeAt(emphasisOffset);
  assert.ok(emNode);
  assert.strictEqual(emNode.kind, TOKEN.EmphasisOpen);
  assert.strictEqual(emNode.text, '*emphasis*');

  // Check child of emphasis
  const emTextNode = emNode.firstChild;
  assert.ok(emTextNode);
  assert.strictEqual(emTextNode.kind, TOKEN.InlineText);
  assert.strictEqual(emTextNode.text, 'emphasis');
});

test('SourceFile node traversal', () => {
  const text = '*a* b';
  const file = new SourceFile(text);
  
  const emNode = file.getNodeAt(0);
  assert.strictEqual(emNode.kind, TOKEN.EmphasisOpen);
  
  const bText = file.getNodeAt(4); // 'b'
  assert.strictEqual(bText.kind, TOKEN.InlineText);
  assert.strictEqual(bText.text, 'b');
});

test('SourceFile nested emphasis', () => {
  const text = '***triple***';
  const file = new SourceFile(text);
  
  const outer = file.getNodeAt(0);
  assert.ok(outer.kind === TOKEN.StrongOpen || outer.kind === TOKEN.EmphasisOpen);
  
  const inner = outer.firstChild;
  assert.ok(inner.kind === TOKEN.StrongOpen || inner.kind === TOKEN.EmphasisOpen);
  
  const textNode = inner.firstChild;
  assert.strictEqual(textNode.kind, TOKEN.InlineText);
  assert.strictEqual(textNode.text, 'triple');
});

test('SourceFile heading kind extraction', () => {
  const text = '# H1\n## H2';
  const file = new SourceFile(text);
  
  const h1 = file.getNodeAt(0);
  assert.strictEqual(h1.kind, TOKEN.ATXHeadingOpen);
  
  // The NewLine at offset 4 is a sibling of H2, so offset 5 is H2.
  const h2 = file.getNodeAt(6); 
  assert.strictEqual(h2.kind, TOKEN.ATXHeadingOpen);
});

test('SourceFile image and link', () => {
  const text = '[link](url) and ![img](src)';
  const file = new SourceFile(text);
  
  const linkOpen = file.getNodeAt(0);
  assert.strictEqual(linkOpen.kind, TOKEN.LinkOpen);
  
  const imgMarker = file.getNodeAt(text.indexOf('![img]'));
  assert.strictEqual(imgMarker.kind, TOKEN.ImageMarker);
});

test('SourceFile fenced code block', () => {
  const text = '```js\nconst x = 1;\n```';
  const file = new SourceFile(text);
  
  const fence = file.getNodeAt(0);
  assert.strictEqual(fence.kind, TOKEN.FencedOpen);
  
  const content = fence.firstChild;
  assert.strictEqual(content.kind, TOKEN.FencedContent);
  assert.strictEqual(content.text, 'const x = 1;\n');
});

test('SourceFile complex nesting - link in emphasis', () => {
  const text = 'Text *with [link](url)* inside.';
  const file = new SourceFile(text);
  
  const em = file.getNodeAt(text.indexOf('*with'));
  assert.strictEqual(em.kind, TOKEN.EmphasisOpen);
  
  const kids = em.getChildren();
  const link = kids.find(c => c.kind === TOKEN.LinkOpen);
  assert.ok(link);
});

test('SourceFile sibling traversal', () => {
  const text = 'a *b* c';
  const file = new SourceFile(text);
  
  const a = file.getNodeAt(0);
  assert.strictEqual(a.text, 'a');
  
  const ws = a.nextSibling;
  assert.strictEqual(ws.kind, TOKEN.Whitespace);
  
  const em = ws.nextSibling;
  assert.strictEqual(em.kind, TOKEN.EmphasisOpen);
  
  const ws2 = em.nextSibling;
  assert.strictEqual(ws2.kind, TOKEN.Whitespace);
  
  const c = ws2.nextSibling;
  assert.strictEqual(c.text, 'c');
});

test('SourceFile complex nesting - nested siblings', () => {
  const text = '*a **b** c*';
  const file = new SourceFile(text);
  
  const em = file.getNodeAt(0);
  const kids = em.getChildren();
  
  assert.strictEqual(kids[0].text, 'a');
  assert.strictEqual(kids[1].kind, TOKEN.Whitespace);
  assert.strictEqual(kids[2].kind, TOKEN.StrongOpen);
  assert.strictEqual(kids[3].kind, TOKEN.Whitespace);
  assert.strictEqual(kids[4].text, 'c');
});

test('SourceFile document structure', () => {
  const text = '# H1\n\nParagraph with *em*.';
  const file = new SourceFile(text);
  
  const h1 = file.getNodeAt(0);
  assert.strictEqual(h1.kind, TOKEN.ATXHeadingOpen);
  
  const pStart = text.indexOf('Paragraph');
  const pNode = file.getNodeAt(pStart);
  assert.ok(pNode.text.startsWith('Paragraph'));
});
