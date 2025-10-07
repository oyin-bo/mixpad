// Verification that EOF error recovery is working correctly
import { scan0 } from './parse/scan0.js';
import { getTokenLength, getTokenKind, getTokenFlags } from './parse/scan-core.js';
import * as TOKENS from './parse/scan-tokens.js';
import * as FLAGS from './parse/scan-token-flags.js';

function tokenKindName(kind) {
  for (const [name, value] of Object.entries(TOKENS)) {
    if (value === kind) return name;
  }
  return `Unknown(${kind})`;
}

function hasErrorFlag(flags) {
  return (flags & FLAGS.ErrorUnbalancedTokenFallback) !== 0;
}

function scanAndCheck(input, shouldHaveError, description) {
  const output = [];
  let pos = 0;

  while (pos < input.length) {
    const tokenBatch = [];
    const count = scan0({ input, startOffset: pos, endOffset: input.length, output: tokenBatch });
    if (count === 0) break;
    
    for (let i = 0; i < count; i++) {
      output.push(tokenBatch[i]);
      pos += getTokenLength(tokenBatch[i]);
    }
  }

  const hasError = output.some(t => hasErrorFlag(getTokenFlags(t)));
  const status = (hasError === shouldHaveError) ? '✓' : '✗';
  console.log(`${status} ${description}`);
  console.log(`   Input: ${JSON.stringify(input)}`);
  console.log(`   Expected error: ${shouldHaveError}, Got error: ${hasError}`);
  
  if (hasError !== shouldHaveError) {
    console.log('   Tokens:');
    let p = 0;
    output.forEach((t, i) => {
      const len = getTokenLength(t);
      const kind = tokenKindName(getTokenKind(t));
      const flags = getTokenFlags(t);
      const text = input.substring(p, p + len);
      console.log(`     ${i+1}. ${JSON.stringify(text)} -> ${kind}${hasErrorFlag(flags) ? ' [ERROR]' : ''}`);
      p += len;
    });
  }
}

console.log('Verifying EOF error recovery behavior:\n');

// Valid multi-line constructs (NO errors)
scanAndCheck('<?xml version="1.0"\n?>', false, 'XML PI spanning multiple lines (valid)');
scanAndCheck('<!-- Line 1\nLine 2 -->', false, 'Comment spanning multiple lines (valid)');
scanAndCheck('<div\n  class="note">', false, 'Tag spanning multiple lines (valid)');
scanAndCheck('<![CDATA[line 1\nline 2]]>', false, 'CDATA spanning multiple lines (valid)');

console.log('');

// Truly unclosed at EOF (ERRORS expected)
scanAndCheck('<?xml version="1.0"', true, 'XML PI unclosed at EOF');
scanAndCheck('<!-- unclosed', true, 'Comment unclosed at EOF');
scanAndCheck('<![CDATA[unclosed', true, 'CDATA unclosed at EOF');
scanAndCheck('<!DOCTYPE html', true, 'DOCTYPE unclosed at EOF');

console.log('\nAll checks completed.');
