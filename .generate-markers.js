// @ts-check
/**
 * This script generates correct positional markers for a test case
 * based on actual scanner output.
 */

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
    
    // Don't add marker if it would overlap with existing marker
    if (markerLine.length === currentPos) {
      markerLine += marker;
    }
    
    // Add assertion
    assertions.push(`@${marker} ${kindName}`);
    
    currentPos += len;
  }
  
  return {
    markerLine,
    assertions
  };
}

// Test with the failing case
const testInput = '<input type="text" name="field" disabled>';
console.log('Input:');
console.log(testInput);
console.log('\nGenerated markers:');
const result = generateCorrectMarkers(testInput);
console.log(result.markerLine);
console.log(result.assertions.join('\n'));
