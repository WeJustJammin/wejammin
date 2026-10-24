import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { once } from 'node:events';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export function cleanupDiagnostic(errors, exits) {
  const pending = errors.slice(0, 32);
  const seen = new Set();
  const flattened = [];
  while (pending.length && seen.size < 32) {
    const error = pending.shift();
    if (!(error instanceof Error) || seen.has(error)) continue;
    seen.add(error);
    flattened.push({
      name: typeof error.name === 'string' ? error.name.slice(0, 64) : null,
      code:
        typeof error.code === 'string'
          ? error.code.slice(0, 64)
          : Number.isInteger(error.code)
            ? error.code
            : null,
    });
    for (const nested of [error.errors, error.actual, error.cause]) {
      if (Array.isArray(nested)) pending.push(...nested.slice(0, 32));
      else pending.push(nested);
    }
  }
  return { errors: flattened, exits: exits.slice(0, 16) };
}

export async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function trackSocket(socket, sockets, failures) {
  const record = { socket };
  record.closed = new Promise((resolve) => socket.once('close', resolve));
  socket.on('error', (error) => failures.push(error));
  sockets.push(record);
  return socket;
}

async function closeServer(server) {
  await bounded(
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
        else resolve();
      });
    }),
    'owned listener close deadline',
  );
}

function stopChild(record) {
  record.stopPromise ??= stopChildOnce(record);
  return record.stopPromise;
}

async function stopChildOnce(record) {
  try {
    if (!record.exited && record.child.connected) record.child.send('stop');
    await bounded(record.closed, 'owned peer close deadline');
  } catch (error) {
    record.failures.push(error);
    if (!record.exited) record.child.kill('SIGKILL');
    await bounded(record.closed, 'owned peer forced-close deadline');
  }
  assert.deepEqual(record.exit, { code: 0, signal: null });
  assert.deepEqual(record.failures, []);
}

export async function unixPeers(fixture, count = 1) {
  const failures = [];
  const sockets = [];
  const children = [];
  const pending = new Map();
  const path = `${fixture.root}/peers-${randomUUID().slice(0, 8)}.sock`;
  const server = net.createServer((socket) => {
    trackSocket(socket, sockets, failures).setEncoding('utf8');
    let frame = '';
    const receive = (chunk) => {
      frame += chunk;
      if (frame.length > 4096) {
        failures.push(new Error('oversized owned peer fixture frame'));
        socket.destroy();
      }
      if (!frame.includes('\n')) return;
      socket.off('data', receive);
      socket.resume();
      try {
        const message = JSON.parse(frame.slice(0, frame.indexOf('\n')));
        assert.deepEqual(Object.keys(message).sort(), ['declaredPid', 'nonce']);
        const resolve = pending.get(message.nonce);
        assert.equal(typeof resolve, 'function');
        pending.delete(message.nonce);
        resolve({ socket, message });
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
    for (const record of children) {
      try {
        await stopChild(record);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const record of sockets) {
      record.socket.destroy();
      try {
        await bounded(record.closed, 'owned Unix socket close deadline');
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await closeServer(server);
    } catch (error) {
      errors.push(error);
    }
    errors.push(...failures);
    if (errors.length)
      throw new AggregateError(errors, 'owned peer drain failed');
  });
  const listening = once(server, 'listening');
  server.listen(path);
  await bounded(listening, 'owned Unix listener start deadline');
  const connected = [];
  for (let index = 0; index < count; index += 1) {
    const nonce = randomUUID();
    connected.push(new Promise((resolve) => pending.set(nonce, resolve)));
    const record = { failures: [] };
    record.child = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        '--peer',
        path,
        nonce,
        String(process.pid),
      ],
      { env: {}, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    record.child.stdout.on('error', (error) => record.failures.push(error));
    record.child.stderr.on('error', (error) => record.failures.push(error));
    record.child.stdout.resume();
    record.child.stderr.resume();
    record.closed = new Promise((resolve) => {
      record.child.on('error', (error) => record.failures.push(error));
      record.child.once('close', (code, signal) => {
        record.exited = true;
        record.exit = { code, signal };
        fixture.exits.push({ code, signal });
        resolve();
      });
    });
    children.push(record);
    assert.ok(Number.isInteger(record.child.pid));
  }
  const peers = await bounded(
    Promise.all(connected),
    'owned peer connect deadline',
  );
  return {
    listener: server,
    peers: peers.map((peer, index) => ({
      ...peer,
      child: children[index].child,
      stop: () => stopChild(children[index]),
    })),
  };
}

export async function tcpPair(fixture) {
  const failures = [];
  const sockets = [];
  let accept;
  const accepted = new Promise((resolve) => {
    accept = resolve;
  });
  const server = net.createServer((socket) => {
    accept(trackSocket(socket, sockets, failures));
  });
  server.on('error', (error) => failures.push(error));
  fixture.defer(async () => {
    const errors = [];
    for (const record of sockets) {
      record.socket.destroy();
      try {
        await bounded(record.closed, 'owned TCP socket close deadline');
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await closeServer(server);
    } catch (error) {
      errors.push(error);
    }
    errors.push(...failures);
    if (errors.length)
      throw new AggregateError(errors, 'owned TCP drain failed');
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await bounded(listening, 'owned TCP listener start deadline');
  const socket = trackSocket(
    net.createConnection({
      host: '127.0.0.1',
      port: server.address().port,
    }),
    sockets,
    failures,
  );
  await bounded(once(socket, 'connect'), 'owned TCP connect deadline');
  return { socket, accepted: await accepted };
}

export async function udpSocket(fixture) {
  const socket = dgram.createSocket('udp4');
  const failures = [];
  socket.on('error', (error) => failures.push(error));
  fixture.defer(async () => {
    await bounded(
      new Promise((resolve) => socket.close(resolve)),
      'owned UDP close',
    );
    assert.deepEqual(failures, []);
  });
  socket.bind(0, '127.0.0.1');
  await bounded(once(socket, 'listening'), 'owned UDP bind deadline');
  return socket;
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === '--peer'
) {
  const [, , , path, nonce, claim] = process.argv;
  const socket = net.createConnection(path);
  socket.resume();
  socket.once('connect', () => {
    socket.write(`${JSON.stringify({ nonce, declaredPid: Number(claim) })}\n`);
  });
  process.on('message', (message) => {
    if (message === 'stop') socket.end();
  });
  socket.on('error', () => {
    process.exitCode = 1;
  });
  socket.once('close', () => {
    if (process.connected) process.disconnect();
  });
  process.once('disconnect', () => socket.destroy());
}
