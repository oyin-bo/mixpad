// @ts-check
/// <reference types="node" />

import fs from 'node:fs';
import assert from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../../ast/index.js';
import * as NodeTypes from '../../ast/node-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoBase = path.resolve(__dirname, '..', '..', '..');

const NodeNames = {};
const NodeNameToType = {};
for (const key in NodeTypes) {
  if (typeof NodeTypes[key] === 'number') {
    NodeNames[NodeTypes[key]] = key;
    NodeNameToType[key] = NodeTypes[key];
  }
}

for (const mdFilePath of findMarkdownFiles(__dirname)) {
  const fileName = path.basename(mdFilePath);
  const relativePath = path.relative(repoBase, mdFilePath).replace(/\\/g, '/');
  const fullContent = fs.readFileSync(mdFilePath, 'utf8');
  const sections = splitByEOFMarkers(fullContent);

  for (const section of sections) {
    const parsedTestCases = parseScannedAnnotatedBlocks(section.content);
    const markdownContentText = parsedTestCases.markdownLines.join('');
    
    // Parse the entire section markdown
    const ast = parse(markdownContentText);

    for (const testCase of parsedTestCases.tests) {
      const adjustedRawLineIndex = testCase.rawLineIndex + section.startLineIndex;
      const testName =
        `${relativePath} ` +
        parsedTestCases.markdownLines[testCase.lineIndex]
          .replace(/[\\\[\]\(\)\.\*\?\+\|{}\^$&<>\/!:"]+/g, ' ').trim() + ' ' +
        testCase.positionalMarkerLine.trimEnd().replace(/\s+/g, '-');

      test(testName, () => {
        let manufacturedPositionalMarkerLine = '';
        let anyAssertionFailed = 0;
        
        /** @type {number[]} */
        const assertionTokenLineStartPositions = [];
        const assertionTexts = [];

        // 1. Gather all actual AST nodes that start within this line's boundaries
      const actualNodes = [];
      const lineEndOffset = testCase.lineStartOffset + testCase.markdownLine.length;
      walk(ast, testCase.lineStartOffset, lineEndOffset, actualNodes);

        // Sort nodes by start offset, then by depth/type heuristics if they share an offset
        actualNodes.sort((a, b) => {
          if (a.start !== b.start) return a.start - b.start;
          
          // Heuristic: Parents usually span wider than children.
          // By putting wider nodes first, we get Document -> Heading -> Text.
          const aLen = a.end - a.start;
          const bLen = b.end - b.start;
          return bLen - aLen;
        });

        // 2. Map user assertions to actual nodes
        const assertionIndexToNodeIndex = new Map();
        const nodeIndexToAssertionIndex = new Map();

        for (let i = 0; i < testCase.assertions.length; i++) {
          const assertion = testCase.assertions[i];
          const expectedAbsoluteOffset = testCase.lineStartOffset + assertion.lineCharOffset;
          
          let bestNodeIndex = -1;
          let bestDistance = Infinity;

          for (let j = 0; j < actualNodes.length; j++) {
            if (nodeIndexToAssertionIndex.has(j)) continue; // node already claimed

            const node = actualNodes[j];
            
            const isTypeMatch = assertion.assertType === -1 || assertion.assertType === node.type;
            const distance = Math.abs(node.start - expectedAbsoluteOffset);

            // Fuzzy matching rules: exact match, or close type match
            if (distance < bestDistance && (distance === 0 || (isTypeMatch && distance <= 3))) {
              bestDistance = distance;
              bestNodeIndex = j;
            }
          }

          if (bestNodeIndex !== -1) {
            assertionIndexToNodeIndex.set(i, bestNodeIndex);
            nodeIndexToAssertionIndex.set(bestNodeIndex, i);
          }
        }

        // 3. Generate output driven purely by actual nodes
        for (let j = 0; j < actualNodes.length; j++) {
          const node = actualNodes[j];
          const actualLineCharOffset = node.start - testCase.lineStartOffset;

          while (manufacturedPositionalMarkerLine.length < actualLineCharOffset) {
            manufacturedPositionalMarkerLine += ' ';
          }

          const validMarkerIndex = assertionTokenLineStartPositions.length;
          assertionTokenLineStartPositions.push(actualLineCharOffset);
          const validMarker = encodeID(validMarkerIndex);
          manufacturedPositionalMarkerLine += validMarker;

          const hasAssertion = nodeIndexToAssertionIndex.has(j);
          if (!hasAssertion) {
             assertionTexts.push(`@${validMarker} ` + synthesizeAssertion(node));
             anyAssertionFailed++;
             continue;
          }

          const assertionIndex = nodeIndexToAssertionIndex.get(j);
          const assertion = testCase.assertions[assertionIndex];

          if (assertion.unparseable || assertion.needsGeneration) {
            assertionTexts.push(`@${validMarker} ` + synthesizeAssertion(node));
            anyAssertionFailed++;
            continue;
          }

          let failed = false;
          if (assertion.assertType !== -1 && assertion.assertType !== node.type) failed = true;
          if (assertion.assertText !== null && assertion.assertText !== node.text) failed = true;
          for (const key in assertion.assertProps) {
             if (node[key] !== assertion.assertProps[key]) failed = true;
          }

          if (failed) {
            anyAssertionFailed++;
            assertionTexts.push(`@${validMarker} ` + synthesizeAssertion(node));
          } else {
            const rewrite = assertion.assertionSource.replace(/^@\s*[\dA-Z]+/, `@${validMarker}`);
            assertionTexts.push(rewrite);
          }
        }

        // 4. Any assertions left over without an actual node?
        for (let i = 0; i < testCase.assertions.length; i++) {
          if (!assertionIndexToNodeIndex.has(i)) {
             // The user asserted a node here, but the parser completely dropped/lost it.
             // We omit it from the marker line to show it's "dead", causing a diff failure.
             anyAssertionFailed++;
          }
        }

        if (manufacturedPositionalMarkerLine.trimEnd() === testCase.positionalMarkerLine.trimEnd() &&
          !anyAssertionFailed) {
          assert.ok(true);
          return;
        }

        // Build diff breadcrumbs
        const leadLines = [
          'at ' + relativePath + ':' + (adjustedRawLineIndex + 1) + '\n'
        ];
        for (let i = Math.max(0, testCase.lineIndex - 3); i <= testCase.lineIndex; i++) {
          leadLines.push(parsedTestCases.markdownLines[i]);
        }

        const trailLines = [];
        for (let i = testCase.lineIndex + 1; i < Math.min(parsedTestCases.markdownLines.length, testCase.lineIndex + 3); i++) {
          trailLines.push(parsedTestCases.markdownLines[i]);
        }

        let fullActual =
          leadLines.join('') +
          manufacturedPositionalMarkerLine + '\n' +
          assertionTexts.join('\n') + '\n' +
          trailLines.join('');

        let fullExpected =
          leadLines.join('') +
          testCase.positionalMarkerLine +
          testCase.assertions.map(a => a.assertionSource || '').join('\n') + '\n' +
          trailLines.join('');

        while (fullActual.length < 80 || fullExpected.length < 80) {
          fullActual += '\n';
          fullExpected += '\n';
        }

        assert.strictEqual(fullActual, fullExpected);
      });
    }
  }
}

/**
 * Traverses AST to find nodes starting inside the range [start, end)
 */
function walk(node, start, end, results) {
  if (node.start >= start && node.start < end) {
    results.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      if (child.start >= end) break; // Assuming ordered sequence
      walk(child, start, end, results);
    }
  }
}

function synthesizeAssertion(node) {
  let res = NodeNames[node.type];
  if (node.type === NodeTypes.Heading) res += ` level=${node.level}`;
  if (node.type === NodeTypes.List) res += ` isOrdered=${node.isOrdered} indent=${node.indent}`;
  if ((node.type === NodeTypes.Link || node.type === NodeTypes.Image || node.type === NodeTypes.Autolink) && node.url) res += ` url=${JSON.stringify(node.url)}`;
  if (node.type === NodeTypes.FencedCodeBlock && node.language) res += ` language=${JSON.stringify(node.language)}`;
  if (node.type === NodeTypes.HtmlElement && node.tagName) res += ` tagName=${JSON.stringify(node.tagName)}`;
  if (node.type === NodeTypes.TableCell && node.align) res += ` align=${node.align}`;
  if (node.text !== undefined) res += ` ${JSON.stringify(node.text)}`;
  return res;
}

function encodeID(index) {
  return index < 9 ? (index + 1).toString() : String.fromCharCode(index + 1 - 10 + 65);
}

// -------------------------------------------------------------
// Core parsers borrowed and adapted from scan0 verify tokens
// -------------------------------------------------------------

function splitByEOFMarkers(fullContent) {
  const sections = [];
  const lines = fullContent.split(/\r\n|\n|\r/);
  let currentSection = [];
  let currentStartLine = 0;
  const EOF_MARKER_REGEX = /^<--+\s*EOF\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (EOF_MARKER_REGEX.test(line.trim())) {
      if (currentSection.length > 0) {
        sections.push({ content: currentSection.join('\n'), startLineIndex: currentStartLine });
      }
      currentStartLine = i + 1;
      currentSection = [];
      if (i + 1 < lines.length && lines[i + 1].trimStart().startsWith('1')) {
        let skipTo = i + 2; 
        while (skipTo < lines.length && lines[skipTo].trimStart().startsWith('@')) { skipTo++; }
        i = skipTo - 1; 
        currentStartLine = skipTo;
      }
    } else {
      currentSection.push(line);
    }
  }
  if (currentSection.length > 0) {
    sections.push({ content: currentSection.join('\n'), startLineIndex: currentStartLine });
  }
  return sections;
}

function findMarkdownFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isFile() && full.endsWith('.md')) { out.push(full); }
  }
  return out;
}

function parseScannedAnnotatedBlocks(annotatedMarkdown) {
  const markdownLines = [];
  const tests = [];
  let pos = 0;
  const NEWLINE_REGEX = /\r\n|\n|\r/g;
  let rawLineIndex = 0;
  
  while (pos < annotatedMarkdown.length) {
    NEWLINE_REGEX.lastIndex = pos;
    const newlineMatch = NEWLINE_REGEX.exec(annotatedMarkdown);
    const newlinePos = newlineMatch ? newlineMatch.index : annotatedMarkdown.length;
    const nextLineStart = newlinePos + (newlineMatch ? newlineMatch[0].length : 0);
    
    if (newlinePos === pos) {
      markdownLines.push('' + (newlineMatch ? newlineMatch[0] : ''));
      pos = nextLineStart;
      rawLineIndex++;
      continue;
    }

    const line = annotatedMarkdown.slice(pos, nextLineStart);
    pos = nextLineStart;

    const isPositionalMarkerLine = line.trimStart().startsWith('1') && annotatedMarkdown.charAt(pos) === '@';
    if (!isPositionalMarkerLine) {
      markdownLines.push(line);
      rawLineIndex++;
      continue;
    }

    const testRawLineIndex = rawLineIndex;
    rawLineIndex++;

    const assertions = [];
    line.replace(/\S/g, (m, offset) => {
      assertions.push({ lineCharOffset: offset });
      return m;
    });

    for (let iAssertionLine = 0; iAssertionLine < assertions.length; iAssertionLine++) {
      if (annotatedMarkdown.charAt(pos) !== '@') break;
      const assertionLineEndMatch = NEWLINE_REGEX.exec(annotatedMarkdown);
      const assertionLineEndPos = assertionLineEndMatch ? assertionLineEndMatch.index : annotatedMarkdown.length;

      const assertionLine = annotatedMarkdown.slice(pos, assertionLineEndPos).trim();
      pos = assertionLineEndPos + (assertionLineEndMatch ? assertionLineEndMatch[0].length : 0);
      rawLineIndex++;

      assertions[iAssertionLine].assertionSource = assertionLine;

      const m = /^@\s*([\dA-Z]+)\s*/i.exec(assertionLine);
      if (!m) {
        assertions[iAssertionLine].unparseable = true;
        continue;
      }

      assertions[iAssertionLine].marker = m[1];
      let rest = assertionLine.slice(m[0].length);

      // Parse text quote
      let assertText = null;
      const quoteStart = rest.indexOf('"');
      if (quoteStart >= 0) {
        const quoteEnd = rest.lastIndexOf('"');
        if (quoteEnd >= 0) {
          try {
            assertText = JSON.parse(rest.slice(quoteStart, quoteEnd + 1));
            rest = rest.slice(0, quoteStart).trim();
          } catch (e) {
            assertions[iAssertionLine].unparseable = true;
            continue;
          }
        }
      }

      // Parse type and props
      const tokens = rest.split(/\s+/).filter(Boolean);
      let assertType = -1;
      let assertProps = {};
      if (tokens.length > 0) {
        const typeName = tokens[0];
        if (NodeNameToType[typeName] !== undefined) {
          assertType = NodeNameToType[typeName];
        }
        for (let i = 1; i < tokens.length; i++) {
          const parts = tokens[i].split('=');
          if (parts.length === 2) {
            const key = parts[0];
            let val = parts[1];
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else if (/^\d+$/.test(val)) val = parseInt(val, 10);
            assertProps[key] = val;
          }
        }
      }

      assertions[iAssertionLine].assertType = assertType;
      assertions[iAssertionLine].assertText = assertText;
      assertions[iAssertionLine].assertProps = assertProps;
    }

    for (let i = 0; i < assertions.length; i++) {
      if (!assertions[i].assertionSource) {
        assertions[i].needsGeneration = true;
      }
    }

    tests.push({
      markdownLine: markdownLines[markdownLines.length - 1],
      lineStartOffset: markdownLines.slice(0, Math.max(0, markdownLines.length - 1)).reduce((a, b) => a + b.length, 0),
      lineIndex: markdownLines.length - 1,
      rawLineIndex: testRawLineIndex, 
      positionalMarkerLine: line,
      assertions
    });
  }

  return { markdownLines, tests };
}
