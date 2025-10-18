/**
 * Run Node's test runner single-process and terminate after 10 seconds.
 */
import { spawn } from 'child_process';

const proc = spawn(
  process.execPath,
  ['--test', '--test-concurrency=1', ...process.argv.slice(2)],
  { stdio: 'inherit' });

const t = setTimeout(() => {
  console.log('TIMEOUT');
  proc.kill();
  process.exit(124);
}, 5000);

proc.on('exit', code => {
  clearTimeout(t);
  process.exit(code);
});