import { scan0 } from './parse/scan0.js';
import { getTokenFlags, getTokenKind, getTokenLength } from './parse/scan-core.js';
import * as TOKEN_KIND_VALUES from './parse/scan-tokens.js';
import * as TOKEN_FLAG_VALUES from './parse/scan-token-flags.js';

function tokenKindToString(kind) {
  for (const kindName in TOKEN_KIND_VALUES) {
    if (TOKEN_KIND_VALUES[kindName] === kind) return kindName;
  }
  return '0x' + kind.toString(16);
}

function tokenFlagsToString(flags) {
  let result = [];
  for (const flagName in TOKEN_FLAG_VALUES) {
    const flagValue = TOKEN_FLAG_VALUES[flagName];
    if (flagValue && (flags & flagValue)) result.push(flagName);
  }
  return result.join('|') || 'none';
}

// Simulate what the test scanner would see
const input = "Double newline recovery\n<!-- unclosed comment\n\n";

console.log('Input:', JSON.stringify(input));
console.log('\nTokens:');

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
    
    console.log(`  ${tokenKindToString(kind)}${flags ? '|' + tokenFlagsToString(flags) : ''} ${JSON.stringify(text)}`);
    pos += length;
  }
  if (tokenCount === 0) break;
  tokenBuf.length = 0;
}

