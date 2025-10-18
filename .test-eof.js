import { scan0 } from './parse/scan0.js';
import { getTokenFlags, getTokenKind, getTokenLength } from './parse/scan-core.js';
import * as TOKEN_KIND_VALUES from './parse/scan-tokens.js';

function tokenKindToString(kind) {
  for (const kindName in TOKEN_KIND_VALUES) {
    if (TOKEN_KIND_VALUES[kindName] === kind) return kindName;
  }
  return '0x' + kind.toString(16).toUpperCase();
}

function testInput(input) {
  console.log('\n=== Input ===');
  console.log(JSON.stringify(input));
  console.log('=== Tokens ===');
  
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
      const text = input.slice(pos, pos + length);
      
      console.log(`${tokenKindToString(kind)} "${JSON.stringify(text).slice(1, -1)}"`);
      pos += length;
    }
    if (tokenCount === 0) break;
    tokenBuf.length = 0;
  }
}

// This is what the test parser sees after EOF splitting
testInput('<!-- unclosed comment\n\n');

