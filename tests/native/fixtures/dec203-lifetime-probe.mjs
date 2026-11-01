import assert from 'node:assert/strict';
import {
  closeSync,
  fstatSync,
  openSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  subjectURL,
  token,
  assertLive,
  artifact,
} from '../helpers/dec203-lifetime-harness.mjs';
import { unixPeers } from '../helpers/dec203-lifetime-peers.mjs';

// Load the real API before allocating this child's peer resources as well.
const subject = await import(subjectURL.href);
assert.equal(typeof subject.buildPeerLifetimeReader, 'function');
assert.equal(process.argv.length, 7);
const [mode, root, output, valuesPath, nonce] = process.argv.slice(2);
assert.ok(['receivers', 'descriptors'].includes(mode));
assert.match(nonce, /^[a-f0-9-]{36}$/);
const parent = dirname(root);
assert.equal(root, join(parent, `probe-${mode}`));
assert.equal(output, join(parent, 'run/peer-lifetime.node'));
assert.equal(
  valuesPath,
  join(parent, 'native-values/dec203-lifetime-values.node'),
);
const inputs = await Promise.all([artifact(output), artifact(valuesPath)]);
for (const record of inputs) assert.equal(record.uid, process.getuid());
const resources = [];
const fixture = { root, exits: [], defer: (close) => resources.push(close) };
const addon = createRequire(import.meta.url)(output);
const values = createRequire(import.meta.url)(valuesPath);
assert.deepEqual(Object.getOwnPropertyNames(addon), ['openPeerPidfd']);
assert.deepEqual(
  await Promise.all([artifact(output), artifact(valuesPath)]),
  inputs,
);

function inventory() {
  const found = [];
  for (const name of readdirSync('/proc/self/fd')) {
    if (!/^(0|[1-9][0-9]*)$/.test(name)) continue;
    try {
      const stat = fstatSync(Number(name), { bigint: true });
      found.push({
        fd: name,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: String(stat.mode),
        target: readlinkSync(`/proc/self/fd/${name}`),
      });
    } catch (error) {
      // readdir's own already-closed directory descriptor is not a live fd.
      if (!['EBADF', 'ENOENT'].includes(error.code)) throw error;
    }
  }
  return found.sort((left, right) => Number(left.fd) - Number(right.fd));
}

const errors = [];
const handles = [];
try {
  const { peers, listener } = await unixPeers(fixture, 2);
  assert.notEqual(peers[0].child.pid, peers[1].child.pid);
  assert.throws(
    () => addon.openPeerPidfd(listener._handle.fd),
    token('DEC203_PIDFD_INVALID_SOCKET'),
  );
  assert.throws(
    () => addon.openPeerPidfd(),
    token('DEC203_PIDFD_INVALID_SOCKET'),
  );
  assert.throws(
    () => addon.openPeerPidfd(peers[0].socket._handle.fd, 1),
    token('DEC203_PIDFD_INVALID_SOCKET'),
  );
  const open = (peer) => {
    const handle = addon.openPeerPidfd(peer.socket._handle.fd);
    handles.push(handle);
    assertLive(handle, peer.child.pid);
    return handle;
  };
  const first = open(peers[0]);
  const second = open(peers[1]);
  const pair = values.createDatagramPair();
  resources.push(() => pair.close());
  assert.ok(Object.isFrozen(pair));
  assert.deepEqual(Object.keys(pair).sort(), ['close', 'fd']);
  assert.throws(
    () => addon.openPeerPidfd(pair.fd),
    token('DEC203_PIDFD_INVALID_SOCKET'),
  );
  if (mode === 'receivers') {
    const read = first.read;
    const close = first.close;
    assert.deepEqual(read.call(second), {
      pid: peers[1].child.pid,
      fdInfoPid: peers[1].child.pid,
      alive: true,
    });
    for (const receiver of [
      undefined,
      null,
      {},
      JSON.parse(JSON.stringify(first)),
      Object.create(first),
      Object.create(Object.getPrototypeOf(first)),
      new Proxy(first, {}),
      values.createForeign(),
    ]) {
      assert.throws(
        () => read.call(receiver),
        token('DEC203_PIDFD_INVALID_CAPABILITY'),
      );
      assert.throws(
        () => close.call(receiver),
        token('DEC203_PIDFD_INVALID_CAPABILITY'),
      );
      assertLive(first, peers[0].child.pid);
    }
    assert.equal(close.call(second), undefined);
    assert.throws(
      () => read.call(second),
      token('DEC203_PIDFD_CAPABILITY_CLOSED'),
    );
    assertLive(first, peers[0].child.pid);
  } else {
    first.close();
    second.close();
    let fd = openSync(valuesPath, 'r');
    const closeFile = () => {
      const owned = fd;
      fd = -1;
      if (owned >= 0) closeSync(owned);
    };
    resources.push(closeFile);
    const before = inventory();
    for (let iteration = 0; iteration < 96; iteration++) {
      const handle = addon.openPeerPidfd(
        peers[iteration % 2].socket._handle.fd,
      );
      try {
        assertLive(handle, peers[iteration % 2].child.pid);
      } finally {
        handle.close();
      }
      assert.throws(
        () => handle.read(),
        token('DEC203_PIDFD_CAPABILITY_CLOSED'),
      );
      assert.throws(
        () => addon.openPeerPidfd(fd),
        token('DEC203_PIDFD_INVALID_SOCKET'),
      );
      assert.throws(
        () => addon.openPeerPidfd(pair.fd),
        token('DEC203_PIDFD_INVALID_SOCKET'),
      );
      for (const invalid of [
        -1,
        0.5,
        peers[0].socket._handle.fd + 0.5,
        2 ** 32 + peers[0].socket._handle.fd,
        NaN,
        Infinity,
        -Infinity,
        2147483648,
        '1',
        1n,
        null,
        undefined,
      ]) {
        assert.throws(
          () => addon.openPeerPidfd(invalid),
          token('DEC203_PIDFD_INVALID_SOCKET'),
        );
      }
    }
    assert.deepEqual(
      inventory(),
      before,
      'identified self-fd inventory with stable peer resources',
    );
    const former = fd;
    closeFile();
    assert.throws(
      () => addon.openPeerPidfd(former),
      token('DEC203_PIDFD_INVALID_SOCKET'),
    );
    assertLive(open(peers[0]), peers[0].child.pid);
  }
} catch (error) {
  if (error.code === 'DEC203_PIDFD_UNAVAILABLE')
    token('DEC203_PIDFD_UNAVAILABLE')(error);
  errors.push(error);
} finally {
  for (const handle of handles) {
    try {
      handle.close();
    } catch (error) {
      errors.push(error);
    }
  }
  for (const close of resources.reverse()) {
    try {
      await close();
    } catch (error) {
      errors.push(error);
    }
  }
}
const code = errors.some((error) => error.code === 'DEC203_PIDFD_UNAVAILABLE')
  ? 'DEC203_PIDFD_UNAVAILABLE'
  : 'DEC203_LIFETIME_PROBE_FAILED';
const finished = new Promise((resolve) =>
  process.once('message', (message) => {
    assert.equal(message, 'finish');
    resolve();
  }),
);
await new Promise((resolve, reject) =>
  process.send(
    errors.length
      ? { mode, nonce, complete: false, code }
      : { mode, nonce, complete: true },
    (error) => (error ? reject(error) : resolve()),
  ),
);
await finished;
process.disconnect();
if (errors.length) process.exitCode = 1;
