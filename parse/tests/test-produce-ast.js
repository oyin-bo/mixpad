// @ts-check
/// <reference types="node" />

import fs from 'fs';
import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';

import { SourceFile } from '../source-file.js';
import * as SemanticNodes from '../source-file.js';

const getTokenKind = (header) => (header >> 16) & 0x03FF;
const getTokenLength = (header) => header & 0xFFFF;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoBase = path.resolve(__dirname, '..', '..');

/**
 * Breadcrumb AST Test Runner.
 * 
 * Syntax:
 * @N NodeType field=val field="val" > ChildType field=val > GrandchildType
 * 
 * - @N refers to a positional marker N in the line above.
 * - Each segment (separated by ' > ') verifies a node in the hierarchy.
 * - Fields can be properties (node.text) or methods (node.getLevel()).
 */

const astTestsDir = path.join(__dirname, 'ast');

for (const mdFilePath of findMarkdownFiles(astTestsDir)) {
  const fileName = path.basename(mdFilePath);

  const relativePath = path.relative(repoBase, mdFilePath).replace(/\\/g, '/');
  const fullContent = fs.readFileSync(mdFilePath, 'utf8');
  const sections = splitByEOFMarkers(fullContent);

  for (const section of sections) {
    const parsedBlocks = parseAnnotatedASTBlocks(section.content);
    if (!parsedBlocks.tests.length) continue;

    const sourceText = parsedBlocks.markdownLines.join('');

    for (const testCase of parsedBlocks.tests) {
      const testName = `${relativePath} line ${testCase.lineIndex + section.startLineIndex + 1}: ${testCase.markdownLine.trim()}`;

      test(testName, () => {
        const sourceFile = new SourceFile(sourceText);
        
        for (const assertion of testCase.assertions) {
          const absoluteOffset = testCase.lineStartOffset + assertion.lineCharOffset;
          const rootNode = sourceFile.getNodeAt(absoluteOffset);

          if (!rootNode) {
            throw new Error(`No node found at marker ${assertion.marker} (absolute offset ${absoluteOffset})`);
          }

          let currentNode = rootNode;
          const segments = parseBreadcrumbs(assertion.breadcrumbSource);

          // If the first segment doesn't match the rootNode, and rootNode is just a leaf/generic BaseNode,
          // try walking up to see if any parent matches the first segment.
          if (!matchesSegment(currentNode, segments[0])) {
            let p = currentNode.parent;
            while (p) {
              if (matchesSegment(p, segments[0])) {
                currentNode = p;
                break;
              }
              p = p.parent;
            }
          }

          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];

            if (i > 0) {
              const children = currentNode.getChildren();
              const found = children.find(child => matchesSegment(child, segment));
              if (!found) {
                const childNames = children.map(c => c.constructor.name).join(', ');
                throw new Error(`Marker @${assertion.marker}: Failed to find child matching "${segment.raw}" in [${childNames}]`);
              }
              currentNode = found;
            } else {
              // Root segment verification
              if (!matchesSegment(currentNode, segment)) {
                const pos = sourceFile._getNodePos(currentNode.arenaIndex);
                throw new Error(`Marker @${assertion.marker}: Node ${currentNode.constructor.name} (at ${pos}) does not match root segment "${segment.raw}"`);
              }
            }

            // 2. Perform field assertions
            for (const { key, expected } of segment.fields) {
              const actual = getFieldValue(currentNode, key);
              if (actual !== expected) {
                throw new Error(`Marker @${assertion.marker}: Node ${currentNode.constructor.name} field "${key}" expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
              }
            }
          }
        }
      });
    }
  }
}

/**
 * @param {import('../source-file.js').BaseNode} node
 * @param {any} segment
 */
function matchesSegment(node, segment) {
  if (segment.type && node.constructor.name !== segment.type) {
    return false;
  }
  return true;
}

/**
 * @param {import('../source-file.js').BaseNode} node
 * @param {string} key
 */
function getFieldValue(node, key) {
  // @ts-ignore
  let val = node[key];
  if (typeof val === 'function') {
    val = val.call(node);
  }
  return val;
}

/**
 * @param {string} source
 */
function parseBreadcrumbs(source) {
  // Split by ' > ' while being careful about quotes (simplified for now)
  const segments = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && char === '>' && source[i-1] === ' ' && source[i+1] === ' ') {
      segments.push(current.trim());
      current = "";
      i++; // skip space
    } else {
      current += char;
    }
  }
  segments.push(current.trim());

  return segments.map(raw => {
    // Regex to split by spaces but preserve quoted strings
    const partRegex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const parts = [];
    let m;
    while ((m = partRegex.exec(raw)) !== null) {
      parts.push(m[0]);
    }

    const type = /^[A-Z]/.test(parts[0]) ? parts[0] : null;
    const fields = [];
    const attrStartIndex = type ? 1 : 0;

    for (let i = attrStartIndex; i < parts.length; i++) {
        const eqIdx = parts[i].indexOf('=');
        if (eqIdx > 0) {
            const key = parts[i].slice(0, eqIdx);
            let valStr = parts[i].slice(eqIdx + 1);
            // If the value is empty after '=', the quoted string is the next part
            if (valStr === '' && i + 1 < parts.length && parts[i + 1].startsWith('"')) {
                valStr = parts[++i];
            }
            let expected;
            if (valStr.startsWith('"') && valStr.endsWith('"')) {
                expected = JSON.parse(valStr);
            } else if (/^\d+$/.test(valStr)) {
                expected = parseInt(valStr, 10);
            } else if (valStr === 'true') {
                expected = true;
            } else if (valStr === 'false') {
                expected = false;
            } else {
                expected = valStr;
            }
            fields.push({ key, expected });
        }
    }

    return { type, fields, raw };
  });
}

// ── UTILITIES (duplicated from test-produce-annotated for zero-dependency) ────

function findMarkdownFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isFile() && full.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function splitByEOFMarkers(fullContent) {
  const sections = [];
  const lines = fullContent.split(/\r\n|\n|\r/);
  let currentSection = [];
  let currentStartLine = 0;
  const EOF_MARKER_REGEX = /^<--+\s*EOF\s*$/;
  for (let i = 0; i < lines.length; i++) {
    if (EOF_MARKER_REGEX.test(lines[i].trim())) {
      if (currentSection.length > 0) {
        sections.push({ content: currentSection.join('\n'), startLineIndex: currentStartLine });
      }
      currentStartLine = i + 1;
      currentSection = [];
    } else {
      currentSection.push(lines[i]);
    }
  }
  if (currentSection.length > 0) {
    sections.push({ content: currentSection.join('\n'), startLineIndex: currentStartLine });
  }
  return sections;
}

function parseAnnotatedASTBlocks(annotatedMarkdown) {
  const markdownLines = [];
  const tests = [];
  let pos = 0;
  const NEWLINE_REGEX = /\r\n|\n|\r/g;
  let rawLineIndex = 0;

  const lines = annotatedMarkdown.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // If this line is a marker line (starts with 1) and next line starts with @
    if (line.trimStart().startsWith('1') && nextLine.trimStart().startsWith('@')) {
      const assertions = [];
      // Map marker indices to columns
      line.replace(/\S/g, (m, offset) => {
        assertions.push({ marker: m, lineCharOffset: offset });
        return m;
      });

      // Parse following assertion lines
      let j = i + 1;
      let assertionIdx = 0;
      while (j < lines.length && lines[j].trimStart().startsWith('@')) {
        const aLine = lines[j].trim();
        const markerMatch = aLine.match(/^@([\dA-Z]+)\s+(.*)$/);
        if (markerMatch) {
          const marker = markerMatch[1];
          const breadcrumb = markerMatch[2];
          // Find the assertion object with this marker
          const targetOffset = assertions.find(a => a.marker === marker);
          if (targetOffset) {
            targetOffset.breadcrumbSource = breadcrumb;
          }
        }
        j++;
      }

      tests.push({
        markdownLine: markdownLines[markdownLines.length - 1],
        lineStartOffset: markdownLines.reduce((acc, curr) => acc + curr.length, 0) - markdownLines[markdownLines.length - 1].length,
        lineIndex: markdownLines.length - 1,
        assertions: assertions.filter(a => a.breadcrumbSource)
      });
      
      // Advance outer loop past markers and assertions
      i = j - 1;
    } else {
      markdownLines.push(line + '\n');
    }
  }

  return { markdownLines, tests };
}
