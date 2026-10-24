import assert from 'node:assert/strict';
import net from 'node:net';

assert.equal(process.argv.length, 5);
const [path, nonce, declared] = process.argv.slice(2);
assert.match(nonce, /^[a-f0-9-]{36}$/);
const declaredPid = Number(declared);
assert.ok(Number.isSafeInteger(declaredPid) && declaredPid > 0);
assert.notEqual(declaredPid, process.pid);
const socket = net.createConnection({ path, allowHalfOpen: true });
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  socket.destroy();
  if (process.connected) process.disconnect();
}
socket.on('error', () => {
  process.exitCode = 1;
  stop();
});
socket.on('data', () => {});
socket.once('connect', () => {
  socket.write(JSON.stringify({ nonce, declaredPid }) + '\n');
});
process.on('message', (message) => {
  if (message !== 'stop') process.exitCode = 1;
  stop();
});
process.once('disconnect', stop);
