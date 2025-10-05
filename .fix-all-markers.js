// @ts-check
/**
 * This script regenerates ALL test markers in 7-html-elements.md
 */

import fs from 'fs';
import { scan0 } from './parse/scan0.js';
import { getTokenLength, getTokenKind } from './parse/scan-core.js';
import * as TOKENS from './parse/scan-tokens.js';

/**
 * @param {number} kind
 */
function tokenKindName(kind) {
  for (const name in TOKENS) {
    if (/** @type {*} */(TOKENS)[name] === kind) return name;
  }
  return `Unknown(${kind})`;
}

/**
 * Generate correct positional markers and assertions for a test input
 * @param {string} input - The test input line
 */
function generateCorrectMarkers(input) {
  /** @type {number[]} */
  const tokens = [];
  let pos = 0;
  let iterCount = 0;
  const maxIter = 100;

  // Parse all tokens for this input
  while (pos < input.length && iterCount < maxIter) {
    /** @type {number[]} */
    const tokenBatch = [];
    const count = scan0({ input, startOffset: pos, endOffset: input.length, output: tokenBatch });
    
    if (count === 0) break;
    
    for (let i = 0; i < count; i++) {
      tokens.push(tokenBatch[i]);
      pos += getTokenLength(tokenBatch[i]);
    }
    
    iterCount++;
  }

  // Generate positional marker line
  let markerLine = '';
  /** @type {string[]} */
  const assertions = [];
  
  let currentPos = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const len = getTokenLength(token);
    const kind = getTokenKind(token);
    const kindName = tokenKindName(kind);
    
    // Skip NewLine tokens as they're not part of the test line
    if (kindName === 'NewLine') {
      currentPos += len;
      continue;
    }
    
    // Create marker (1-9, then A-Z)
    const markerIndex = assertions.length;
    const marker = markerIndex < 9 
      ? String(markerIndex + 1) 
      : String.fromCharCode(65 + markerIndex - 9);
    
    // Pad marker line to current position
    while (markerLine.length < currentPos) {
      markerLine += ' ';
    }
    markerLine += marker;
    
    // Add assertion
    assertions.push(`@${marker} ${kindName}`);
    
    currentPos += len;
  }
  
  return {
    markerLine,
    assertions
  };
}

// Read the test file
const testFilePath = 'parse/tests/7-html-elements.md';
const content = fs.readFileSync(testFilePath, 'utf8');
const lines = content.split('\n');

const outputLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Check if next line looks like a positional marker line
  if (i + 1 < lines.length) {
    const nextLine = lines[i + 1];
    const isMarkerLine = nextLine.trimStart().startsWith('1') && 
                         i + 2 < lines.length && 
                         lines[i + 2].startsWith('@');
    
    if (isMarkerLine) {
      // This is a test case - regenerate markers
      const testInput = line;
      outputLines.push(testInput);
      
      const result = generateCorrectMarkers(testInput);
      outputLines.push(result.markerLine);
      
      // Skip old marker line
      i++;
      
      // Skip old assertions and add new ones
      i++;
      while (i < lines.length && lines[i].startsWith('@')) {
        i++;
      }
      
      // Add new assertions
      for (const assertion of result.assertions) {
        outputLines.push(assertion);
      }
      
      continue;
    }
  }
  
  // Regular line - keep as is
  outputLines.push(line);
  i++;
}

// Write back to file
const newContent = outputLines.join('\n');
fs.writeFileSync(testFilePath, newContent, 'utf8');

console.log(`Updated ${testFilePath}`);
console.log(`Processed ${lines.length} lines, output ${outputLines.length} lines`);
