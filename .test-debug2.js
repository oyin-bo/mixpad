// @ts-check
import fs from 'fs';

const content = fs.readFileSync('parse/tests/7-html-elements.md', 'utf8');
const lines = content.split('\n');

console.log('Line 39 (input):');
const line39 = lines[39];
console.log(JSON.stringify(line39));
for (let i = 0; i < line39.length; i++) {
  console.log(`  [${i}] char='${line39[i]}' code=${line39.charCodeAt(i)}`);
}

console.log('\n\nLine 40 (expected markers):');
const line40 = lines[40];
console.log(JSON.stringify(line40));

// Find all markers in line 40
const markers = [];
for (let i = 0; i < line40.length; i++) {
  if (line40[i] !== ' ') {
    markers.push({ pos: i, marker: line40[i] });
  }
}

console.log('\nExpected token positions:');
markers.forEach(m => {
  console.log(`  Marker '${m.marker}' at position ${m.pos}: input char '${line39[m.pos]}' (code ${line39.charCodeAt(m.pos)})`);
});

