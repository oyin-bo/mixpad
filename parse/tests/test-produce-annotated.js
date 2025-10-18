// @ts-check
/// <reference types="node" />

import fs from 'fs';
import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';

import { getTokenFlags, getTokenKind, getTokenLength } from '../scan-core.js';
import * as TOKEN_KIND_VALUES from '../scan-tokens.js';
import * as TOKEN_FLAG_VALUES from '../scan-token-flags.js';
import { scan0 } from '../scan0.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoBase = path.resolve(__dirname, '..', '..'); // assuming repo root is two levels up

for (const mdFilePath of findMarkdownFiles(__dirname)) {
  const relativePath = path.relative(repoBase, mdFilePath).replace(/\\/g, '/');

  test(relativePath, async t => {
    const parsedTestCases = parseScannedAnnotatedBlocks(fs.readFileSync(mdFilePath, 'utf8'));
    const markdownContentText = parsedTestCases.markdownLines.join('');
    const tokens = parseAndGetTokens(markdownContentText);

    for (const testCase of parsedTestCases.tests) {
      await t.test(parsedTestCases.markdownLines[testCase.lineIndex].trimEnd() + ' ' + testCase.positionalMarkerLine.trimEnd().replace(/\s+/g, '-'), () => {

        let manufacturedPositionalMarkerLine = '';
        markdownContentText.charCodeAt(0);

        let anyAssertionFailed = 0;
        /** @type {number[]} */
        const assertionTokenLineStartPositions = [];
        const assertionTexts = testCase.assertions.map((assertion) => {
          let tokenIndex = tokens.findIndex(tok =>
            testCase.lineStartOffset + assertion.lineCharOffset >= tok.offset &&
            testCase.lineStartOffset + assertion.lineCharOffset < tok.offset + tok.length
          );
          if (tokenIndex < 0) tokenIndex = tokens.length - 1;

          const actualTokenLineCharOffset = tokens[tokenIndex].offset - testCase.lineStartOffset;
          if (assertionTokenLineStartPositions.indexOf(actualTokenLineCharOffset) >= 0) {
            // already have an assertion for this position, skip
            anyAssertionFailed++;
            return '';
          }

          const matchingToken = tokens[tokenIndex];

          while (manufacturedPositionalMarkerLine.length < actualTokenLineCharOffset) {
            manufacturedPositionalMarkerLine += ' ';
          }

          const validMarkerIndex = assertionTokenLineStartPositions.length;
          assertionTokenLineStartPositions.push(actualTokenLineCharOffset);

          const validMarker =
            validMarkerIndex + 1 <= 9 ? (validMarkerIndex + 1).toString() :
              String.fromCharCode(validMarkerIndex + 1 - 10 + 'A'.charCodeAt(0));
          manufacturedPositionalMarkerLine += validMarker;

          let assertionResult = '@' + validMarker + ' ';

          if (assertion.unparseable) {
            assertionResult +=
              tokenKindToString(matchingToken.kind) +
              ' ' +
            JSON.stringify(matchingToken.text) + ' ??';
            anyAssertionFailed++;
            return assertionResult;
          }

          // If assertion needs to be generated from token
          if (assertion.needsGeneration) {
            assertionResult += tokenKindToString(matchingToken.kind);
            if (matchingToken.text) {
              assertionResult += ' ' + JSON.stringify(matchingToken.text);
            }
            anyAssertionFailed++;
            return assertionResult;
          }

          const assertionTextFailed =
            typeof assertion.text === 'string' &&
            assertion.text !== matchingToken.text;

          const assertionKindFailed =
            typeof assertion.tokenKind === 'number' &&
            assertion.tokenKind !== matchingToken.kind;

          const assertionFlagsFailed =
            typeof assertion.tokenFlags === 'number' &&
            (assertion.tokenFlags & matchingToken.flags) !== assertion.tokenFlags;

          if (!assertionTextFailed && !assertionKindFailed && !assertionFlagsFailed) {
            return assertion.assertionSource;
          } else {
            anyAssertionFailed++;
            assertionResult += [
              typeof assertion.tokenKind === 'number' ? tokenKindToString(matchingToken.kind) : '',
              typeof assertion.tokenFlags === 'number' ? tokenFlagsToString(matchingToken.flags) : '',
              typeof assertion.text !== 'string' ? '' : JSON.stringify(matchingToken.text)
            ].filter(Boolean).join(' ');
            return assertionResult;
          }
        });

        if (manufacturedPositionalMarkerLine.trimEnd() === testCase.positionalMarkerLine.trimEnd() &&
          !anyAssertionFailed) {
          assert.ok(true);
          return;
        }

        const leadLines = [
          'at ' + relativePath + ':' + (testCase.rawLineIndex + 1) + '\n'
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

        assert.strictEqual(
          fullActual,
          fullExpected
        );
      });
    }
  });
}

/**
 * @param {string} markdown
 */
function parseAndGetTokens(markdown) {
  const tokens = [];
  let pos = 0;
  /** @type {number[]} */
  let tokenBuf = [];
  while (true) {
    const tokenCount = scan0({
      input: markdown,
      startOffset: pos,
      endOffset: markdown.length,
      output: tokenBuf
    });
    for (let i = 0; i < tokenCount; i++) {
      const token = tokenBuf[i];
      tokens.push({
        offset: pos,
        length: getTokenLength(token),
        kind: getTokenKind(token),
        flags: getTokenFlags(token),
        text: markdown.slice(pos, pos + getTokenLength(token))
      });
      pos += getTokenLength(token);
    }
    if (tokenCount === 0) break;
    tokenBuf.length = 0;
  }
  return tokens;
}

/**
 * Find .md files recursively under a directory.
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function findMarkdownFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...findMarkdownFiles(full));
    } else if (name.isFile() && full.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} annotatedMarkdown
 */
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


    // positional marker starts with 1, and the next line starts with @
    const isPositionalMarkerLine = line.trimStart().startsWith('1') && annotatedMarkdown.charAt(pos) === '@';
    if (!isPositionalMarkerLine) {
      markdownLines.push(line);
      rawLineIndex++;
      continue;
    }

    const testRawLineIndex = rawLineIndex;
    rawLineIndex++;

    /**
     * @type {{
     *  lineCharOffset: number,
     *  marker?: string,
     *  assertionSource?: string,
     *  unparseable?: boolean,
     *  needsGeneration?: boolean,
     *  tokenKind?: number,
     *  tokenFlags?: number,
     *  text?: string
     * }[]}
     */
    const assertions = [];
    line.replace(/\S/g, (m, offset) => {
      assertions.push({
        lineCharOffset: offset
      });
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

      const quoteStart = rest.indexOf('"');
      if (quoteStart >= 0) {
        // Text assertion
        const quoteEnd = rest.lastIndexOf('"');
        if (quoteEnd < 0) {
          assertions[iAssertionLine].unparseable = true;
          continue;
        }

        try {
          const jsonText = JSON.parse(rest.slice(quoteStart, quoteEnd + 1));
          assertions[iAssertionLine].text = jsonText;
        } catch (e) {
          assertions[iAssertionLine].unparseable = true;
          continue;
        }

        rest = rest.slice(0, quoteStart) + rest.slice(quoteEnd + 1);
      }

      // parse assertions
      const ALPHANUMERIC_WITH_PIPE_SEPARATOR_REGEX = /([A-Z0-9]+)(\s*\|\s*([A-Z0-9]+))*/ig;
      const restTrimmed = rest.replace(ALPHANUMERIC_WITH_PIPE_SEPARATOR_REGEX, (assertionChunk, ...args) => {
        const parsedKind = parseTokenKind(assertionChunk);
        if (typeof parsedKind === 'number') {
          assertions[iAssertionLine].tokenKind = parsedKind;
        } else {
          const parsedFlags = parseTokenFlags(assertionChunk);
          if (typeof parsedFlags === 'number') {
            assertions[iAssertionLine].tokenFlags = (assertions[iAssertionLine].tokenFlags || 0) | parsedFlags;
          } else {
            return assertionChunk;
          }
        }
        return ' ';
      });

      if (restTrimmed.trim()) {
        // should not have any remaining 
        assertions[iAssertionLine].unparseable = true;
      }

    }

    // Mark assertions without assertionSource for generation - they represent position markers
    // that don't have corresponding @ lines yet
    for (let i = 0; i < assertions.length; i++) {
      if (!assertions[i].assertionSource) {
        // This position marker doesn't have an assertion, it needs to be generated during test
        assertions[i].needsGeneration = true;
      }
    }

    tests.push({
      markdownLine: markdownLines[markdownLines.length - 1],
      lineStartOffset:
        markdownLines.slice(0, Math.max(0, markdownLines.length - 1)).reduce((a, b) => a + b.length, 0),
      lineIndex: markdownLines.length - 1,
      rawLineIndex: testRawLineIndex, 
      positionalMarkerLine: line,
      assertions
    });
  }

  return { markdownLines, tests };
}


/**
 * Convert TokenKind number to string.
 * @param {import('../scan-core.js').TokenKind | number} kind 
 * @returns {string}
 */
function tokenKindToString(kind) {
  if (kind === undefined) return 'undefined';
  else if (kind === null) return 'null';

  for (const kindName in TOKEN_KIND_VALUES) {
    const v = /** @type {*} */(TOKEN_KIND_VALUES)[kindName];
    if (v === kind) return kindName;
  }

  return '0x' + kind.toString(16).toUpperCase();
}

/**
 * @param {string} encoded
 * @returns {import('../scan-core.js').TokenKind | undefined} -1 if unparseable
 */
function parseTokenKind(encoded) {
  for (const kindName in TOKEN_KIND_VALUES) {
    const kindValue = /** @type {*} */(TOKEN_KIND_VALUES)[kindName];
    if (kindName === encoded) return kindValue;
  }

  const asNumber = Number(encoded);
  if (Number.isFinite(asNumber)) return /** @type {import('../scan-core.js').TokenKind} */(asNumber);

  return undefined;
}

/**
 * Convert TokenFlags number to string.
 * Joining combinations of flags with | and if any unknown remainder left, included as 0x notation too.
 * @param {import('../scan-core.js').TokenFlags | number} kind 
 * @returns {string}
 */
function tokenFlagsToString(kind) {
  let matchFlags = [];
  let remaining = kind;
  for (const flagName in TOKEN_FLAG_VALUES) {
    const flagValue = /** @type {*} */(TOKEN_FLAG_VALUES)[flagName];
    if (!flagValue) {
      if (!kind) return flagName;
      continue;
    }

    if ((kind & flagValue) === flagValue) {
      remaining &= ~flagValue;
      matchFlags.push(flagName);
    }
  }
  if (remaining) matchFlags.push('0x' + remaining.toString(16).toUpperCase());
  return matchFlags.join('|');
}

/**
 * @param {string} encoded
 * @returns {import('../scan-core.js').TokenFlags | undefined} -1 if unparseable
 */
function parseTokenFlags(encoded) {

  const pipeds = encoded.split('|').map(s => s.trim()).filter(Boolean);
  const parseds = pipeds.map(p => {
    const asNumber = Number(p);
    if (Number.isFinite(asNumber)) return asNumber;

    for (const flagName in TOKEN_FLAG_VALUES) {
      const flagValue = /** @type {*} */(TOKEN_FLAG_VALUES)[flagName];
      if (flagName === p) return flagValue;
    }

    return NaN;
  });

  if (!parseds.length) return undefined;

  const combined = parseds.reduce((a, b) => a | b, 0);

  if (Number.isNaN(combined)) return undefined;
  return combined;
}
