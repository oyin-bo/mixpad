// @ts-check

/**
 * Get a dataset by name.
 * Ported from old-parser/benchmark/src/datasets.ts
 * @param {string} name 
 * @returns {{ name: string, content: string }}
 */
export function getDataset(name) {
  function safeByteLength(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    // @ts-ignore
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(s, 'utf8');
    return s.length;
  }

  if (name === 'small-simple') return { name, content: '# Hi\n\nThis is a small document.' };

  if (name === 'docs-collection') {
    // In Browser, this cannot work easily without pre-fetching.
    // We return a simple placeholder for now.
    return { name, content: '# Docs collection placeholder\n\nNot available in browser yet.' };
  }

  if (name === 'medium') {
    const targetBytes = 512 * 1024;
    let seed = 12345;
    function next() { seed = (1103515245 * seed + 12345) >>> 0; return seed; }
    const words = ['lorem','ipsum','dolor','sit','amet','alpha','beta','gamma','delta','example','paragraph','token','scanner','parser','benchmark','node','typescript','javascript','markup','format'];
    const chunks = [];
    let currentSize = 0;
    while (currentSize < targetBytes) {
      const wcount = (next() % 30) + 5;
      const lineWords = [];
      for (let i = 0; i < wcount; i++) lineWords.push(words[next() % words.length]);
      const r = next() % 100;
      let chunk;
      if (r < 6) chunk = '# ' + lineWords.join(' ');
      else if (r < 18) chunk = '## ' + lineWords.join(' ');
      else if (r < 34) chunk = '- ' + lineWords.join(' ');
      else if (r < 48) chunk = '```\n' + lineWords.join(' ') + '\n' + lineWords.join(' ') + '\n```';
      else if (r < 62) chunk = lineWords.map(w => '`' + w + '`').join(' ');
      else chunk = lineWords.join(' ');
      
      chunks.push(chunk);
      currentSize += safeByteLength(chunk) + 2; // +2 for \n\n
    }
    return { name, content: chunks.join('\n\n') };
  }

  if (name === 'medium-mixed') {
    const targetBytes = 50 * 1024;
    let seed = 13579;
    function next() { seed = (1103515245 * seed + 12345) >>> 0; return seed; }
    const complexPatterns = [
      '# Complex Document\n\n',
      'This paragraph contains **nested *italic inside bold* formatting** and more text.\n\n',
      '```javascript\n// Code block\nfunction example() {\n  return "Hello World";\n}\n```\n\n',
      '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n\n',
      '> This is a blockquote with **bold text**\n> and multiple lines.\n\n',
      '1. Ordered list item\n2. Another ordered item\n3. Third item with `code`\n\n'
    ];
    const parts = [];
    let currentSize = 0;
    while (currentSize < targetBytes) {
      const p = complexPatterns[next() % complexPatterns.length];
      parts.push(p);
      currentSize += safeByteLength(p);
    }
    return { name, content: parts.join('').substring(0, targetBytes) };
  }

  if (name === 'pathological') {
    const targetBytes = 180 * 1024;
    let seed = 424242;
    function next() { seed = (214013 * seed + 2531011) >>> 0; return seed; }
    const emph = ['*', '**', '_', '__'];
    const chunks = [];
    let currentSize = 0;
    for (let block = 0; currentSize < targetBytes && block < 1200; block++) {
      const depth = 1 + (next() % 10);
      const items = 1 + (next() % 6);
      for (let i = 0; i < items; i++) {
        const indent = '  '.repeat(depth);
        const e = emph[next() % emph.length];
        const words = [];
        const wcount = 3 + (next() % 12);
        for (let k = 0; k < wcount; k++) words.push(('word' + ((next() % 1000))));
        const code = '`' + words.slice(0, Math.min(3, words.length)).join('-') + '`';
        const item = `${indent}- ${e}${words.join(' ')}${e} ${code} [link](http://example.com/${next() % 10000})`;
        chunks.push(item);
        currentSize += safeByteLength(item) + 1;
      }
      if ((next() % 5) === 0) {
        const e1 = emph[next() % emph.length];
        const e2 = emph[next() % emph.length];
        const parts = [];
        for (let p = 0; p < 4 + (next() % 6); p++) parts.push(e1 + 'patho' + (next() % 10000) + e2);
        const pStr = parts.join(' ');
        chunks.push(pStr);
        currentSize += safeByteLength(pStr) + 2;
      }
    }
    return { name, content: chunks.join('\n\n') };
  }

  if (name === 'super-heavy') {
    const targetBytes = 12 * 1024 * 1024;
    let seed = 42;
    function next() { seed = (1664525 * seed + 1013904223) >>> 0; return seed; }
    const words = ['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','markdown','code','list','item','heading','subheading','example','paragraph','token','scanner','parser','benchmark'];
    const chunks = [];
    let currentSize = 0;
    while (currentSize < targetBytes) {
      const wcount = (next() % 40) + 1;
      const lineWords = [];
      for (let i = 0; i < wcount; i++) lineWords.push(words[next() % words.length]);
      const r = next() % 100;
      let chunk;
      if (r < 5) chunk = '# ' + lineWords.join(' ');
      else if (r < 15) chunk = '## ' + lineWords.join(' ');
      else if (r < 30) chunk = '- ' + lineWords.join(' ');
      else if (r < 40) chunk = '```\n' + lineWords.join(' ') + '\n```';
      else chunk = lineWords.join(' ');
      chunks.push(chunk);
      currentSize += safeByteLength(chunk) + 2;
    }
    return { name, content: chunks.join('\n\n') };
  }

  if (name === 'large-text-heavy') {
    const targetBytes = 500 * 1024;
    const textBlock = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n';
    let content = '# Large Text Document\n\n';
    while (safeByteLength(content) < targetBytes) content += textBlock;
    return { name, content: content.substring(0, targetBytes) };
  }

  return { name, content: '' };
}
