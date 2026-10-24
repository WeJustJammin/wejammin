import { spawn } from 'node:child_process';
import {
  ensure,
  failure,
  reservedOwnerChannelState,
} from './receiving-bootstrap-artifacts.mjs';
import {
  before,
  channelSnapshot,
  ownerStreamsClosed,
  ownerStreamsPresent,
  watchChild,
  watchReadable,
  watchWritable,
} from './receiving-bootstrap-resources.mjs';
import { ENVIRONMENT, INPUT } from './receiving-bootstrap-profile.mjs';
import {
  createFrameDecoder,
  encodeFrame,
} from './receiving-bootstrap-protocol.mjs';
import {
  assertSealedWorkspace,
  workspaceInfo,
} from './receiving-bootstrap-workspaces.mjs';

const records = new WeakMap();
const retained = new Set();
let reserved = false;
const fail = (record, error) => {
  record.failure ??= { error };
};

function state(key, argc, expected = 1) {
  const record = records.get(key);
  ensure(
    argc === expected && record !== undefined,
    'DEC203_SUPERVISOR_REFUSED',
  );
  return record;
}

export function reserveOwnerChannel() {
  ensure(arguments.length === 0 && !reserved, 'DEC203_SUPERVISOR_REFUSED');
  reserved = true;
  const key = Object.freeze({});
  const record = reservedOwnerChannelState();
  records.set(key, record);
  retained.add(record);
  return key;
}

function queue(record, value) {
  ensure(record.frames.length < 16, 'DEC203_SUPERVISOR_HISTORY_GAP');
  record.frames.push(value);
}

function receive(record, frame) {
  ensure(!record.arrived.has(frame.kind), 'DEC203_SUPERVISOR_PROTOCOL');
  const prerequisite = {
    LEASE_READY: 'INIT',
    ADOPTION_ACK: 'START',
    CANCEL_ACK: 'CANCEL',
  }[frame.kind];
  if (prerequisite !== undefined)
    ensure(record.issued.has(prerequisite), 'DEC203_SUPERVISOR_PROTOCOL');
  if (frame.kind === 'HELLO')
    ensure(record.arrived.size === 0, 'DEC203_SUPERVISOR_PROTOCOL');
  if (frame.kind === 'TERMINAL')
    ensure(record.arrived.has('CANCEL_ACK'), 'DEC203_SUPERVISOR_PROTOCOL');
  record.arrived.add(frame.kind);
  queue(record, Object.freeze({ direction: 'C_TO_O', frame }));
}

function endWriters(record) {
  if (!record.finishing || record.pending.size) return;
  const child = record.child;
  if (child === null) return;
  for (const [name, stream] of [
    ['input', child.stdin],
    ['commandsWrite', child.stdio?.[3]],
    ['eventsWrite', child.stdio?.[4]],
  ]) {
    if (stream === null || stream === undefined || record.ended.has(name))
      continue;
    record.ended.add(name);
    try {
      stream.end();
    } catch (error) {
      fail(record, error);
    }
  }
}

export function initializeOwnerChannel(key, workspace, bootstrapId) {
  const record = state(key, arguments.length, 3);
  ensure(!record.initialized, 'DEC203_SUPERVISOR_REFUSED');
  record.initialized = true;
  ensure(
    typeof bootstrapId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        bootstrapId,
      ),
    'DEC203_SUPERVISOR_REFUSED',
  );
  assertSealedWorkspace(workspace);
  const info = workspaceInfo(workspace, 'owner');
  record.id = bootstrapId;
  record.decoder = createFrameDecoder(bootstrapId, 'C_TO_O');
  record.spawnAttempted = true;
  record.child = spawn(info.output.path, [bootstrapId], {
    cwd: info.root,
    env: ENVIRONMENT,
    shell: false,
    detached: false,
    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
  });
  const child = record.child;
  child.on('error', (error) => {
    fail(record, error);
  });
  for (const stream of new Set(child.stdio ?? []))
    if (stream)
      stream.on('error', (error) => {
        fail(record, error);
      });
  record.wait = watchChild(child);
  for (const socket of [child.stdio?.[3], child.stdio?.[4]])
    if (socket) socket.allowHalfOpen = true;
  record.streams.input = watchWritable(child.stdin);
  record.streams.stdout = watchReadable(child.stdout);
  record.streams.stderr = watchReadable(child.stderr);
  record.streams.commandsRead = watchReadable(child.stdio?.[3]);
  record.streams.commandsWrite = watchWritable(child.stdio?.[3]);
  record.streams.eventsRead = watchReadable(child.stdio?.[4]);
  record.streams.eventsWrite = watchWritable(child.stdio?.[4]);
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    let size = 0;
    stream.on('data', (bytes) => {
      size += bytes.length;
      if (size > 65_536) fail(record, failure('DEC203_SUPERVISOR_HISTORY_GAP'));
    });
  }
  child.stdio?.[3]?.on('data', (bytes) => {
    if (bytes.length) fail(record, failure('DEC203_SUPERVISOR_PROTOCOL'));
  });
  child.stdio?.[4]?.on('data', (bytes) => {
    if (record.decoderFatal) return;
    try {
      for (const frame of record.decoder.feed(bytes)) receive(record, frame);
    } catch (error) {
      record.decoderFatal = true;
      fail(record, error);
    }
  });
  child.stdio?.[4]?.once('end', () => {
    if (record.decoderFatal) return;
    try {
      record.decoder.end();
    } catch (error) {
      record.decoderFatal = true;
      fail(record, error);
    }
  });
}

function write(record, kind, body) {
  ensure(
    record.child !== null && !record.slots.has(kind),
    'DEC203_SUPERVISOR_REFUSED',
  );
  ensure(
    kind === 'CANCEL' || !record.slots.has('CANCEL'),
    'DEC203_SUPERVISOR_CANCELLED',
  );
  record.slots.add(kind);
  record.seq += 1n;
  const frame = Object.freeze({
    v: 1,
    bootstrapId: record.id,
    seq: String(record.seq),
    kind,
    body: Object.freeze(body),
  });
  const bytes = encodeFrame(frame, record.id, 'O_TO_C');
  const pending = { completed: false };
  record.pending.add(pending);
  const promise = new Promise((resolve, reject) => {
    const complete = (error) => {
      if (pending.completed) {
        fail(record, failure('DEC203_SUPERVISOR_PROTOCOL'));
        return;
      }
      pending.completed = true;
      record.pending.delete(pending);
      try {
        if (error) throw error;
        record.written.add(kind);
        queue(record, Object.freeze({ direction: 'O_TO_C', frame }));
        if (kind === 'START') {
          ensure(!record.ended.has('input'), 'DEC203_SUPERVISOR_PROTOCOL');
          record.ended.add('input');
          ensure(
            record.child.stdin !== null && record.child.stdin !== undefined,
            'DEC203_SUPERVISOR_HISTORY_GAP',
          );
          record.child.stdin.end(INPUT);
        }
        resolve();
      } catch (caught) {
        fail(record, caught);
        reject(caught);
      }
      endWriters(record);
    };
    try {
      const stream = record.child.stdio?.[3];
      ensure(
        stream !== null && stream !== undefined,
        'DEC203_SUPERVISOR_HISTORY_GAP',
      );
      record.issued.add(kind);
      stream.write(bytes, complete);
    } catch (error) {
      complete(error);
    }
  });
  promise.catch((error) => {
    fail(record, error);
  });
  return promise;
}

export function sendOwnerInit(key) {
  return write(state(key, arguments.length), 'INIT', {});
}

export function sendOwnerStart(key) {
  return write(state(key, arguments.length), 'START', {});
}

export function sendOwnerCancel(key, reason) {
  return write(state(key, arguments.length, 2), 'CANCEL', { reason });
}

export function takeOwnerFrame(key) {
  const record = state(key, arguments.length);
  return record.frames.shift() ?? null;
}

export function ownerChannelView(key) {
  const record = state(key, arguments.length);
  ensure(record.child !== null, 'DEC203_SUPERVISOR_REFUSED');
  return Object.freeze({
    child: record.child,
    wait: record.wait,
    ...record.streams,
    failure: () => record.failure,
    present: () => ownerStreamsPresent(record.wait, record.streams),
    initWritten: () => record.written.has('INIT'),
    startWritten: () => record.written.has('START'),
    snapshot: () => channelSnapshot(record.wait, record.streams),
  });
}

export function finishOwnerChannel(key) {
  const record = state(key, arguments.length);
  record.finishing = true;
  endWriters(record);
}

export function ownerChannelClosed(key) {
  const record = state(key, arguments.length);
  if (record.child === null) return !record.spawnAttempted;
  const complete =
    record.pending.size === 0 &&
    ownerStreamsClosed(record.wait, record.streams);
  if (complete) retained.delete(record);
  return complete;
}

export function awaitOwnerChannel(key, deadline) {
  const record = state(key, arguments.length, 2);
  if (record.settlement !== null) return record.settlement;
  record.settlement = (async () => {
    const streams = Object.values(record.streams).filter(
      (value) => value !== null,
    );
    const owned = streams.map((value) => value.done);
    if (record.wait !== null) owned.push(record.wait.done);
    const closed = Promise.all(owned);
    return (await before(closed, deadline)) && ownerChannelClosed(key);
  })();
  record.settlement.catch((error) => {
    fail(record, error);
  });
  return record.settlement;
}
