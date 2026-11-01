import assert from 'node:assert/strict';
import { fstatSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { assertLive, openLive, token } from './dec203-lifetime-harness.mjs';
import { bounded, probe, unixPeers } from './dec203-lifetime-peers.mjs';
import { lifetimeValues } from './dec203-lifetime-values.mjs';
import { tcpPair } from './dec203-peer-client.mjs';

const closed = token('DEC203_PIDFD_CAPABILITY_CLOSED');
const invalid = token('DEC203_PIDFD_INVALID_CAPABILITY');
const observation = (pid) => ({ pid, fdInfoPid: pid, alive: true });

export function capabilityCases(check) {
  check(
    'LC01 real kernel lifetime follows independently spawned peer, not its claim',
    async (f) => {
      const reader = await f.build();
      const { peers } = await unixPeers(f, 2);
      assert.notEqual(peers[0].child.pid, peers[1].child.pid);
      for (const peer of peers) {
        const fd = peer.socket._handle.fd;
        const before = fstatSync(fd, { bigint: true });
        const handle = openLive(f, reader, peer);
        assert.deepEqual(fstatSync(fd, { bigint: true }), before);
        assert.equal(handle.close(), undefined);
        assert.equal(handle.close(), undefined);
        assert.throws(() => handle.read(), closed);
        assert.deepEqual(fstatSync(fd, { bigint: true }), before);
        assert.equal(peer.socket.destroyed, false);
        await new Promise((resolve, reject) =>
          peer.socket.write('caller socket remains owned\n', (error) =>
            error ? reject(error) : resolve(),
          ),
        );
      }
    },
  );

  check(
    'LC02 reaped peer exit latches while genuine half-open accepted Socket survives',
    async (f) => {
      const reader = await f.build();
      const { peers } = await unixPeers(f);
      const peer = peers[0];
      const handle = openLive(f, reader, peer);
      await peer.stop();
      await bounded(peer.ended, 'real peer EOF before stale-open premise');
      assert.ok(peer.socket instanceof net.Socket);
      assert.equal(peer.socket.destroyed, false);
      assert.equal(peer.socket.readableEnded, true);
      assert.equal(peer.socket._handle.constructor.name, 'Pipe');
      assert.ok(
        Number.isInteger(peer.socket._handle.fd) && peer.socket._handle.fd >= 0,
      );
      assert.ok(fstatSync(peer.socket._handle.fd).isSocket());
      assert.throws(() => handle.read(), token('DEC203_PIDFD_PEER_EXITED'));
      assert.throws(() => handle.read(), token('DEC203_PIDFD_PEER_EXITED'));
      const late = reader.open(peer.socket);
      assert.throws(() => late.read(), token('DEC203_PIDFD_PEER_EXITED'));
      late.close();
      handle.close();
      assert.throws(() => handle.read(), closed);
      assert.throws(() => late.read(), closed);
    },
  );

  check(
    'LC03 closing and naturally reusing original fd cannot retarget held lifetime',
    async (f) => {
      const reader = await f.build();
      const values = await lifetimeValues(f);
      const { peers } = await unixPeers(f);
      const peer = peers[0];
      const handle = openLive(f, reader, peer);
      const fd = peer.socket._handle.fd;
      peer.socket.destroy();
      await bounded(peer.closed, 'original accepted Socket close');
      assert.equal(peer.socket.destroyed, true);
      const pair = values.addon.createDatagramPair();
      f.defer(() => pair.close());
      assert.equal(
        pair.fd,
        fd,
        'actual controlled fd reuse prerequisite, not an arbitrary close',
      );
      assert.ok(fstatSync(pair.fd).isSocket());
      assertLive(handle, peer.child.pid);
      pair.close();
      assertLive(handle, peer.child.pid);
      await peer.stop();
      assert.throws(() => handle.read(), token('DEC203_PIDFD_PEER_EXITED'));
    },
  );

  check(
    'LC04 public Socket guard rejects primitive, proxy and prototype forgeries',
    async (f) => {
      const reader = await f.build();
      const { peers } = await unixPeers(f);
      openLive(f, reader, peers[0]);
      for (const value of [
        null,
        undefined,
        1,
        1n,
        'socket',
        {},
        Object.create(net.Socket.prototype),
        new Proxy(peers[0].socket, {}),
      ]) {
        assert.throws(
          () => reader.open(value),
          token('DEC203_PIDFD_INVALID_SOCKET'),
        );
      }
      const unconnected = new net.Socket();
      f.defer(() => unconnected.destroy());
      assert.throws(
        () => reader.open(unconnected),
        token('DEC203_PIDFD_INVALID_SOCKET'),
      );
    },
  );
  check('LC05 connected TCP is not a Unix stream lifetime input', async (f) => {
    const reader = await f.build();
    const { peers } = await unixPeers(f);
    openLive(f, reader, peers[0]);
    const tcp = await tcpPair(f);
    assert.equal(tcp.socket.destroyed, false);
    assert.throws(
      () => reader.open(tcp.socket),
      token('DEC203_PIDFD_INVALID_SOCKET'),
    );
    assert.throws(
      () => reader.open(tcp.accepted),
      token('DEC203_PIDFD_INVALID_SOCKET'),
    );
  });
  check('LC06 already destroyed genuine Socket refuses new open', async (f) => {
    const reader = await f.build();
    const { peers } = await unixPeers(f);
    const handle = openLive(f, reader, peers[0]);
    peers[0].socket.destroy();
    await bounded(peers[0].closed, 'owned destroyed Socket');
    assert.equal(peers[0].socket.destroyed, true);
    assert.throws(
      () => reader.open(peers[0].socket),
      token('DEC203_PIDFD_INVALID_SOCKET'),
    );
    assertLive(handle, peers[0].child.pid);
  });

  check(
    'LC07 copied facade methods use any genuine registered receiver',
    async (f) => {
      const reader = await f.build();
      const { peers } = await unixPeers(f, 2);
      const [a, b] = peers.map((peer) => openLive(f, reader, peer));
      const read = a.read;
      const close = a.close;
      assert.deepEqual(read.call(b), observation(peers[1].child.pid));
      assert.equal(close.call(b), undefined);
      assert.throws(() => read.call(b), closed);
      assertLive(a, peers[0].child.pid);
      for (const receiver of [
        undefined,
        null,
        1,
        {},
        JSON.parse(JSON.stringify(a)),
        Object.create(a),
        Object.create(Object.getPrototypeOf(a)),
        new Proxy(a, {}),
      ]) {
        assert.throws(() => read.call(receiver), invalid);
        assert.throws(() => close.call(receiver), invalid);
        assertLive(a, peers[0].child.pid);
      }
      assert.throws(() => read(), invalid);
      assert.throws(() => close(), invalid);
    },
  );

  check(
    'LC08 same-module cross-reader methods attest actual facade owner build',
    async (f) => {
      const copy = await f.copySubject();
      const headersA = await f.copyHeaders('headers-a');
      const headersB = await f.copyHeaders('headers-b');
      const readerA = await f.build(
        { includeDirectory: headersA },
        copy.factory,
      );
      const readerB = await f.build(
        {
          runDirectory: await f.directory('run-b'),
          includeDirectory: headersB,
        },
        copy.factory,
      );
      const { peers } = await unixPeers(f, 2);
      const a = openLive(f, readerA, peers[0]);
      const b = openLive(f, readerB, peers[1]);
      const borrowed = a.read;
      assert.deepEqual(borrowed.call(b), observation(peers[1].child.pid));
      await f.drift(join(headersA, 'node_api.h'), false, async () => {
        assert.throws(() => a.read(), token('DEC203_IDENTITY_CHANGED'));
        assert.deepEqual(borrowed.call(b), observation(peers[1].child.pid));
      });
      await f.drift(join(headersB, 'node_api.h'), false, async () => {
        assertLive(a, peers[0].child.pid);
        assert.throws(() => borrowed.call(b), token('DEC203_IDENTITY_CHANGED'));
      });
      const closing = readerA.close();
      assert.throws(() => a.read(), closed);
      assert.deepEqual(borrowed.call(b), observation(peers[1].child.pid));
      await closing;
      assert.deepEqual(borrowed.call(b), observation(peers[1].child.pid));
      await readerB.close();
      assert.throws(() => borrowed.call(b), closed);
    },
  );
  check('LC09 separately copied module facade remains foreign', async (f) => {
    const copyA = await f.copySubject('module-a');
    const copyB = await f.copySubject('module-b');
    const readerA = await f.build({}, copyA.factory);
    const readerB = await f.build(
      { runDirectory: await f.directory('run-b') },
      copyB.factory,
    );
    const { peers } = await unixPeers(f, 2);
    const a = openLive(f, readerA, peers[0]);
    const b = openLive(f, readerB, peers[1]);
    assert.throws(() => a.read.call(b), invalid);
    assert.throws(() => a.close.call(b), invalid);
    assert.throws(() => b.read.call(a), invalid);
    assert.throws(() => b.close.call(a), invalid);
    assertLive(a, peers[0].child.pid);
    assertLive(b, peers[1].child.pid);
  });

  for (const mode of ['receivers', 'descriptors']) {
    check(`LC10 dedicated actual native ${mode} probe`, async (f) => {
      const reader = await f.build();
      const values = await lifetimeValues(f);
      await probe(f, reader, values, mode);
    });
  }
}
