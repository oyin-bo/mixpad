const testContent = `Double newline recovery
<!-- unclosed comment

<-- EOF`;

const lines = testContent.split(/\r\n|\n|\r/);
console.log('Lines:');
lines.forEach((line, i) => console.log(`  ${i}: "${line}"`));

const EOF_MARKER_REGEX = /^<--+\s*EOF\s*$/;
const eofLine = lines.findIndex(line => EOF_MARKER_REGEX.test(line.trim()));
console.log(`\nEOF marker at line: ${eofLine}`);

const contentLines = lines.slice(0, eofLine);
console.log('\nContent lines (before EOF):');
contentLines.forEach((line, i) => console.log(`  ${i}: "${line}"`));

const content = contentLines.join('\n');
console.log('\nJoined content:');
console.log(JSON.stringify(content));

