import assert from 'node:assert/strict';
import { isAbsolute, resolve } from 'node:path';

const errors = new Set(
  [
    'REFUSED',
    'CANCELLED',
    'IDENTITY_CHANGED',
    'UNAVAILABLE',
    'PROTOCOL',
    'HISTORY_GAP',
    'TIMEOUT',
    'FAILED',
    'DRAIN_UNCERTAIN',
  ].map((suffix) => `DEC203_SUPERVISOR_${suffix}`),
);

export function keys(value, expected) {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  assert.deepEqual(Reflect.ownKeys(value).sort(), [...expected].sort());
}

export const member = (value, values) => assert.ok(values.includes(value));
export const natural = (value) =>
  assert.ok(Number.isSafeInteger(value) && value >= 0);
export const positive = (value) => {
  natural(value);
  assert.ok(value > 0);
};
export function decimal(value, nonzero = false) {
  assert.equal(typeof value, 'string');
  assert.match(value, nonzero ? /^[1-9][0-9]*$/ : /^(0|[1-9][0-9]*)$/);
}
export function sequence(value) {
  decimal(value, true);
  assert.ok(BigInt(value) <= 18_446_744_073_709_551_615n);
}
function path(value) {
  assert.equal(typeof value, 'string');
  assert.ok(isAbsolute(value) && resolve(value) === value);
  assert.ok(!/[\0\r\n]/.test(value));
}
export function failure(value) {
  assert.ok(value === null || errors.has(value));
}
export function wait(value) {
  keys(value, ['exitCode', 'signal']);
  assert.ok(value.exitCode === null || Number.isSafeInteger(value.exitCode));
  assert.ok(value.signal === null || /^SIG[A-Z0-9]+$/.test(value.signal));
  assert.ok(value.exitCode === null || value.signal === null);
}

export function artifact(value) {
  keys(value, ['path', 'sha256', 'device', 'inode', 'size', 'mode', 'uid']);
  path(value.path);
  assert.match(value.sha256, /^[a-f0-9]{64}$/);
  decimal(value.device);
  decimal(value.inode, true);
  for (const key of ['size', 'mode', 'uid']) natural(value[key]);
}

export function processRecord(value) {
  keys(value, ['pid', 'ppid', 'startTime', 'session', 'uid', 'executable']);
  for (const key of ['pid', 'ppid', 'session']) positive(value[key]);
  natural(value.uid);
  decimal(value.startTime, true);
  artifact(value.executable);
}

function inventoryRows(values) {
  assert.ok(Array.isArray(values) && values.length <= 64);
  let prior = -1;
  for (const value of values) {
    keys(value, [
      'fd',
      'target',
      'device',
      'inode',
      'mode',
      'uid',
      'gid',
      'flags',
      'pos',
      'pidfd',
    ]);
    natural(value.fd);
    assert.ok(value.fd > prior);
    prior = value.fd;
    assert.equal(typeof value.target, 'string');
    assert.ok(
      Buffer.byteLength(value.target) <= 512 && !/[\0\r\n]/.test(value.target),
    );
    decimal(value.device);
    decimal(value.inode, true);
    for (const key of ['mode', 'uid', 'gid']) natural(value[key]);
    assert.match(value.flags, /^0(?:[1-7][0-7]*)?$/);
    decimal(value.pos);
    if (value.pidfd !== null) {
      keys(value.pidfd, ['pid', 'nspid']);
      assert.ok(Number.isSafeInteger(value.pidfd.pid) && value.pidfd.pid >= -1);
      assert.ok(
        Array.isArray(value.pidfd.nspid) && value.pidfd.nspid.length <= 16,
      );
      value.pidfd.nspid.forEach(positive);
    }
  }
}

function inventoryLocks(values) {
  assert.ok(Array.isArray(values) && values.length <= 4);
  let prior = 2;
  for (const value of values) {
    keys(value, ['fd', 'ownerPid', 'mode', 'device', 'inode', 'start', 'end']);
    assert.ok(Number.isInteger(value.fd) && value.fd > prior && value.fd <= 6);
    prior = value.fd;
    positive(value.ownerPid);
    member(value.mode, ['READ', 'WRITE']);
    decimal(value.device);
    decimal(value.inode, true);
    assert.equal(value.start, '0');
    assert.equal(value.end, 'EOF');
  }
}

function inventoryTarget(value, anchor) {
  if (value.target === '/proc/locks') {
    assert.notEqual(anchor.phase, 'lease-compiler-live');
    const metadata = anchor.kernelMetadata;
    assert.ok(metadata, 'independent /proc/locks metadata required');
    keys(metadata, ['target', 'device', 'inode', 'mode', 'uid', 'gid']);
    assert.equal(metadata.target, '/proc/locks');
    for (const key of ['target', 'device', 'inode', 'mode', 'uid', 'gid'])
      assert.equal(value[key], metadata[key]);
    assert.equal(value.mode, 0o100444);
    assert.equal(value.uid, 0);
    assert.equal(value.gid, 0);
    assert.ok(['02400000', '02500000'].includes(value.flags));
    assert.equal(value.pidfd, null);
    return;
  }
  const named = anchor.artifacts.find((entry) => entry.path === value.target);
  if (named) {
    for (const key of ['device', 'inode', 'mode', 'uid'])
      assert.equal(value[key], named[key]);
    return;
  }
  if (value.target === '/dev/null') {
    assert.equal(value.mode & 0o170000, 0o020000);
    return;
  }
  if (value.target.startsWith('/')) {
    path(value.target);
    assert.ok(
      [anchor.root, `${anchor.root}/owner`, `${anchor.root}/lease`].includes(
        value.target,
      ),
    );
    const directories = anchor.directories.filter(
      (entry) => entry.target === value.target,
    );
    assert.ok(
      directories.length > 0,
      'owned directory must be independently observed',
    );
    for (const expected of directories) {
      assert.equal(expected.mode, 0o040700);
      assert.equal(expected.uid, anchor.process.uid);
      for (const key of ['device', 'inode', 'mode', 'uid', 'gid'])
        assert.equal(value[key], expected[key]);
    }
    return;
  }
  const channel = /^(pipe|socket):\[(0|[1-9][0-9]*)\]$/.exec(value.target);
  if (channel) {
    assert.equal(value.inode, channel[2]);
    assert.equal(
      value.mode & 0o170000,
      channel[1] === 'pipe' ? 0o010000 : 0o140000,
    );
    return;
  }
  assert.match(
    value.target,
    /^anon_inode:(?:\[(?:eventpoll|eventfd|pidfd|signalfd|timerfd|io_uring)\]|(?:eventpoll|eventfd|pidfd|signalfd|timerfd|io_uring))$/,
  );
}

export function assertInventoryPayload(value, anchor) {
  const anchorKeys = [
    'phase',
    'process',
    'root',
    'requiredFds',
    'locks',
    'forbiddenObjects',
    'artifacts',
    'directories',
  ];
  if (anchor.kernelMetadata !== undefined) anchorKeys.push('kernelMetadata');
  keys(anchor, anchorKeys);
  if (anchor.kernelMetadata !== undefined) {
    keys(anchor.kernelMetadata, [
      'target',
      'device',
      'inode',
      'mode',
      'uid',
      'gid',
    ]);
    assert.equal(anchor.kernelMetadata.target, '/proc/locks');
  }
  keys(value, ['phase', 'process', 'fds', 'locks']);
  member(anchor.phase, [
    'owner-leased',
    'coordinator-precompile',
    'lease-compiler-live',
    'coordinator-adopted',
  ]);
  assert.equal(value.phase, anchor.phase);
  processRecord(value.process);
  assert.deepEqual(value.process, anchor.process);
  path(anchor.root);
  inventoryRows(value.fds);
  inventoryLocks(value.locks);
  assert.deepEqual(value.locks, anchor.locks);
  const stable = ['target', 'device', 'inode', 'mode', 'uid', 'gid', 'pidfd'];
  const fields = (entry) =>
    Object.fromEntries(stable.map((key) => [key, entry[key]]));
  const required = new Map(
    anchor.requiredFds.map((entry) => [entry.fd, entry]),
  );
  const object = (entry) => `${entry.device}:${entry.inode}`;
  const forbidden = new Set(anchor.forbiddenObjects);
  for (const [number, expected] of required) {
    const actual = value.fds.find((entry) => entry.fd === number);
    assert.ok(actual, `independently required FD${number}`);
    assert.deepEqual(fields(actual), fields(expected));
    assert.equal(
      BigInt(`0o${actual.flags}`) & 0o2000003n,
      BigInt(`0o${expected.flags}`) & 0o2000003n,
    );
  }
  for (const entry of value.fds) {
    const expected = required.get(entry.fd);
    if (forbidden.has(object(entry))) {
      assert.ok(
        expected && object(entry) === object(expected),
        'no protected-object alias',
      );
    }
    if (
      entry.pidfd !== null ||
      ['anon_inode:[pidfd]', 'anon_inode:pidfd'].includes(entry.target)
    ) {
      assert.ok(expected?.pidfd, 'only independently bound original pidfds');
      assert.deepEqual(entry.pidfd, expected.pidfd);
    }
    // Required rows already match independently observed protected or GCC stdio bindings.
    if (!expected || entry.target === '/proc/locks')
      inventoryTarget(entry, anchor);
  }
}

export function liveStatFields(raw, pid) {
  const fields = raw
    .slice(raw.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/);
  assert.equal(Number(raw.slice(0, raw.indexOf(' '))), pid);
  assert.ok(fields.length >= 20);
  assert.match(fields[19], /^[1-9][0-9]*$/);
  if (['Z', 'X'].includes(fields[0])) {
    const error = new Error('incomplete live process snapshot');
    error.code = 'DEC203_TEST_INCOMPLETE_SNAPSHOT';
    throw error;
  }
  return fields;
}

export function liveArguments(raw) {
  if (raw === '') {
    const error = new Error('incomplete live argument snapshot');
    error.code = 'DEC203_TEST_INCOMPLETE_SNAPSHOT';
    throw error;
  }
  const argv = raw.split('\0');
  assert.equal(argv.pop(), '');
  return argv;
}

export { createPendingCompilerExec } from './dec203-bootstrap-pre-ready-pending-exec.mjs';
