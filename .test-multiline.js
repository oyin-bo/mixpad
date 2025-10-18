const testContent = `Double newline recovery
<!-- unclosed comment


1   2
@1 HTMLCommentOpen|ErrorUnbalancedToken
@2 HTMLCommentContent " unclosed comment\\n"
<-- EOF`;

const lines = testContent.split(/\r\n|\n|\r/);
console.log('All lines:');
lines.forEach((line, i) => console.log(`  ${i}: "${line}"`));

// Find marker lines (start with 1, next line starts with @)
console.log('\nLooking for marker lines:');
for (let i = 0; i < lines.length - 1; i++) {
  const isMarkerLine = lines[i].trimStart().startsWith('1');
  const nextIsAssertion = lines[i + 1].charAt(0) === '@';
  if (isMarkerLine && nextIsAssertion) {
    console.log(`  Line ${i} is a marker line, testing line ${i-1}`);
    console.log(`  Source line: "${lines[i-1]}"`);
    console.log(`  Marker line: "${lines[i]}"`);
  }
}

