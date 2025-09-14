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
 */
function parseAnnotatedBlocks(text) {
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
    // collect lines above until blank line or start of file
    while (contentStart >= 0 && lines[contentStart].trim() !== '') {
      contentLines.unshift(lines[contentStart]);
      contentStart--;
    }

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
 * Extract expected flags from assertion lines for a particular marker number.
 * For scan0 tests we expect assertions like `@1 InlineText` where the token kind is given.
 * We'll return an array of expected flag names in order of markers found on the marker line.
 * @param {string} markerLine
 * @param {string[]} assertions
 */
function mapAssertions(markerLine, assertions) {
  // markerLine contains positions marked by digits/letters at the columns corresponding to characters above.
  // For our simple harness, we assume a single marker per test (common in examples). We'll parse all @ lines and
  // build a map position->assertion (like '@1 InlineText').
  const map = new Map();
  for (const a of assertions) {
    // remove leading @ and split
    const m = a.match(/^@(\S+)\s+(.*)$/);
    if (!m) continue;
    const id = m[1];
    const value = m[2].trim();
    map.set(id, value);
  }
  return map;
}


// Main: find markdown files under tests directory relative to this file
const testsDir = __dirname; // parse/tests
const mdFiles = findMarkdownFiles(testsDir);

for (const md of mdFiles) {
  const raw = fs.readFileSync(md, 'utf8');
  const blocks = parseAnnotatedBlocks(raw);
  for (const blk of blocks) {
    // Test name: `{line-text-content} {positional-marker-line}` (use the last content line)
    const contentLine = blk.content[blk.content.length - 1] || '';
    const niceName = `${contentLine} ${blk.markerLine.replace(/\s+/g, '-')}`.trim();
    test(niceName, () => {
      // construct clean input (content lines joined with newlines)
      const input = blk.content.join('\n');
      // run scan0 across the whole input
      /** @type {number[]} */
      const output = [];
      scan0({ input, startOffset: 0, endOffset: input.length, output });

      // decode tokens and compare to assertions
      // map assertions by id
      const expectMap = mapAssertions(blk.markerLine, blk.assertions);

      // For simplicity support single assertion @1 per block describing the first token's flag name
      if (expectMap.size === 0) throw new Error('No @ assertions parsed');

      // Build mapping of marker id -> absolute character index in the input string
      // markerLine contains spaces and digits at columns aligned with the content above.
      const contentJoin = blk.content.join('\n');
      // compute offset of the last content line start in the joined content
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

      // Helper: map a marker label to its column offset (case-insensitive match)
      /**
       * @param {string} label
       */
      function findMarkerOffsetByLabel(label) {
        const up = label.toUpperCase();
        for (let k = 0; k < positionMarkerChars.length; k++) {
          if (positionMarkerChars[k].toUpperCase() === up) return positionMarkerLineOffsets[k];
        }
        return undefined;
      }

      // Build a token list from the provisional output (start/end/flags)
      const tokens = [];
      {
        let acc = 0;
        for (let ti = 0; ti < output.length; ti++) {
          const raw = output[ti];
          const { length, flags } = typeof raw === 'number' ? decodeProvisionalToken(raw) : { length: 0, flags: 0 };
          tokens.push({ start: acc, end: acc + length, flags, raw });
          acc += length;
        }
      }

      // Build an explicit array of marker slots based on the position marker line.
      // Each non-space char on the marker line is a slot; @-assertion lines may
      // attach to a slot by label. Slots without assertions will get a synthesized
      // token-only assertion later.
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

      // Map slots to token starts. Keep track of missing mappings and positional mismatches
      // (markers that don't point at token starts). Deduplicate multiple slots that map to
      // the same token start by keeping the first (canonicalization).
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

      // Debug logging removed; proceed to canonicalize and compare only on mismatch.
      // (orderedTokenStarts already computed above)

      // Build canonical report lines: content, canonical position line and canonical @ lines.
      const actualReportLines = [];
      const expectedLines = [];

      // If we detected a mismatch, the spec requires we show the first two markdown
      // lines as the header in both actual and expected outputs. If the block only
      // has one content line, insert an empty line above it so we still have two
      // header lines.
      // output to indicate it's the real run.
      if (mismatchDetected || missingSlots.length) {
        let headerLines = blk.content.slice(0, 2);
        if (headerLines.length === 0) headerLines = ['', ''];
        else if (headerLines.length === 1) headerLines = ['', headerLines[0]];

        // Expected uses the header as-is
        expectedLines.push(...headerLines);

        // Actual uses the header with the suffix on the second line
        const actualHeader = [headerLines[0], headerLines[1]];
        actualReportLines.push(...actualHeader);
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

        // canonical marker char
        const positionMarker = (emitted + 1) < 10 ? String(emitted + 1) :
          String.fromCharCode('A'.charCodeAt(0) + emitted - 9);

        const positionMarkerOffset = tokenStart - lastLineOffset;
        while (positionLine.length < positionMarkerOffset) positionLine += ' ';
        positionLine += positionMarker;

        // find token by start index
        const token = tokens.find(t => t.start === tokenStart);
        const raw = token ? token.raw : undefined;
        const decoded = raw == null ? { length: 0, flags: 0 } : decodeProvisionalToken(raw);
        let flagsNum = decoded.flags;
        if (flagsNum === 0 && typeof raw === 'number') {
          // Use getTokenKind to extract the high-bit flags and compare against named tokens.
          const kind = getTokenKind(raw);
          for (const v of Object.values(PARSE_TOKENS)) if ((kind & v) === v) flagsNum |= v;
        }

        // Determine best name(s) for this token flags mask
        let names = [];
        const exact = Object.entries(PARSE_TOKENS).find(([, v]) => v === flagsNum);
        if (exact) names = [exact[0]];
        else names = Object.entries(PARSE_TOKENS).filter(([, v]) => (flagsNum & v) === v).map(([k]) => k);

        // If the original assertion had no constraints for this slot, synthesize a token-only assertion.
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
            if (typeof orig === 'string') assertionReportLines.push(orig.replace(/^@[A-Za-z0-9]+/, '@' + positionMarker));
            else assertionReportLines.push('@' + positionMarker + ' ' + expectedName);
          } else {
            // Emit a diagnostic canonical assertion showing actual token info
            assertionReportLines.push('@' + positionMarker + ' ' + (names.join('|') || flagsNum));
            mismatchDetected = true;
          }
        }
      }

      // pad positionLine to original marker line length so diffs show stable spacing
      while (positionLine.length < blk.markerLine.length) positionLine += ' ';
      actualReportLines.push(positionLine);
      for (const ln of assertionReportLines) actualReportLines.push(ln);

      // If mismatchDetected, append two post-context lines (captured earlier)
      if (mismatchDetected || missingSlots.length) {
        if (Array.isArray(blk.after)) {
          for (const ln of blk.after) {
            actualReportLines.push(ln);
          }
        }
      }

      const actualReport = actualReportLines.join('\n');

      // Finish building expected block text: append marker and assertion lines.
      expectedLines.push(blk.markerLine);
      for (const a of blk.assertions) expectedLines.push(a);
      // If mismatchDetected, append the same two post-context lines so both sides
      // of the diff include extra context.
      if (mismatchDetected || missingSlots.length) {
        if (Array.isArray(blk.after)) {
          for (const ln of blk.after) expectedLines.push(ln);
        }
      }
      const expected = expectedLines.join('\n');

      // Only fall back to a strict string comparison when we detected any mismatch
      // (positional or assertion value) or when some markers couldn't be mapped.
      const repoRelative = path.relative(process.cwd(), md).replace(/\\/g, '/');
      const lineNumber = blk.startLine;
      if (mismatchDetected || missingSlots.length) {
        assert.strictEqual(actualReport, expected, repoRelative + ':' + lineNumber);
      }
    });
  }
}

