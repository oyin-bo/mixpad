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

// Edge cases
testInput('<br/>');
testInput('<div>content</div>');
testInput('<div a="1" b="2" c');
testInput('</div\n>');

