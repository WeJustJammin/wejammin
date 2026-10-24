import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { Fixture } from './helpers/dec203-peer-harness.mjs';
import { bounded, writers } from './helpers/dec203-stream-ingress-writers.mjs';

// These are fixture prerequisites, not stream-ingress or writer authority.
const retainedListeners = new Set();
const expected = Buffer.from('s1s2s3bbbb');
const identity = (stat) => `${stat.dev}:${stat.ino}:${stat.uid}`;

function signal() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function observe(socket, fail) {
  const complete = signal();
  const ended = signal();
  const closed = signal();
  const record = {
    socket,
    complete,
    ended,
    closed,
    bytes: Buffer.alloc(expected.length),
    length: 0,
    sawEnd: false,
    sawClose: false,
    hadError: null,
  };
  socket.on('error', fail);
  socket.on('data', (bytes) => {
    try {
      assert.ok(Buffer.isBuffer(bytes));
      assert.ok(bytes.length <= expected.length - record.length);
      assert.ok(
        bytes.equals(
          expected.subarray(record.length, record.length + bytes.length),
        ),
      );
      bytes.copy(record.bytes, record.length);
      record.length += bytes.length;
      if (record.length === expected.length) complete.resolve();
    } catch (error) {
      fail(error);
    }
  });
  socket.once('end', () => {
    record.sawEnd = true;
    ended.resolve();
  });
  socket.once('close', (hadError) => {
    record.sawClose = true;
    record.hadError = hadError;
    closed.resolve();
  });
  record.close = () => {
    record.closing ??= (async () => {
      if (!socket.destroyed) socket.destroy();
      await bounded(closed.promise, 'DEC203_FIXTURE_DRAIN_UNCERTAIN');
      assert.equal(record.hadError, false);
    })();
    return record.closing;
  };
  return record;
}

async function listener(fixture) {
  const path = join(fixture.run, 'docker.sock');
  const accepted = signal();
  const listening = signal();
  const failed = signal();
  const records = [];
  const state = { path, records, fault: null };
  const fail = (error) => {
    state.fault ??= error;
    failed.resolve();
  };
  const wait = async (event) => {
    await bounded(
      Promise.race([
        event.promise,
        failed.promise.then(() => {
          throw state.fault;
        }),
      ]),
    );
    if (state.fault) throw state.fault;
  };
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    // Install every observer synchronously, before a writer can send bytes.
    const record = observe(socket, fail);
    records.push(record);
    if (records.length !== 1) fail(new Error('unexpected fixture connection'));
    accepted.resolve(record);
  });
  state.server = server;
  server.maxConnections = 1;
  server.on('error', fail);
  server.on('drop', () => fail(new Error('unexpected fixture connection')));
  server.once('listening', listening.resolve);
  retainedListeners.add(state);

  const checkPath = async () => {
    const stat = await fs.lstat(path, { bigint: true });
    assert.equal(identity(stat), fixture.files.get(path));
    assert.ok(stat.isSocket() && !stat.isSymbolicLink());
    assert.equal(stat.uid, BigInt(process.getuid()));
    assert.equal(stat.mode, 0o140600n);
  };
  const close = () => {
    state.closing ??= (async () => {
      const errors = [];
      for (const record of records) {
        try {
          await record.close();
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        // Never let listener cleanup remove a replacement pathname.
        if (server.listening) await checkPath();
        await bounded(
          new Promise((resolve, reject) => {
            server.close((error) => {
              if (error && error.code !== 'ERR_SERVER_NOT_RUNNING')
                reject(error);
              else resolve();
            });
          }),
          'DEC203_FIXTURE_DRAIN_UNCERTAIN',
        );
      } catch (error) {
        errors.push(error);
      }
      if (state.fault) errors.unshift(state.fault);
      if (errors.length) {
        throw new AggregateError(
          errors,
          'fixture listener uncertain; evidence retained',
        );
      }
      retainedListeners.delete(state);
    })();
    return state.closing;
  };
  // Registered before listen and before writers: reverse cleanup stops writers first.
  fixture.defer(close);
  server.listen(path);
  await wait(listening);
  await fixture.remember(path);
  const initial = await fs.lstat(path, { bigint: true });
  assert.ok(initial.isSocket() && !initial.isSymbolicLink());
  assert.equal(identity(initial), fixture.files.get(path));
  await fs.chmod(path, 0o600);
  await checkPath();
  return { path, accepted, records, wait, close, checkPath };
}

test(
  'WF01: real shared-socket writers transfer, send, exit and drain (fixture only)',
  {
    timeout: 45_000,
  },
  async (context) => {
    // Existing credential import precedes allocation; no stream factory is imported.
    const fixture = await Fixture.open(context);
    const local = await listener(fixture);
    const peer = await writers(fixture, `unix://${local.path}`);
    await local.wait(local.accepted);
    assert.equal(local.records.length, 1);
    const received = local.records[0];

    assert.equal(peer.ready.transferred, true);
    assert.equal(
      new Set([
        peer.identities.connector.pid,
        peer.identities.a.pid,
        peer.identities.b.pid,
      ]).size,
      3,
    );
    assert.equal(peer.identities.connector.parent, process.pid);
    for (const name of ['a', 'b']) {
      assert.equal(peer.identities[name].parent, peer.identities.connector.pid);
      assert.match(peer.identities[name].start, /^[1-9][0-9]*$/);
      assert.equal(peer.identities[name].path, fixture.writerExecutable.path);
    }

    assert.deepEqual(await peer.command('SPLIT_A'), {
      command: 'SPLIT_A',
      count: 6,
      errno: 0,
      unrelated: true,
    });
    assert.deepEqual(await peer.command('SEND_B'), {
      command: 'SEND_B',
      count: 4,
      errno: 0,
      unrelated: true,
    });
    await local.wait(received.complete);
    assert.equal(received.length, 10);
    assert.ok(received.bytes.equals(Buffer.from('s1s2s3bbbb')));
    assert.equal(received.sawEnd, false);

    assert.deepEqual(await peer.command('EXIT_A'), {
      command: 'EXIT_A',
      terminal: true,
      status: 0,
    });
    assert.deepEqual(await peer.command('EXIT_B'), {
      command: 'EXIT_B',
      terminal: true,
      status: 0,
    });
    // No HALF_CLOSE: EOF requires every actual client alias to have closed.
    await local.wait(received.ended);
    assert.equal(received.sawEnd, true);
    assert.equal(received.length, 10);
    assert.ok(received.bytes.equals(Buffer.from('s1s2s3bbbb')));
    assert.equal(received.socket.writableEnded, false);
    received.socket.end();
    await local.wait(received.closed);
    assert.equal(received.sawClose, true);
    assert.equal(received.hadError, false);

    // FINISH verifies coordinator/children absence, actual wait status and stdio drain.
    await peer.stop();
    assert.deepEqual(fixture.exits, [{ code: 0, signal: null }]);
    await local.checkPath();
    await local.close();
  },
);
