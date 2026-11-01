import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { executableFixture } from './dec203-stream-ingress-writer-build.mjs';
import {
  assertArtifacts,
  failure,
} from '../../../infra/database-upgrades/native-tracing/peer-artifacts.mjs';

const retained = new Set();
const commands = new Map([
  ['SEND_A', 4],
  ['SEND_B', 4],
  ['SPLIT_A', 6],
  ['TRY_RIGHTS_A', -1],
  ['TRY_RIGHTS_B', -1],
  ['HALF_CLOSE', 0],
  ['EXIT_A', null],
  ['EXIT_B', null],
]);

export async function bounded(promise, code = 'DEC203_FIXTURE_PRECONDITION') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(failure(code)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function processRecord(pid, parent, path) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const text = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = text
    .slice(text.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/);
  assert.equal(Number(text.slice(0, text.indexOf(' '))), pid);
  assert.equal(Number(fields[1]), parent);
  assert.match(fields[19], /^[1-9][0-9]*$/);
  assert.ok(!['Z', 'X'].includes(fields[0]));
  assert.equal(lstatSync(`/proc/${pid}`).uid, process.getuid());
  assert.equal(readlinkSync(`/proc/${pid}/exe`), path);
  return Object.freeze({ pid, parent, start: fields[19], path });
}

function stillHeld(record) {
  for (const [name, identity] of Object.entries(record.identities)) {
    if (record.terminal.has(name)) continue;
    assert.deepEqual(
      processRecord(identity.pid, identity.parent, identity.path),
      identity,
    );
  }
}

function originalAbsent(identity) {
  try {
    const text = readFileSync(`/proc/${identity.pid}/stat`, 'utf8');
    const fields = text
      .slice(text.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    assert.notEqual(
      fields[19],
      identity.start,
      'original owned process must be reaped',
    );
  } catch (error) {
    if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
  }
}

function fixtureFailure(code, cause) {
  if (cause?.code?.startsWith('DEC203_FIXTURE_')) return cause;
  const error = failure(code);
  error.cause = cause;
  return error;
}

export async function writers(fixture, endpoint) {
  try {
    return await startWriters(fixture, endpoint);
  } catch (error) {
    throw fixtureFailure('DEC203_FIXTURE_PRECONDITION', error);
  }
}

async function startWriters(fixture, endpoint) {
  assert.equal(typeof endpoint, 'string');
  assert.ok(endpoint.startsWith(`unix://${fixture.root}/`));
  const path = endpoint.slice(7);
  const parent = dirname(path);
  assert.equal(path, join(parent, 'docker.sock'));
  assert.ok(
    fixture.directories.has(parent),
    'connect only an independently owned fixture directory',
  );
  assert.equal(realpathSync(parent), parent);
  const parentStat = lstatSync(parent, { bigint: true });
  assert.ok(parentStat.isDirectory() && !parentStat.isSymbolicLink());
  assert.equal(
    `${parentStat.dev}:${parentStat.ino}:${parentStat.uid}`,
    fixture.directories.get(parent),
  );
  assert.equal(Number(parentStat.mode), 0o040700);
  const socketStat = lstatSync(path, { bigint: true });
  assert.ok(socketStat.isSocket() && !socketStat.isSymbolicLink());
  assert.equal(Number(socketStat.mode), 0o140600);
  assert.equal(Number(socketStat.uid), process.getuid());
  const output = await executableFixture(fixture);
  assertArtifacts([output, ...fixture.writerInputs]);
  const record = {
    errors: [],
    terminal: new Set(),
    frames: [],
    identities: {},
  };
  retained.add(record);
  record.child = spawn(output.path, [endpoint.slice(7)], {
    cwd: fixture.root,
    shell: false,
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let waiting;
  let text = '';
  const fail = (error) => {
    record.errors.push(error);
    waiting?.reject(error);
    waiting = null;
  };
  record.streams = [
    record.child.stdin,
    record.child.stdout,
    record.child.stderr,
  ].map((stream) => {
    stream.on('error', fail);
    return new Promise((resolve) => stream.once('close', resolve));
  });
  record.child.stdout.setEncoding('utf8');
  record.child.stdout.on('data', (chunk) => {
    text += chunk;
    try {
      assert.ok(Buffer.byteLength(text) < 4096);
      while (text.includes('\n')) {
        const boundary = text.indexOf('\n');
        const frame = JSON.parse(text.slice(0, boundary));
        text = text.slice(boundary + 1);
        if (frame.command === 'FINISH') record.finishFrame = frame;
        else if (waiting) {
          const pending = waiting;
          waiting = null;
          pending.resolve(frame);
        } else {
          assert.ok(record.frames.length < 4);
          record.frames.push(frame);
        }
      }
    } catch (error) {
      fail(error);
    }
  });
  record.child.stderr.on('data', (bytes) => {
    if (bytes.length) fail(failure('DEC203_FIXTURE_PRECONDITION'));
  });
  record.closed = new Promise((resolve) => {
    record.child.on('error', fail);
    record.child.once('close', (code, signal) => {
      record.exit = { code, signal };
      fixture.exits.push(record.exit);
      resolve();
    });
  });
  const next = () =>
    bounded(
      Promise.race([
        record.frames.length
          ? Promise.resolve(record.frames.shift())
          : new Promise((resolve, reject) => {
              assert.equal(waiting, undefined);
              waiting = { resolve, reject };
            }),
        record.closed.then(() => {
          throw failure('DEC203_FIXTURE_PRECONDITION');
        }),
      ]),
    );
  record.stop = () => {
    record.stopping ??= (async () => {
      try {
        if (!record.exit) record.child.stdin.end('FINISH\n');
        await bounded(
          Promise.all([record.closed, ...record.streams]),
          'DEC203_FIXTURE_DRAIN_UNCERTAIN',
        );
        assert.deepEqual(record.exit, { code: 0, signal: null });
        assert.deepEqual(record.finishFrame, {
          command: 'FINISH',
          terminal: true,
          aExit: 0,
          bExit: 0,
        });
        assert.equal(text, '');
        assert.deepEqual(record.errors, []);
        for (const identity of Object.values(record.identities))
          originalAbsent(identity);
        retained.delete(record);
      } catch (error) {
        const uncertain = failure('DEC203_FIXTURE_DRAIN_UNCERTAIN');
        uncertain.cause = error;
        throw uncertain;
      }
    })();
    return record.stopping;
  };
  fixture.defer(record.stop);
  const ready = await next();
  assert.deepEqual(Reflect.ownKeys(ready).sort(), [
    'a',
    'b',
    'connector',
    'gid',
    'ready',
    'transferred',
    'uid',
  ]);
  assert.equal(ready.ready, true);
  assert.equal(ready.transferred, true);
  assert.equal(ready.connector, record.child.pid);
  assert.equal(ready.uid, process.getuid());
  assert.equal(ready.gid, process.getgid());
  assert.equal(new Set([ready.connector, ready.a, ready.b]).size, 3);
  for (const name of ['connector', 'a', 'b']) {
    record.identities[name] = processRecord(
      ready[name],
      name === 'connector' ? process.pid : ready.connector,
      output.path,
    );
  }
  assertArtifacts([output, ...fixture.writerInputs]);
  let active = false;
  let halfClosed = false;
  return {
    ready: Object.freeze(ready),
    identities: Object.freeze(record.identities),
    stop: record.stop,
    async command(command) {
      if (active) throw failure('DEC203_FIXTURE_PROTOCOL');
      active = true;
      waiting = undefined;
      try {
        assert.ok(commands.has(command));
        assert.equal(record.stopping, undefined);
        stillHeld(record);
        assertArtifacts([output, ...fixture.writerInputs]);
        const response = next();
        record.child.stdin.write(`${command}\n`);
        const value = await response;
        if (command.startsWith('EXIT_')) {
          assert.deepEqual(value, { command, terminal: true, status: 0 });
          const name = command === 'EXIT_A' ? 'a' : 'b';
          record.terminal.add(name);
          originalAbsent(record.identities[name]);
        } else {
          assert.equal(halfClosed, false);
          assert.deepEqual(value, {
            command,
            count: commands.get(command),
            errno: command.startsWith('TRY_RIGHTS_') ? 1 : 0,
            unrelated: true,
          });
          if (command === 'HALF_CLOSE') halfClosed = true;
        }
        stillHeld(record);
        return value;
      } catch (error) {
        throw fixtureFailure('DEC203_FIXTURE_PROTOCOL', error);
      } finally {
        active = false;
      }
    },
  };
}
