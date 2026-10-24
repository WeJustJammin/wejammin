import assert from 'node:assert/strict';
import { once } from 'node:events';
import { promises as fs, fstatSync } from 'node:fs';
import net from 'node:net';
import test from 'node:test';
import { Fixture, token } from './helpers/dec203-peer-harness.mjs';
import {
  addonOf,
  assertMetadata,
  assertPeer,
} from './helpers/dec203-peer-metadata.mjs';
import { registerBuildCases } from './helpers/dec203-peer-build-cases.mjs';
import { registerProcessCases } from './helpers/dec203-peer-process-cases.mjs';
import {
  bounded,
  tcpPair,
  udpSocket,
  unixPeers,
} from './helpers/dec203-peer-client.mjs';
import { connectedUnixDatagram } from './helpers/dec203-peer-sockets.mjs';

function native(name, body) {
  test(name, { concurrency: false, timeout: 120_000 }, async (context) => {
    const fixture = await Fixture.open(context);
    await body(fixture);
  });
}

native(
  'DEC203-K001 kernel peer defeats a real child wrong declared PID',
  async (f) => {
    const reader = await f.build();
    const {
      listener,
      peers: [peer],
    } = await unixPeers(f);
    assert.notEqual(peer.message.declaredPid, peer.child.pid);
    assert.equal(peer.message.declaredPid, process.pid);
    const value = reader.read(peer.socket);
    assertPeer(value, peer.socket, peer.child.pid);
    const path = await fs.lstat(listener.address(), { bigint: true });
    assert.notEqual(
      `${value.device}:${value.inode}`,
      `${path.dev}:${path.ino}`,
    );
  },
);

native(
  'DEC203-K002 concurrent child PIDs and descriptor identities stay distinct',
  async (f) => {
    const reader = await f.build();
    const { peers } = await unixPeers(f, 2);
    assert.equal(new Set(peers.map((peer) => peer.child.pid)).size, 2);
    const values = peers.map((peer) => {
      const value = reader.read(peer.socket);
      assertPeer(value, peer.socket, peer.child.pid);
      assert.deepEqual(reader.read(peer.socket), value);
      return value;
    });
    assert.equal(
      new Set(values.map((value) => `${value.device}:${value.inode}`)).size,
      2,
    );
  },
);

native(
  'DEC203-K003 exact frozen capability and independent native build metadata',
  async (f) => {
    const reader = await f.build();
    const stat = await fs.stat(f.run);
    assert.equal(stat.uid, process.getuid());
    assert.equal(stat.mode & 0o777, 0o700);
    await assertMetadata(reader, f, f.sourceDirectory);
    assert.deepEqual(await fs.readdir(f.run), ['peer-credentials.node']);
    assert.throws(() => {
      reader.metadata.node.napi = 9;
    }, TypeError);
  },
);

native(
  'DEC203-K004 unsupported sockets and credential lookalikes cannot substitute',
  async (f) => {
    const reader = await f.build();
    const {
      peers: [peer],
    } = await unixPeers(f);
    assertPeer(reader.read(peer.socket), peer.socket, peer.child.pid);
    const forged = Object.create(net.Socket.prototype, {
      _handle: { value: { fd: peer.socket._handle.fd } },
    });
    assert.ok(forged instanceof net.Socket);
    assert.equal(forged.destroyed, false);
    assert.throws(() => reader.read(forged), token('DEC203_INVALID_SOCKET'));
    const fake = {
      _handle: { fd: peer.socket._handle.fd },
      pid: peer.child.pid,
    };
    assert.throws(() => reader.read(fake), token('DEC203_INVALID_SOCKET'));
    const unsupported = new Proxy(peer.socket, {
      get: (target, key, receiver) =>
        key === '_handle' ? null : Reflect.get(target, key, receiver),
    });
    assert.throws(
      () => reader.read(unsupported),
      token('DEC203_INVALID_SOCKET'),
    );
    const disconnected = new net.Socket();
    try {
      assert.throws(
        () => reader.read(disconnected),
        token('DEC203_INVALID_SOCKET'),
      );
    } finally {
      const closed = once(disconnected, 'close');
      disconnected.destroy();
      await bounded(closed, 'unsupported owned socket close deadline');
    }
  },
);

native(
  'DEC203-N001 actual addon validates fd types and has a real positive control',
  async (f) => {
    const reader = await f.build();
    const addon = addonOf(reader);
    const {
      peers: [peer],
    } = await unixPeers(f);
    const fd = peer.socket._handle.fd;
    assert.deepEqual(addon.readPeerCredentials(fd), reader.read(peer.socket));
    const invalid = [
      -1,
      NaN,
      Infinity,
      2 ** 53,
      null,
      {},
      undefined,
      fd + 0.5,
      2 ** 32 + fd,
      String(fd),
    ];
    for (const value of invalid) {
      assert.throws(
        () => addon.readPeerCredentials(value),
        token('DEC203_INVALID_SOCKET'),
      );
    }
    assert.throws(
      () => addon.readPeerCredentials(),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N002 actual addon refuses a regular file descriptor',
  async (f) => {
    const reader = await f.build();
    const path = await f.file('regular-file', 'not a socket');
    const file = await fs.open(path, 'r');
    f.defer(() => file.close());
    assert.throws(
      () => addonOf(reader).readPeerCredentials(file.fd),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N003 actual connected TCP stream is not a Unix peer',
  async (f) => {
    const reader = await f.build();
    const { socket } = await tcpPair(f);
    assert.throws(() => reader.read(socket), token('DEC203_INVALID_SOCKET'));
    assert.throws(
      () => addonOf(reader).readPeerCredentials(socket._handle.fd),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N004 actual listening Unix stream is not connected',
  async (f) => {
    const reader = await f.build();
    const { listener } = await unixPeers(f, 0);
    assert.ok(Number.isInteger(listener._handle.fd));
    assert.throws(
      () => addonOf(reader).readPeerCredentials(listener._handle.fd),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N005 actual datagram descriptor is not a connected Unix stream',
  async (f) => {
    const reader = await f.build();
    const socket = await udpSocket(f);
    assert.ok(Number.isInteger(socket._handle.fd));
    assert.throws(
      () => addonOf(reader).readPeerCredentials(socket._handle.fd),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N006 actual closed descriptor and closed socket cannot fall back',
  async (f) => {
    const reader = await f.build();
    const {
      peers: [peer],
    } = await unixPeers(f);
    const fd = peer.socket._handle.fd;
    const closed = once(peer.socket, 'close');
    await peer.stop();
    await bounded(closed, 'closed descriptor fixture deadline');
    assert.throws(
      () => addonOf(reader).readPeerCredentials(fd),
      token('DEC203_INVALID_SOCKET'),
    );
    assert.throws(
      () => reader.read(peer.socket),
      token('DEC203_INVALID_SOCKET'),
    );
  },
);

native(
  'DEC203-N007 connected Unix datagram isolates the stream-only guard',
  async (f) => {
    const reader = await f.build();
    const addon = addonOf(reader);
    const {
      peers: [peer],
    } = await unixPeers(f);
    assert.deepEqual(
      addon.readPeerCredentials(peer.socket._handle.fd),
      reader.read(peer.socket),
    );
    const pair = await connectedUnixDatagram(f);
    const before = fstatSync(pair.fd, { bigint: true });
    assert.ok(before.isSocket());
    assert.throws(
      () => addon.readPeerCredentials(pair.fd),
      token('DEC203_INVALID_SOCKET'),
    );
    const after = fstatSync(pair.fd, { bigint: true });
    assert.deepEqual([after.dev, after.ino], [before.dev, before.ino]);
    pair.close();
    pair.close();
    assert.throws(() => fstatSync(pair.fd), { code: 'EBADF' });
  },
);

registerBuildCases(native);
registerProcessCases(native);
