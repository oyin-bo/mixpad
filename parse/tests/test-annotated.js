// @ts-check
/// <reference types="node" />

import fs from 'fs';
import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { getTokenKind, getTokenLength } from '../scan-core.js';
import * as PARSE_TOKENS from '../scan-tokens.js';
import { scan0 } from '../scan0.js';

// __dirname replacement for ESM, to find annotated Markdown test files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Parse an annotated markdown file and yield blocks with: contentLines, markerLine, assertions
 * A block is: one or more content lines, then a marker line (starts with optional space and a digit '1'),
 * followed by one or more lines starting with '@'.
 * We'll accept markers with digits/letters and assertions like `@1 InlineText` or `@1 "text"`.
 * @param {string} text
 * @param {string} testPath
 */
function parseAnnotatedBlocks(text, testPath) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    // find a candidate marker line by looking ahead for a line that contains only
    // spaces and marker characters (digits/letters) and at least one alphanumeric char.
    // This lets us support multiple markers like: "1    2"
    const markerIdx = lines.slice(i).findIndex(l => /^[ \t0-9A-Za-z]+$/.test(l) && /[0-9A-Za-z]/.test(l));
    if (markerIdx === -1) break;
    const markerLineIndex = i + markerIdx;
    // now collect content lines immediately above the marker line: at least one
    // backtrack to include preceding non-empty lines until an empty line or start or another marker separator
    let contentStart = markerLineIndex - 1;
    if (contentStart < 0) { i = markerLineIndex + 1; continue; }
    const contentLines = [];
    // collect lines above until enough or start of file
    while (contentStart >= 0 && contentLines.join('\n').length < 70) {
      contentLines.unshift(lines[contentStart]);
      contentStart--;
    }
    contentLines.unshift('at ' + testPath + ':' + (markerLineIndex + 1));

    // collect assertions lines starting at markerLineIndex+1 while they start with @
    const assertions = [];
    let j = markerLineIndex + 1;
    while (j < lines.length && lines[j].startsWith('@')) {
      assertions.push(lines[j]);
      j++;
    }

    // capture two lines of post-context immediately after the assertion block
    const after = [];
    for (let k = 0; k < 2; k++) {
      const idx = j + k;
      after.push(idx < lines.length ? lines[idx] : '');
    }

    if (contentLines.length && assertions.length) {
      blocks.push({
        startLine: contentStart + 2,
        content: contentLines,
        markerLine: lines[markerLineIndex],
        assertions,
        after
      });
    }

    i = j + 0;
  }
  return blocks;
}

/**
 * Convert provisional token (number) to { length, flags }
 * As documented in scan0: lower 24 bits length, upper bits flags.
 * @param {number} tok
 */
function decodeProvisionalToken(tok) {
  const length = getTokenLength(tok);
  // Keep flags in the same high-bit format as PARSE_TOKENS (no right-shift).
  // PARSE_TOKENS values live in the high bits (e.g. 0x1000000). Use getTokenKind
  // so we centralize the masking of the high bits.
  const flags = getTokenKind(tok);
  return { length, flags };
}

/**
 * Parse an assertion line to extract token type and text expectations.
 * Supports formats like:
 * - "@1 InlineText" (token type only)
 * - "@1 InlineText \"some text\"" (token type + text)
 * - "@1 \"some text\"" (text only)
 * @param {string} assertionLine
 * @returns {{tokenType: string|null, expectedText: string|null}}
 */
function parseAssertionLine(assertionLine) {
  const trimmed = assertionLine.trim();
  if (!trimmed.startsWith('@')) return { tokenType: null, expectedText: null };

  // Remove @ and label: "@1 InlineText \"text\"" -> "InlineText \"text\""
  const afterLabel = trimmed.replace(/^@\S+\s*/, '');
  if (!afterLabel) return { tokenType: null, expectedText: null };

  let tokenType = null;
  let expectedText = null;
  let pos = 0;

  // Check if line starts with a quoted string
  if (afterLabel[pos] === '"') {
    // Parse JSON string for text assertion
    let endQuote = pos + 1;
    while (endQuote < afterLabel.length) {
      if (afterLabel[endQuote] === '"') {
        // Check if quote is escaped by counting preceding backslashes
        let backslashCount = 0;
        let k = endQuote - 1;
        while (k >= pos && afterLabel[k] === '\\') {
          backslashCount++;
          k--;
        }
        if (backslashCount % 2 === 0) break; // Even number = not escaped
      }
      endQuote++;
    }

    if (endQuote < afterLabel.length) {
      try {
        expectedText = JSON.parse(afterLabel.slice(pos, endQuote + 1));
        pos = endQuote + 1;
      } catch {
        // Invalid JSON, ignore
      }
    }
  } else {
    // Parse token type (first word)
    const spaceIdx = afterLabel.indexOf(' ', pos);
    const tokenEnd = spaceIdx >= 0 ? spaceIdx : afterLabel.length;
    tokenType = afterLabel.slice(pos, tokenEnd);
    pos = tokenEnd;

    // Check for text assertion after token type
    while (pos < afterLabel.length && /\s/.test(afterLabel[pos])) pos++;
    if (pos < afterLabel.length && afterLabel[pos] === '"') {
      let endQuote = pos + 1;
      while (endQuote < afterLabel.length) {
        if (afterLabel[endQuote] === '"') {
          let backslashCount = 0;
          let k = endQuote - 1;
          while (k >= pos && afterLabel[k] === '\\') {
            backslashCount++;
            k--;
          }
          if (backslashCount % 2 === 0) break;
        }
        endQuote++;
      }

      if (endQuote < afterLabel.length) {
        try {
          expectedText = JSON.parse(afterLabel.slice(pos, endQuote + 1));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }

  return { tokenType, expectedText };
}

/**
 * Extract expected flags from assertion lines for a particular marker number.
 * For scan0 tests we expect assertions like `@1 InlineText` or `@1 InlineText "text"`.
 * @param {string} markerLine
 * @param {string[]} assertions
 */
function mapAssertions(markerLine, assertions) {
  const map = new Map();
  for (const a of assertions) {
    const m = a.match(/^@(\S+)/);
    if (!m) continue;
    const id = m[1];
    const parsed = parseAssertionLine(a);
    map.set(id, parsed);
  }
  return map;
}



// Main: find markdown files under tests directory relative to this file
const testsDir = __dirname; // parse/tests
const mdFiles = findMarkdownFiles(testsDir);

for (const md of mdFiles) {
  const repoBase = path.resolve(__dirname, '..', '..'); // assuming repo root is two levels up
  const repoRelative = path.relative(repoBase, md).replace(/\\/g, '/');

  const raw = fs.readFileSync(md, 'utf8');
  const blocks = parseAnnotatedBlocks(raw, repoRelative);

  for (const blk of blocks) {
    // Test name: use the last content line
    const contentLine = blk.content[blk.content.length - 1] || '';

    const lineNumber = blk.startLine;

    const niceName =
      `${contentLine} ${blk.markerLine.replace(/\s+/g, '-')}`.trim() + ' ' +
      repoRelative + ':' + lineNumber;

    test(niceName, () => {
      // FIX 1: construct clean input from ALL content lines joined with newlines (not just one line)
      const input = blk.content.join('\n');

      // FIX 2: run scan0 in a loop until the WHOLE input is exhausted
      /** @type {number[]} */
      const output = [];
      let currentOffset = 0;
      while (currentOffset < input.length) {
        const tokenCount = scan0({
          input,
          startOffset: currentOffset,
          endOffset: input.length,
          output
        });

        // FIX 4: Use the scan0 return value - advance offset by the length of produced tokens
        if (tokenCount === 0) {
          // Avoid infinite loop if no tokens were produced
          break;
        }

        // Calculate how much input was consumed by summing token lengths
        let consumedLength = 0;
        const outputStart = output.length - tokenCount;
        for (let i = outputStart; i < output.length; i++) {
          consumedLength += getTokenLength(output[i]);
        }
        currentOffset += consumedLength;
      }

      // FIX 3: decode tokens and USE the scan results properly
      const tokens = [];
      {
        let acc = 0;
        for (let ti = 0; ti < output.length; ti++) {
          const raw = output[ti];
          const { length, flags } = decodeProvisionalToken(raw);
          tokens.push({ start: acc, end: acc + length, flags, raw });
          acc += length;
        }
      }

      // map assertions by id
      const expectMap = mapAssertions(blk.markerLine, blk.assertions);

      // Build proper assertions following the original format with strictEqual reporting
      // This is the foundation cornerstone of the parser testing system

      // Build mapping of marker id -> absolute character index in the input string
      const contentJoin = blk.content.join('\n');
      // Compute offset of the last content line start in the joined content
      let lastLineOffset = 0;
      if (blk.content.length > 1) {
        for (let k = 0; k < blk.content.length - 1; k++) lastLineOffset += blk.content[k].length + 1; // +1 for newline
      }

      // Build arrays of marker chars and their column offsets (left-to-right)
      /** @type {string[]} */
      const positionMarkerChars = [];
      /** @type {number[]} */
      const positionMarkerLineOffsets = [];
      for (let col = 0; col < blk.markerLine.length; col++) {
        const ch = blk.markerLine.charAt(col);
        if (/\s/.test(ch)) continue;
        positionMarkerChars.push(ch);
        positionMarkerLineOffsets.push(col);
      }

      // Build an explicit array of marker slots based on the position marker line
      const positionMarkerSlots = positionMarkerChars.map((ch, idx) => ({
        label: ch,
        lineOffset: positionMarkerLineOffsets[idx],
        token: -1,
        text: null,
        flags: -1,
        assertionText: /** @type {string|null} */ (null),
        expectedName: /** @type {string|null} */ (null)
      }));

      // Attach parsed @ lines to the corresponding slots (case-insensitive match)
      for (const a of blk.assertions) {
        const m = a.match(/^@(\S+)\s*(.*)$/);
        if (!m) continue;
        const label = m[1];
        const rest = m[2].trim();
        const targetIdx = positionMarkerChars.findIndex(c => c.toUpperCase() === label.toUpperCase());
        if (targetIdx >= 0) {
          positionMarkerSlots[targetIdx].assertionText = a;
          if (rest) positionMarkerSlots[targetIdx].expectedName = rest.split(/\s+/)[0];
        }
      }

      // Map slots to token starts and detect mismatches
      const tokenStartToAssertionIndex = new Map();
      const missingSlots = [];
      let mismatchDetected = false;

      for (let si = 0; si < positionMarkerSlots.length; si++) {
        const slot = positionMarkerSlots[si];
        const absPos = lastLineOffset + slot.lineOffset;
        const covering = tokens.find(t => absPos >= t.start && absPos < t.end);
        if (!covering) {
          missingSlots.push({ slotIndex: si, absPos });
          mismatchDetected = true;
          continue;
        }
        slot.token = covering.start;
        if (covering.start !== absPos) mismatchDetected = true;
        if (!tokenStartToAssertionIndex.has(covering.start)) tokenStartToAssertionIndex.set(covering.start, si);
      }

      // Canonical ordering of token starts for this line
      const orderedTokenStarts = Array.from(tokenStartToAssertionIndex.keys()).sort((a, b) => a - b);

      // Build canonical report lines: content, canonical position line and canonical @ lines
      const actualReportLines = [];
      const expectedLines = [];

      // If we detected a mismatch, show the first two markdown lines as header
      if (mismatchDetected || missingSlots.length) {
        let headerLines = blk.content.slice(0, 2);
        if (headerLines.length === 0) headerLines = ['', ''];
        else if (headerLines.length === 1) headerLines = ['', headerLines[0]];

        // Expected uses the header as-is
        expectedLines.push(...headerLines);
        // Actual uses the header 
        actualReportLines.push(...headerLines);
      } else {
        for (const l of blk.content) {
          actualReportLines.push(l);
          expectedLines.push(l);
        }
      }

      let positionLine = '';
      const assertionReportLines = [];

      for (let emitted = 0; emitted < orderedTokenStarts.length; emitted++) {
        const tokenStart = orderedTokenStarts[emitted];
        const slotIndex = tokenStartToAssertionIndex.get(tokenStart);
        const slot = positionMarkerSlots[slotIndex];
        const label = slot && slot.label;
        const expectedName = slot && slot.expectedName;

        // Canonical marker char
        const positionMarker = (emitted + 1) < 10 ? String(emitted + 1) :
          String.fromCharCode('A'.charCodeAt(0) + emitted - 9);

        const positionMarkerOffset = tokenStart - lastLineOffset;
        while (positionLine.length < positionMarkerOffset) positionLine += ' ';
        positionLine += positionMarker;

        // Find token by start index
        const token = tokens.find(t => t.start === tokenStart);
        const raw = token ? token.raw : undefined;
        const decoded = raw == null ? { length: 0, flags: 0 } : decodeProvisionalToken(raw);
        let flagsNum = decoded.flags;
        if (flagsNum === 0 && typeof raw === 'number') {
          const kind = getTokenKind(raw);
          for (const v of Object.values(PARSE_TOKENS)) if ((kind & v) === v) flagsNum |= v;
        }

        // Determine best name(s) for this token flags mask
        let names = [];
        const exact = Object.entries(PARSE_TOKENS).find(([, v]) => v === flagsNum);
        if (exact) names = [exact[0]];
        else names = Object.entries(PARSE_TOKENS).filter(([, v]) => (flagsNum & v) === v).map(([k]) => k);

        // If the original assertion had no constraints for this slot, synthesize a token-only assertion
        if (!expectedName) {
          assertionReportLines.push('@' + positionMarker + ' ' + (names.join('|') || flagsNum));
        } else {
          // Try to find the expected flag value and check it
          let expectedFlagValue;
          for (const [k, v] of Object.entries(PARSE_TOKENS)) if (k === expectedName) { expectedFlagValue = v; break; }
          const has = expectedFlagValue ? ((flagsNum & expectedFlagValue) === expectedFlagValue) : false;
          if (has) {
            // Preserve the original @-line but rewrite its label to the canonical one
            const orig = slot && slot.assertionText;
            if (orig && typeof orig === 'string') assertionReportLines.push(orig.replace(/^@[A-Za-z0-9]+/, '@' + positionMarker));
            else assertionReportLines.push('@' + positionMarker + ' ' + expectedName);
          } else {
            // Emit a diagnostic canonical assertion showing actual token info
            assertionReportLines.push('@' + positionMarker + ' ' + (names.join('|') || flagsNum));
            mismatchDetected = true;
          }
        }
      }

      // Pad positionLine to original marker line length so diffs show stable spacing
      while (positionLine.length < blk.markerLine.length) positionLine += ' ';
      actualReportLines.push(positionLine);
      for (const ln of assertionReportLines) actualReportLines.push(ln);

      // If mismatchDetected, append two post-context lines
      if (mismatchDetected || missingSlots.length) {
        if (Array.isArray(blk.after)) {
          for (const ln of blk.after) {
            actualReportLines.push(ln);
          }
        }
      }

      const actualReport = actualReportLines.join('\n');

      // Finish building expected block text: append marker and assertion lines
      expectedLines.push(blk.markerLine);
      for (const a of blk.assertions) expectedLines.push(a);
      // If mismatchDetected, append the same two post-context lines
      if (mismatchDetected || missingSlots.length) {
        if (Array.isArray(blk.after)) {
          for (const ln of blk.after) expectedLines.push(ln);
        }
      }
      const expected = expectedLines.join('\n');

      // This is the foundation cornerstone of the parser testing system
      if (mismatchDetected || missingSlots.length) {
        assert.strictEqual(actualReport, expected);
      }
    });
  }
}
