import { Buffer } from 'node:buffer';

import {
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';

const normalizedLock = (line) => line.trim().replace(/\s+/g, ' ');
const lockPayload = (line) => normalizedLock(line).replace(/^\d+: /, '');
function device(dev) {
  const value = BigInt(dev);
  return [
    ((value >> 8n) & 0xfffn) | ((value >> 32n) & 0xfffff000n),
    (value & 0xffn) | ((value >> 12n) & 0xffffff00n),
  ];
}

// The inherited FD must expose the held open-file-description lock itself.
// Matching an inode or a caller-supplied owner PID alone grants no authority.
export async function proveLease({ fs, process, lease }, target) {
  let pid = process.pid;
  const seen = new Set();
  while (true) {
    requireFact(!seen.has(pid) && seen.size < 64, 'invalid owner ancestry');
    seen.add(pid);
    const status = String(await fs.readFile(`/proc/${pid}/status`, 'utf8'));
    requireFact(
      Number(/^Pid:\s*(\d+)$/m.exec(status)?.[1]) === pid,
      'stale process identity',
    );
    if (pid === lease.ownerPid) break;
    pid = Number(/^PPid:\s*(\d+)$/m.exec(status)?.[1]);
    requireFact(positivePid(pid), 'lease owner is not an ancestor');
  }
  const records = String(await fs.readFile('/proc/locks', 'utf8'))
    .split('\n')
    .map(lockPayload);
  const descriptors = new Set();
  const files = new Set();
  for (const [index, lock] of lease.locks.entries()) {
    const expected = target.locks[index];
    requireFact(
      lock.ownerPid === lease.ownerPid &&
        lock.path === expected.path &&
        lock.mode === expected.mode &&
        Number.isSafeInteger(lock.fd) &&
        lock.fd >= 0 &&
        Number.isSafeInteger(lock.dev) &&
        lock.dev >= 0 &&
        positivePid(lock.inode) &&
        !descriptors.has(lock.fd) &&
        !files.has(`${lock.dev}:${lock.inode}`),
      'invalid lease record',
    );
    descriptors.add(lock.fd);
    files.add(`${lock.dev}:${lock.inode}`);
    const current = await fs.lstat(lock.path);
    requireFact(
      current.isFile() &&
        !current.isSymbolicLink() &&
        current.dev === lock.dev &&
        current.ino === lock.inode,
      'replaced lock file',
    );
    const [major, minor] = device(lock.dev);
    for (const holder of new Set([lease.ownerPid, process.pid])) {
      const fd = `/proc/${holder}/fd/${lock.fd}`;
      const stat = await fs.stat(fd);
      requireFact(
        stat.dev === lock.dev &&
          stat.ino === lock.inode &&
          (await fs.readlink(fd)) === lock.path,
        'closed or replaced inherited FD',
      );
      const info = String(
        await fs.readFile(`/proc/${holder}/fdinfo/${lock.fd}`, 'utf8'),
      );
      const row = normalizedLock(/^lock:\s*(.+)$/m.exec(info)?.[1] ?? '');
      const parsed =
        /^(\d+): FLOCK ADVISORY (READ|WRITE) (\d+) ([0-9a-f]+):([0-9a-f]+):(\d+) 0 EOF$/i.exec(
          row,
        );
      requireFact(
        Number(/^ino:\s*(\d+)$/m.exec(info)?.[1]) === lock.inode &&
          parsed &&
          parsed[2] === (lock.mode === 'shared' ? 'READ' : 'WRITE') &&
          Number(parsed[3]) === lease.ownerPid &&
          BigInt(`0x${parsed[4]}`) === major &&
          BigInt(`0x${parsed[5]}`) === minor &&
          Number(parsed[6]) === lock.inode &&
          records.includes(lockPayload(row)),
        'inherited open-file-description lock not proved',
      );
    }
  }
}

// One fresh client per invocation. No native process port or environment default.
export function createChildRunner({ process, clock }) {
  const owned = new Set();
  let accepting = true;

  function run(invocation, { interactive = false, onOutput } = {}) {
    requireFact(accepting, 'child admission closed');
    const input = Buffer.from(invocation.input);
    const handle = {};
    const completion = new Promise((resolve, reject) => {
      let child;
      let closed = false;
      let failure;
      let aborting = false;
      let ended = false;
      const stdout = [];
      const stderr = [];
      const tasks = new Set();
      const timers = new Set();
      const text = (chunks) => Buffer.concat(chunks).toString('utf8');
      function timer(callback, delay) {
        try {
          timers.add(clock.setTimeout(callback, delay));
        } catch (error) {
          failure ??= error;
          try {
            child?.kill('SIGTERM');
          } catch (killError) {
            failure ??= killError;
          }
        }
      }
      function abort(error) {
        failure ??= error;
        if (closed || !child || aborting) return;
        aborting = true;
        try {
          child.kill('SIGTERM');
        } catch (killError) {
          failure ??= killError;
        }
        timer(() => {
          if (!closed) {
            try {
              child.kill('SIGKILL');
            } catch (killError) {
              failure ??= killError;
            }
          }
        }, 5000);
      }
      function finishInput(bytes) {
        requireFact(
          !closed && !failure && !ended,
          'client no longer admits input',
        );
        ended = true;
        child.stdin.end(Buffer.from(bytes));
      }
      function update() {
        if (closed || failure || !onOutput) return;
        try {
          const pending = onOutput({
            stdout: text(stdout),
            stderr: text(stderr),
            finishInput,
            isClosed: () => closed,
          });
          if (pending && typeof pending.then === 'function') {
            const task = Promise.resolve(pending).catch(abort);
            tasks.add(task);
            void task.finally(() => tasks.delete(task));
          }
        } catch (error) {
          abort(error);
        }
      }
      handle.abort = abort;
      try {
        child = process.spawn(invocation.command, [...invocation.args], {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        requireFact(
          child?.stdin &&
            child.stdout &&
            child.stderr &&
            typeof child.kill === 'function',
          'invalid injected child',
        );
      } catch (error) {
        owned.delete(handle);
        reject(error);
        return;
      }
      child.stdout.on('data', (chunk) => {
        if (closed) return;
        stdout.push(Buffer.from(chunk));
        update();
      });
      child.stderr.on('data', (chunk) => {
        if (closed) return;
        stderr.push(Buffer.from(chunk));
        update();
      });
      child.on('error', abort);
      child.stdin.on('error', abort);
      child.stdout.on('error', abort);
      child.stderr.on('error', abort);
      child.once('close', (status, signal) => {
        closed = true;
        for (const id of timers) {
          try {
            clock.clearTimeout(id);
          } catch (error) {
            failure ??= error;
          }
        }
        timers.clear();
        void Promise.allSettled([...tasks]).then(() => {
          owned.delete(handle);
          if (failure) reject(failure);
          else if (signal || !Number.isInteger(status))
            reject(new Error('DEC197: child terminated without exit status'));
          else resolve({ status, stdout: text(stdout), stderr: text(stderr) });
        });
      });
      timer(() => abort(new Error('DEC197: owned child timeout')), 60000);
      try {
        requireFact(!failure, 'client clock failed before input');
        if (interactive) child.stdin.write(input);
        else finishInput(input);
      } catch (error) {
        abort(error);
      }
    });
    handle.promise = completion;
    owned.add(handle);
    void completion.finally(() => owned.delete(handle)).catch(() => {});
    return completion;
  }

  async function cancel(error = new Error('DEC197: local clients cancelled')) {
    accepting = false;
    const active = [...owned];
    for (const handle of active) handle.abort(error);
    await Promise.allSettled(active.map((handle) => handle.promise));
  }

  return { run, cancel };
}
