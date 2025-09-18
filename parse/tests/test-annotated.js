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
  const raw = fs.readFileSync(md, 'utf8');
  const blocks = parseAnnotatedBlocks(raw);
  
  for (const blk of blocks) {
    // Test name: use the last content line
    const contentLine = blk.content[blk.content.length - 1] || '';
    const niceName = `${contentLine} ${blk.markerLine.replace(/\s+/g, '-')}`.trim();
    
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

      // For each position marker in the marker line, find the corresponding assertion
      const positionMarkerChars = [];
      for (let col = 0; col < blk.markerLine.length; col++) {
        const ch = blk.markerLine.charAt(col);
        if (/\s/.test(ch)) continue;
        positionMarkerChars.push({ char: ch, offset: col });
      }

      // For each position marker, find the token at that position and verify assertions
      for (const marker of positionMarkerChars) {
        const expected = expectMap.get(marker.char);
        if (!expected) continue;

        // Find the token that covers this position in the content
        // The marker.offset is relative to the marker line, but we need it relative to the last content line
        const lastContentLine = blk.content[blk.content.length - 1];
        if (marker.offset >= lastContentLine.length) continue; // marker beyond content

        // Find token at this absolute position in the input
        const token = tokens.find(t => {
          // For multi-line content, we need to map the marker position correctly
          let absolutePos = marker.offset;
          if (blk.content.length > 1) {
            // Add lengths of all previous lines plus newlines
            for (let i = 0; i < blk.content.length - 1; i++) {
              absolutePos += blk.content[i].length + 1; // +1 for newline
            }
          }
          return absolutePos >= t.start && absolutePos < t.end;
        });
        
        if (!token) {
          throw new Error(`No token found at position ${marker.offset} for marker ${marker.char}`);
        }

        // FIX 5: Check both token type and text content expectations
        const { tokenType: expectedTokenType, expectedText } = expected;
        
        // Check token type if specified
        if (expectedTokenType) {
          let expectedTokenKind = -1;
          for (const [name, value] of Object.entries(PARSE_TOKENS)) {
            if (name === expectedTokenType) {
              expectedTokenKind = value;
              break;
            }
          }

          if (expectedTokenKind >= 0) {
            const hasExpectedKind = (token.flags & expectedTokenKind) === expectedTokenKind;
            if (!hasExpectedKind) {
              // Find actual token kind name
              let actualKindName = 'Unknown';
              for (const [name, value] of Object.entries(PARSE_TOKENS)) {
                if ((token.flags & value) === value) {
                  actualKindName = name;
                  break;
                }
              }
              throw new Error(`Token at position ${marker.offset} (marker ${marker.char}): expected token type ${expectedTokenType}, got ${actualKindName} (flags: 0x${token.flags.toString(16)})`);
            }
          }
        }
        
        // Check token text if specified
        if (expectedText !== null) {
          const actualText = input.slice(token.start, token.end);
          if (actualText !== expectedText) {
            throw new Error(`Token at position ${marker.offset} (marker ${marker.char}): expected text ${JSON.stringify(expectedText)}, got ${JSON.stringify(actualText)}`);
          }
        }
      }
    });
  }
}
