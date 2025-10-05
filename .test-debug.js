// @ts-check
import { scan0 } from './parse/scan0.js';
import { getTokenLength, getTokenKind } from './parse/scan-core.js';
import * as TOKENS from './parse/scan-tokens.js';

function tokenKindName(kind) {
  for (const name in TOKENS) {
    if (TOKENS[name] === kind) return name;
  }
  return `Unknown(${kind})`;
}

const input = '<input type="text" name="field" disabled>';

const tokens = [];
let pos = 0;
let iterCount = 0;
const maxIter = 20;

console.log('Input:', JSON.stringify(input));

while (pos < input.length && iterCount < maxIter) {
  const tokenBatch = [];
  const count = scan0({ input, startOffset: pos, endOffset: input.length, output: tokenBatch });
  
  console.log(`\nIteration ${iterCount}, pos=${pos}, count=${count}`);
  
  if (count === 0) {
    console.log('  No tokens produced, stopping');
    break;
  }
  
  for (let i = 0; i < count; i++) {
    const token = tokenBatch[i];
    const len = getTokenLength(token);
    const kind = getTokenKind(token);
    const text = input.slice(pos, pos + len);
    console.log(`  [${i}] ${tokenKindName(kind)}: ${JSON.stringify(text)} (len=${len})`);
    pos += len;
  }
  
  iterCount++;
}

if (iterCount >= maxIter) {
  console.log('\nReached max iterations!');
}
