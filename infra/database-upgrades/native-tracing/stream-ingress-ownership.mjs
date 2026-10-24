import { types } from 'node:util';
import { failure, removeOwnedOutput } from './peer-artifacts.mjs';
import { attestStream, retainStreamBuild } from './stream-ingress-build.mjs';
import { captureStreamIdentity } from './stream-ingress-output.mjs';

const owners = new WeakSet();
const streams = new WeakSet();
const segments = new WeakSet();
const writers = new WeakSet();
const error = (suffix) => failure(`DEC203_STREAM_${suffix}`);

export function requireOwned(entry) {
  if (
    !owners.has(entry) &&
    !streams.has(entry) &&
    !segments.has(entry) &&
    !writers.has(entry)
  ) {
    throw error('INVALID_CAPABILITY');
  }
  return entry;
}

function nativeHandle(value, methods, data = []) {
  const keys = [...methods, ...data];
  if (
    value === null ||
    typeof value !== 'object' ||
    types.isProxy(value) ||
    !Object.isFrozen(value) ||
    Reflect.ownKeys(value).length !== keys.length ||
    Reflect.ownKeys(value).some((key) => !keys.includes(key)) ||
    keys.some(
      (key) =>
        !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'),
    ) ||
    methods.some(
      (key) => typeof value[key] !== 'function' || types.isProxy(value[key]),
    )
  )
    throw error('PROTOCOL');
}

export function settleDemand(entry, failed, value) {
  requireOwned(entry);
  const pending = entry.pending;
  entry.pending = undefined;
  if (pending) pending[failed ? 'reject' : 'resolve'](value);
}

function revokeStream(entry, reason) {
  entry.closed = true;
  settleDemand(entry, true, reason);
  for (const segment of entry.segments) {
    segment.closed = true;
    segment.writer.closed = true;
  }
  entry.owner.segmentCount -= entry.segments.size;
  entry.segments.clear();
  entry.owner.streams.delete(entry);
}

function cleanup(entry, operation, primary) {
  try {
    operation();
  } catch (cause) {
    retainStreamBuild(entry.owner.build, cause, entry);
    if (!entry.owner.closed)
      closeOwner(entry.owner, primary ?? cause).catch(() => {});
    throw cause;
  }
}

export function closeOwner(owner, primary) {
  if (!owners.has(owner)) throw error('INVALID_CAPABILITY');
  if (owner.closing) return owner.closing;
  owner.closed = true;
  owner.stop?.();
  const reason = primary ?? error('CAPABILITY_CLOSED');
  settleDemand(owner, true, reason);
  for (const stream of owner.streams) revokeStream(stream, reason);
  const failures = primary === undefined ? [] : [primary];
  try {
    owner.native.close();
  } catch (cause) {
    failures.push(cause);
    retainStreamBuild(owner.build, cause, owner);
  }
  owner.closing = Promise.resolve().then(() => {
    if (!owner.build.state.cleanupFailed) {
      try {
        removeOwnedOutput(owner.build.run, owner.build.metadata.output);
      } catch (cause) {
        failures.push(cause);
        retainStreamBuild(owner.build, cause, owner);
      }
    }
    if (failures.length) throw failures[0];
    if (owner.build.state.cleanupFailed) throw owner.build.state.cleanupError;
  });
  return owner.closing;
}

export function closeStreamEntry(
  entry,
  reason = error('CAPABILITY_CLOSED'),
  primary,
) {
  if (!streams.has(entry)) throw error('INVALID_CAPABILITY');
  if (entry.closed) return;
  revokeStream(entry, reason);
  try {
    cleanup(entry, () => entry.native.close(), primary);
  } finally {
    entry.owner.wake?.(entry);
  }
}

export function releaseEntry(entry, primary) {
  if (!segments.has(entry)) throw error('INVALID_CAPABILITY');
  if (entry.closed) return;
  entry.closed = true;
  entry.writer.closed = true;
  entry.stream.segments.delete(entry);
  entry.owner.segmentCount--;
  try {
    cleanup(entry, () => entry.native.release(), primary);
  } finally {
    entry.owner.wake?.(entry.stream);
  }
}

export function markUnprovedConstruction(build, cause, owned) {
  retainStreamBuild(build, cause, owned);
  try {
    Object.defineProperty(cause, 'diagnostics', {
      value: Object.freeze({ drainProven: false }),
      configurable: true,
    });
  } catch (secondary) {
    build.state.failures.push(secondary);
  }
}

export function openOwner(build) {
  attestStream(build);
  if (build.state.identity !== undefined) throw error('INVALID_CAPABILITY');
  let native;
  let validated = false;
  let owner;
  try {
    native = build.addon.createIngress(build.run.path);
    nativeHandle(native, ['accept', 'close']);
    validated = true;
    owner = {
      kind: 'owner',
      native,
      build,
      closed: false,
      pending: undefined,
      streams: new Set(),
      segmentCount: 0,
      closing: undefined,
    };
    owner.owner = owner;
    owners.add(owner);
    build.state.identity = captureStreamIdentity(build.run);
    return owner;
  } catch (cause) {
    if (validated) {
      if (owner) owner.closed = true;
      try {
        native.close();
      } catch (secondary) {
        build.state.failures.push(secondary);
        markUnprovedConstruction(build, cause, owner ?? native);
      }
    } else markUnprovedConstruction(build, cause, native);
    throw cause;
  }
}

export function acceptOwned(owner) {
  if (!owners.has(owner)) throw error('INVALID_CAPABILITY');
  if (owner.closed) throw error('CAPABILITY_CLOSED');
  const native = owner.native.accept();
  if (native === undefined) return undefined;
  let entry;
  try {
    nativeHandle(native, ['receive', 'close']);
    entry = {
      kind: 'stream',
      owner,
      native,
      closed: false,
      eof: false,
      pending: undefined,
      segments: new Set(),
    };
    streams.add(entry);
    owner.streams.add(entry);
    return entry;
  } catch (cause) {
    if (entry) {
      entry.closed = true;
      owner.streams.delete(entry);
    }
    try {
      native.close();
    } catch (secondary) {
      retainStreamBuild(owner.build, secondary, entry ?? native);
    }
    throw cause;
  }
}

export function receiveOwned(stream) {
  if (!streams.has(stream)) throw error('INVALID_CAPABILITY');
  if (stream.closed || stream.owner.closed) throw error('CAPABILITY_CLOSED');
  const native = stream.native.receive();
  if (native === null) stream.eof = true;
  if (native === undefined || native === null) return native;
  let entry;
  try {
    nativeHandle(native, ['copyBytes', 'release'], ['writer']);
    nativeHandle(native.writer, ['read']);
    entry = {
      kind: 'segment',
      owner: stream.owner,
      stream,
      native,
      closed: false,
      writer: undefined,
    };
    entry.writer = {
      kind: 'writer',
      owner: stream.owner,
      segment: entry,
      native: native.writer,
      closed: false,
      exited: false,
    };
    segments.add(entry);
    writers.add(entry.writer);
    stream.segments.add(entry);
    stream.owner.segmentCount++;
    return entry;
  } catch (cause) {
    if (entry) {
      entry.closed = true;
      if (entry.writer) entry.writer.closed = true;
    }
    try {
      native.release();
    } catch (secondary) {
      retainStreamBuild(stream.owner.build, secondary, entry ?? native);
    }
    throw cause;
  }
}
