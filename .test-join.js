const lines = ["Double newline recovery", "<!-- unclosed comment", ""];
const joined = lines.join('\n');
console.log('Joined:',  JSON.stringify(joined));
console.log('Has double newline?', joined.includes('\n\n'));

const lines2 = ["Double newline recovery", "<!-- unclosed comment", "", ""];
const joined2 = lines2.join('\n');
console.log('\nJoined2:', JSON.stringify(joined2));
console.log('Has double newline?', joined2.includes('\n\n'));

