import { performance } from 'node:perf_hooks';
import { ERRORS, UID } from './receiving-bootstrap-profile.mjs';

const streams = new WeakMap();
const children = new WeakMap();

export function failure(code, cause) {
  const token = ERRORS.includes(code) ? code : 'DEC203_SUPERVISOR_REFUSED';
  const error = new Error(token, { cause });
  error.code = token;
  return error;
}

export function ensure(condition, code = 'DEC203_SUPERVISOR_IDENTITY_CHANGED') {
  if (!condition) throw failure(code);
}

export const stamp = (stat) =>
  [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.uid,
    stat.gid,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ]
    .map(String)
    .join(':');

export function validateOwnedStat(held, birth, directory) {
  ensure(
    held.dev === birth.dev &&
      held.ino === birth.ino &&
      held.uid === BigInt(UID),
  );
  ensure(
    directory ? held.isDirectory() && held.mode === 0o040700n : held.isFile(),
  );
  return held;
}

export function validateUnsealedOutput(stat) {
  ensure(stat.isFile() && stat.uid === BigInt(UID) && stat.mode === 0o100600n);
}

export function validateCompiledMode(mode, phase) {
  ensure(
    arguments.length === 2 && (phase === 'owner' || phase === 'lease'),
    'DEC203_SUPERVISOR_REFUSED',
  );
  const withoutOwnerX = [0o100600, 0o100601, 0o100610, 0o100611];
  const withOwnerX = [0o100700, 0o100701, 0o100710, 0o100711];
  const modes = withoutOwnerX.concat(withOwnerX);
  ensure(typeof mode === 'number' && modes.includes(mode));
}

export function throwFileCloseErrors(errors) {
  if (errors.length)
    throw new AggregateError(errors, 'owned workspace close', {
      cause: errors[0],
    });
}

export function watchReadable(stream) {
  if (stream === null || stream === undefined) return null;
  const state = {
    ended: false,
    closed: false,
    failed: false,
    error: undefined,
  };
  const done = new Promise((resolve) => {
    stream.once('end', () => {
      state.ended = true;
    });
    stream.on('error', (error) => {
      if (!state.failed) state.error = error;
      state.failed = true;
    });
    stream.once('close', () => {
      state.closed = true;
      resolve();
    });
  });
  const view = Object.freeze({
    stream,
    done,
    closed: () => state.closed,
    status: () => (state.failed ? 'error' : state.ended ? 'eof' : 'pending'),
    failure: () => (state.failed ? { error: state.error } : null),
  });
  streams.set(view, { stream, kind: 'read' });
  return view;
}

export function watchWritable(stream) {
  if (stream === null || stream === undefined) return null;
  const state = {
    finished: false,
    closed: false,
    failed: false,
    error: undefined,
  };
  const done = new Promise((resolve) => {
    stream.once('finish', () => {
      state.finished = true;
    });
    stream.on('error', (error) => {
      if (!state.failed) state.error = error;
      state.failed = true;
    });
    stream.once('close', () => {
      state.closed = true;
      resolve();
    });
  });
  const view = Object.freeze({
    stream,
    done,
    closed: () => state.closed,
    status: () =>
      state.failed ? 'error' : state.finished ? 'finished' : 'pending',
    failure: () => (state.failed ? { error: state.error } : null),
  });
  streams.set(view, { stream, kind: 'write' });
  return view;
}

export function watchChild(child) {
  const state = {
    spawned: false,
    exited: false,
    closed: false,
    failed: false,
    error: undefined,
    code: null,
    signal: null,
  };
  const done = new Promise((resolve) => {
    child.once('spawn', () => {
      state.spawned = true;
    });
    child.on('error', (error) => {
      if (!state.failed) state.error = error;
      state.failed = true;
    });
    child.once('exit', () => {
      state.exited = true;
    });
    child.once('close', (code, signal) => {
      state.closed = true;
      state.code = code;
      state.signal = signal;
      resolve();
    });
  });
  const view = Object.freeze({
    child,
    done,
    snapshot: () => Object.freeze({ ...state }),
  });
  children.set(view, { child, state });
  return view;
}

function original(wait) {
  const record = children.get(wait);
  ensure(record !== undefined, 'DEC203_SUPERVISOR_REFUSED');
  return record;
}

function ownerStreams(child) {
  return {
    input: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    commandsRead: child.stdio?.[3],
    commandsWrite: child.stdio?.[3],
    eventsRead: child.stdio?.[4],
    eventsWrite: child.stdio?.[4],
  };
}

function matches(view, stream, kind) {
  const record = streams.get(view);
  return (
    stream !== null &&
    stream !== undefined &&
    record !== undefined &&
    record.stream === stream &&
    record.kind === kind
  );
}

const kind = (role) =>
  role === 'input' || role.endsWith('Write') ? 'write' : 'read';

function closed(wait, pairs) {
  const record = original(wait);
  const unallocated =
    !record.state.spawned &&
    record.state.failed &&
    !Number.isSafeInteger(record.child.pid);
  return (
    record.state.closed &&
    pairs.every(([view, stream, role]) =>
      stream === null || stream === undefined
        ? unallocated && view === null
        : matches(view, stream, role) &&
          view.closed() &&
          view.status() !== 'pending',
    )
  );
}

export function ownerStreamsPresent(wait, values) {
  const record = original(wait);
  const expected = Object.entries(ownerStreams(record.child));
  return (
    record.state.spawned &&
    Object.keys(values).length === expected.length &&
    expected.every(([role, stream]) =>
      matches(values[role], stream, kind(role)),
    )
  );
}

export function ownerStreamsClosed(wait, values) {
  const expected = Object.entries(ownerStreams(original(wait).child));
  return (
    Object.keys(values).length === expected.length &&
    expected.every(([role]) => Object.hasOwn(values, role)) &&
    closed(
      wait,
      expected.map(([role, stream]) => [values[role], stream, kind(role)]),
    )
  );
}

export function compilerStreamsClosed(wait, stdout, stderr) {
  const child = original(wait).child;
  return closed(wait, [
    [stdout, child.stdout, 'read'],
    [stderr, child.stderr, 'read'],
  ]);
}

export function channelSnapshot(wait, values) {
  const child = original(wait).state;
  const expected = ownerStreams(original(wait).child);
  const channels = Object.fromEntries(
    [
      ['ownerInput', 'input'],
      ['ownerStdout', 'stdout'],
      ['ownerStderr', 'stderr'],
      ['commands', 'commandsWrite'],
      ['events', 'eventsRead'],
    ].map(([name, role]) => {
      const view = values[role];
      ensure(
        view === null || matches(view, expected[role], kind(role)),
        'DEC203_SUPERVISOR_REFUSED',
      );
      return [name, view?.status() ?? 'pending'];
    }),
  );
  return Object.freeze({
    wait: Object.freeze({
      closed: child.closed,
      code: child.code,
      signal: child.signal,
    }),
    channels: Object.freeze(channels),
  });
}

export async function before(promise, deadline) {
  ensure(Number.isFinite(deadline), 'DEC203_SUPERVISOR_REFUSED');
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(
          () => resolve(false),
          Math.max(0, deadline - performance.now()),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
