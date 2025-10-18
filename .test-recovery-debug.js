import { scan0 } from './parse/scan0.js';
import { getTokenFlags, getTokenKind, getTokenLength } from './parse/scan-core.js';
import * as TOKEN_KIND_VALUES from './parse/scan-tokens.js';
import * as TOKEN_FLAG_VALUES from './parse/scan-token-flags.js';

function tokenKindToString(kind) {
  for (const kindName in TOKEN_KIND_VALUES) {
    if (TOKEN_KIND_VALUES[kindName] === kind) return kindName;
  }
  return '0x' + kind.toString(16).toUpperCase();
}

function tokenFlagsToString(flags) {
  let matchFlags = [];
  let remaining = flags;
  for (const flagName in TOKEN_FLAG_VALUES) {
    const flagValue = TOKEN_FLAG_VALUES[flagName];
    if (!flagValue) {
      if (!flags) return flagName;
      continue;
    }
    if ((flags & flagValue) === flagValue) {
      remaining &= ~flagValue;
      matchFlags.push(flagName);
    }
  }
  if (remaining) matchFlags.push('0x' + remaining.toString(16).toUpperCase());
  return matchFlags.join('|');
}

function testInput(input) {
  console.log('\n=== Testing ===');
  console.log(JSON.stringify(input));
  
  const tokens = [];
  let pos = 0;
  let tokenBuf = [];
  
  while (true) {
    const tokenCount = scan0({
      input: input,
      startOffset: pos,
      endOffset: input.length,
      output: tokenBuf
    });
    
    for (let i = 0; i < tokenCount; i++) {
      const token = tokenBuf[i];
      const length = getTokenLength(token);
      const kind = getTokenKind(token);
      const flags = getTokenFlags(token);
      const text = input.slice(pos, pos + length);
      
      tokens.push({ offset: pos, length, kind, flags, text });
      console.log(`Token: ${tokenKindToString(kind)}${flags ? '|' + tokenFlagsToString(flags) : ''} "${JSON.stringify(text).slice(1, -1)}" (len=${length})`);
      
      pos += length;
    }
    if (tokenCount === 0) break;
    tokenBuf.length = 0;
  }
}

// Test case 1: comment with double newline
testInput('<!-- unclosed comment\n\n');

// Test case 2: comment with single newline + More text
testInput('<!-- unclosed\n\nMore');

// Test case 3: comment with single newline only
testInput('<!-- unclosed\nMore');


// More test cases
console.log('\n\n===== ADDITIONAL TESTS =====');

// Test: comment with < on new line
testInput('<!-- unclosed\n<div>');

// Test: XML PI with newline
testInput('<?xml unclosed\n');

// Test: XML PI with >
testInput('<?xml unclosed >');

// Test: CDATA with double newline
testInput('<![CDATA[ unclosed\n\n');

// Test: CDATA with <
testInput('<![CDATA[ unclosed\n<');

// Test: CDATA with >
testInput('<![CDATA[ unclosed >');

// Test: DOCTYPE with newline
testInput('<!DOCTYPE unclosed\n');

// Test: DOCTYPE with <
testInput('<!DOCTYPE unclosed\n<');

// Test: Opening tag with double newline
testInput('<div attr="value"\n\n');

// Test: Opening tag with <
testInput('<div attr="value"\n<');

// Test: Quoted attr with double newline
testInput('<div attr="unclosed\n\n');

// Test: Quoted attr with <
testInput('<div attr="unclosed\n<');

// Test: Quoted attr with >
testInput('<div attr="unclosed\n>');


console.log('\n\n===== RAW TEXT TESTS =====');

// Test: script with double newline
testInput('<script>\nunclosed\n\n');

// Test: style with <
testInput('<style>\nunclosed\n<');

// Test: textarea properly closed
testInput('<textarea>text</textarea>');

// Test: script properly closed
testInput('<script>code</script>');

