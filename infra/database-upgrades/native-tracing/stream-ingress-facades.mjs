import { types } from 'node:util';
import { failure, removeOwnedOutput } from './peer-artifacts.mjs';
import {
  attestStream,
  observedStream,
  retainStreamBuild,
} from './stream-ingress-build.mjs';
import {
  acceptOwned,
  closeOwner,
  closeStreamEntry,
  markUnprovedConstruction,
  openOwner,
  receiveOwned,
  releaseEntry,
  requireOwned,
} from './stream-ingress-ownership.mjs';

// One registry for this module instance; neither diagnostics nor native DTOs enter it.
const facades = new WeakMap();
const error = (suffix) => failure('DEC203_STREAM_' + suffix);

function entryOf(receiver, kind, args, cleanup = false) {
  const entry = facades.get(receiver);
  if (!entry || entry.kind !== kind || types.isProxy(receiver))
    throw error('INVALID_CAPABILITY');
  const closed =
    entry.closed ||
    entry.owner.closed ||
    entry.stream?.closed ||
    entry.segment?.closed;
  if (closed) {
    if (cleanup) return entry;
    throw error('CAPABILITY_CLOSED');
  }
  if (args.length) throw error('PROTOCOL');
  return entry;
}

function closeIngress(...args) {
  try {
    return closeOwner(entryOf(this, 'owner', args, true));
  } catch (cause) {
    return Promise.reject(cause);
  }
}

function closeStream(...args) {
  closeStreamEntry(entryOf(this, 'stream', args, true));
}

function release(...args) {
  releaseEntry(entryOf(this, 'segment', args, true));
}

function copyBytes(...args) {
  const entry = entryOf(this, 'segment', args);
  return observedStream(entry.owner.build, () => {
    const bytes = entry.native.copyBytes();
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length === 0 ||
      bytes.length > 16 * 1024
    )
      throw error('PROTOCOL');
    return bytes;
  });
}

function read(...args) {
  const entry = entryOf(this, 'writer', args);
  try {
    return observedStream(entry.owner.build, () => {
      if (entry.exited) throw error('WRITER_EXITED');
      return entry.native.read();
    });
  } catch (cause) {
    if (cause.code === 'DEC203_STREAM_WRITER_EXITED') entry.exited = true;
    throw cause;
  }
}

function demand(entry) {
  observedStream(entry.owner.build, () => {
    if (entry.pending) throw error('LIMIT');
  });
  return new Promise((resolve, reject) => {
    entry.pending = { resolve, reject };
    entry.owner.wake(entry);
  });
}

async function accept(...args) {
  return demand(entryOf(this, 'owner', args));
}
async function receive(...args) {
  const entry = entryOf(this, 'stream', args);
  if (entry.eof) return observedStream(entry.owner.build, () => null);
  return demand(entry);
}

function register(entry, properties) {
  requireOwned(entry);
  entry.facade = Object.freeze(properties);
  facades.set(entry.facade, entry);
  return entry;
}

export function attemptAccept(owner) {
  requireOwned(owner);
  let entry;
  let nativeFailed = false;
  try {
    return observedStream(
      owner.build,
      () => {
        try {
          entry = acceptOwned(owner);
        } catch (cause) {
          nativeFailed = true;
          throw cause;
        }
        if (entry === undefined) return undefined;
        return register(entry, { receive, close: closeStream }).facade;
      },
      (primary) => {
        if (entry) {
          try {
            closeStreamEntry(entry, primary, primary);
          } finally {
            facades.delete(entry.facade);
          }
        }
      },
    );
  } catch (cause) {
    if (nativeFailed) closeOwner(owner, cause).catch(() => {});
    throw cause;
  }
}

export function attemptReceive(stream) {
  requireOwned(stream);
  let entry;
  let nativeFailed = false;
  try {
    return observedStream(
      stream.owner.build,
      () => {
        try {
          entry = receiveOwned(stream);
        } catch (cause) {
          nativeFailed = true;
          throw cause;
        }
        if (entry === undefined || entry === null) return entry;
        register(entry.writer, { read });
        return register(entry, {
          copyBytes,
          writer: entry.writer.facade,
          release,
        }).facade;
      },
      (primary) => {
        if (entry) {
          try {
            releaseEntry(entry, primary);
          } finally {
            facades.delete(entry.facade);
            facades.delete(entry.writer.facade);
          }
        }
      },
    );
  } catch (cause) {
    if (nativeFailed) {
      try {
        closeStreamEntry(stream, cause, cause);
      } catch (secondary) {
        stream.owner.build.state.failures.push(secondary);
      }
    }
    throw cause;
  }
}

export function createStreamFacade(build) {
  attestStream(build);
  if (build.state.identity !== undefined) throw error('INVALID_CAPABILITY');
  let owner;
  try {
    return observedStream(
      build,
      () => {
        owner = openOwner(build);
        register(owner, {
          accept,
          close: closeIngress,
          endpoint: 'unix://' + build.state.identity.socket.path,
          identity: build.state.identity,
          metadata: build.metadata,
        });
        return owner;
      },
      () => {
        if (owner) {
          build.state.constructionCleanup = closeOwner(owner);
          build.state.constructionCleanup.catch(() => {});
          facades.delete(owner.facade);
        }
      },
    );
  } catch (cause) {
    if (build.state.cleanupFailed) markUnprovedConstruction(build, cause);
    else if (!build.state.constructionCleanup) {
      try {
        removeOwnedOutput(build.run, build.metadata.output);
      } catch (secondary) {
        retainStreamBuild(build, secondary);
        markUnprovedConstruction(build, cause);
      }
    }
    throw cause;
  }
}
