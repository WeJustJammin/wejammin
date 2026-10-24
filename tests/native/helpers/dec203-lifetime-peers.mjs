import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs, lstatSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { bounded } from './dec203-peer-client.mjs';

export { bounded };

function childIdentity(pid) {
  const text = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = text
    .slice(text.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/);
  assert.equal(Number(text.slice(0, text.indexOf(' '))), pid);
  assert.equal(Number(fields[1]), process.pid);
  assert.match(fields[19], /^[1-9][0-9]*$/);
  assert.equal(lstatSync(`/proc/${pid}`).uid, process.getuid());
  return fields[19];
}

function signalOwned(record) {
  if (record.exited || !record.start) return;
  try {
    if (childIdentity(record.child.pid) === record.start) {
      process.kill(record.child.pid, 'SIGKILL');
    }
  } catch (error) {
    if (!['ENOENT', 'ESRCH'].includes(error.code)) record.errors.push(error);
  }
}

export function spawnOwned(fixture, source, args) {
  const record = { errors: [], exited: false, start: null };
  record.child = spawn(process.execPath, [source, ...args], {
    cwd: fixture.root,
    env: {},
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  record.streams = [record.child.stdout, record.child.stderr].map((stream) => {
    stream.on('error', (error) => record.errors.push(error));
    stream.resume();
    return new Promise((resolve) => stream.once('close', resolve));
  });
  record.closed = new Promise((resolve) => {
    record.child.on('error', (error) => record.errors.push(error));
    record.child.once('close', (code, signal) => {
      record.exited = true;
      record.exit = { code, signal };
      fixture.exits.push(record.exit);
      resolve();
    });
  });
  try {
    record.start = childIdentity(record.child.pid);
  } catch (error) {
    record.errors.push(error);
  }
  record.stop = () => {
    record.stopping ??= (async () => {
      try {
        if (!record.exited && record.child.connected) {
          await new Promise((resolve, reject) =>
            record.child.send('stop', (error) =>
              error ? reject(error) : resolve(),
            ),
          );
        }
        await bounded(
          Promise.all([record.closed, ...record.streams]),
          'owned child drain',
        );
      } catch (error) {
        record.errors.push(error);
        signalOwned(record);
        await bounded(
          Promise.all([record.closed, ...record.streams]),
          'owned child forced drain',
        );
      }
      assert.deepEqual(record.exit, { code: 0, signal: null });
      assert.deepEqual(record.errors, []);
    })();
    return record.stopping;
  };
  fixture.defer(record.stop);
  return record;
}

export async function unixPeers(fixture, count = 1) {
  const failures = [];
  const sockets = [];
  const children = [];
  const pending = new Map();
  const path = `${fixture.root}/life-${randomUUID().slice(0, 8)}.sock`;
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    const record = { socket };
    record.closed = new Promise((resolve) => socket.once('close', resolve));
    record.ended = new Promise((resolve) => socket.once('end', resolve));
    sockets.push(record);
    socket.on('error', (error) => failures.push(error));
    socket.setEncoding('utf8');
    let frame = '';
    const receive = (chunk) => {
      frame += chunk;
      if (frame.length > 4096) {
        failures.push(new Error('owned lifetime peer oversized frame'));
        socket.destroy();
        return;
      }
      if (!frame.includes('\n')) return;
      socket.off('data', receive);
      socket.resume();
      try {
        const message = JSON.parse(frame.slice(0, frame.indexOf('\n')));
        assert.deepEqual(Object.keys(message).sort(), ['declaredPid', 'nonce']);
        const accept = pending.get(message.nonce);
        assert.equal(typeof accept, 'function');
        pending.delete(message.nonce);
        accept({ ...record, message });
      } catch (error) {
        failures.push(error);
        socket.destroy();
      }
    };
    socket.on('data', receive);
  });
  server.on('error', (error) => failures.push(error));
  fixture.defer(async () => {
    const errors = [];
    for (const child of children) {
      try {
        await child.stop();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const record of sockets) {
      record.socket.destroy();
      try {
        await bounded(record.closed, 'owned accepted socket close');
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await bounded(
        new Promise((resolve, reject) =>
          server.close((error) => {
            if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
            else resolve();
          }),
        ),
        'owned listener close',
      );
    } catch (error) {
      errors.push(error);
    }
    errors.push(...failures);
    if (errors.length) throw new AggregateError(errors, 'lifetime peers drain');
  });
  const listening = new Promise((resolve) => server.once('listening', resolve));
  server.listen(path);
  await bounded(listening, 'owned lifetime listener start');
  const connected = [];
  for (let index = 0; index < count; index++) {
    const nonce = randomUUID();
    connected.push(new Promise((resolve) => pending.set(nonce, resolve)));
    children.push(
      spawnOwned(
        fixture,
        fileURLToPath(
          new URL('../fixtures/dec203-lifetime-peer.mjs', import.meta.url),
        ),
        [path, nonce, String(process.pid)],
      ),
    );
  }
  const peers = await bounded(
    Promise.all(connected),
    'owned lifetime connection',
  );
  return {
    listener: server,
    peers: peers.map((peer, index) => ({
      ...peer,
      child: children[index].child,
      stop: children[index].stop,
    })),
  };
}

export async function probe(fixture, reader, values, mode) {
  assert.ok(['receivers', 'descriptors'].includes(mode));
  const directory = await fixture.directory(`probe-${mode}`);
  const nonce = randomUUID();
  const record = spawnOwned(
    fixture,
    fileURLToPath(
      new URL('../fixtures/dec203-lifetime-probe.mjs', import.meta.url),
    ),
    [mode, directory, reader.metadata.output.path, values.path, nonce],
  );
  const complete = new Promise((resolve, reject) => {
    record.child.on('message', (message) => {
      try {
        if (message?.complete === false) {
          assert.deepEqual(Object.keys(message).sort(), [
            'code',
            'complete',
            'mode',
            'nonce',
          ]);
          assert.equal(message.mode, mode);
          assert.equal(message.nonce, nonce);
          assert.ok(
            [
              'DEC203_PIDFD_UNAVAILABLE',
              'DEC203_LIFETIME_PROBE_FAILED',
            ].includes(message.code),
          );
        } else assert.deepEqual(message, { mode, nonce, complete: true });
        record.child.send('finish', (error) =>
          error ? reject(error) : resolve(message),
        );
      } catch (error) {
        reject(error);
      }
    });
  });
  const outcome = await bounded(
    Promise.race([
      complete,
      record.closed.then(() => {
        throw new Error('native probe ended before completion');
      }),
    ]),
    'native lifetime probe completion',
  );
  await bounded(
    Promise.all([record.closed, ...record.streams]),
    'native probe terminal drain',
  );
  if (!outcome.complete) {
    assert.deepEqual(record.exit, { code: 1, signal: null });
    fixture.context.diagnostic(
      `actual native probe refused: ${outcome.code}; positive contract NOT satisfied`,
    );
    const error = new Error(outcome.code);
    error.code = outcome.code;
    throw error;
  }
  await record.stop();
  assert.deepEqual(await fs.readdir(directory), []);
}
