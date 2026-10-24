import { Socket } from 'node:net';
import { types } from 'node:util';
import { failure, removeOwnedOutput } from './peer-artifacts.mjs';
import { attestLifetime, buildLifetime } from './peer-lifetime-build.mjs';

const SOCKET_HANDLE_GETTER = Object.getOwnPropertyDescriptor(
  Socket.prototype,
  '_handle',
)?.get;
// Module-local, across this module's readers only. Never discover foreign facades.
const facades = new WeakMap();

function ownSymbolValue(object, description) {
  const symbols = Object.getOwnPropertySymbols(object).filter(
    (symbol) => symbol.description === description,
  );
  if (symbols.length !== 1) return undefined;
  const property = Object.getOwnPropertyDescriptor(object, symbols[0]);
  return property && 'value' in property ? property.value : undefined;
}

function isNativeFunction(value, name) {
  return (
    typeof value === 'function' &&
    !types.isProxy(value) &&
    (name === undefined ||
      Object.getOwnPropertyDescriptor(value, 'name')?.value === name) &&
    /\{\s*\[native code\]\s*\}$/.test(Function.prototype.toString.call(value))
  );
}

function ownedSocketDescriptor(socket) {
  if (Object.hasOwn(socket, '_handle'))
    throw failure('DEC203_PIDFD_INVALID_SOCKET');
  const handle = ownSymbolValue(socket, 'kHandle');
  if (
    !handle ||
    typeof handle !== 'object' ||
    types.isProxy(handle) ||
    typeof SOCKET_HANDLE_GETTER !== 'function' ||
    SOCKET_HANDLE_GETTER.call(socket) !== handle ||
    ownSymbolValue(handle, 'owner_symbol') !== socket ||
    !Object.hasOwn(handle, 'reading') ||
    Object.hasOwn(handle, 'fd')
  ) {
    throw failure('DEC203_PIDFD_INVALID_SOCKET');
  }
  const pipe = Object.getPrototypeOf(handle);
  const stream = pipe && !types.isProxy(pipe) && Object.getPrototypeOf(pipe);
  if (!stream || types.isProxy(stream))
    throw failure('DEC203_PIDFD_INVALID_SOCKET');
  const pipeConstructor = Object.getOwnPropertyDescriptor(pipe, 'constructor');
  const streamConstructor = Object.getOwnPropertyDescriptor(
    stream,
    'constructor',
  );
  const descriptor = Object.getOwnPropertyDescriptor(stream, 'fd');
  if (
    !isNativeFunction(pipeConstructor?.value, 'Pipe') ||
    !isNativeFunction(streamConstructor?.value, 'LibuvStreamWrap') ||
    !descriptor ||
    descriptor.set !== undefined ||
    !isNativeFunction(descriptor.get)
  ) {
    throw failure('DEC203_PIDFD_INVALID_SOCKET');
  }
  // Only the pinned, socket-owned Pipe shape reaches this native getter.
  return descriptor.get.call(handle);
}

function socketDescriptor(socket) {
  try {
    if (
      !(socket instanceof Socket) ||
      types.isProxy(socket) ||
      socket.destroyed
    ) {
      throw failure('DEC203_PIDFD_INVALID_SOCKET');
    }
    const descriptor = ownedSocketDescriptor(socket);
    if (
      !Number.isInteger(descriptor) ||
      descriptor < 0 ||
      descriptor > 0x7fffffff
    ) {
      throw failure('DEC203_PIDFD_INVALID_SOCKET');
    }
    return descriptor;
  } catch {
    throw failure('DEC203_PIDFD_INVALID_SOCKET');
  }
}

function registered(receiver) {
  if (
    receiver === null ||
    typeof receiver !== 'object' ||
    types.isProxy(receiver) ||
    !facades.has(receiver)
  ) {
    throw failure('DEC203_PIDFD_INVALID_CAPABILITY');
  }
  return facades.get(receiver);
}

function observed(build, operation) {
  attestLifetime(build);
  let result;
  let first;
  let failed = false;
  try {
    result = operation();
  } catch (error) {
    first = error;
    failed = true;
  }
  try {
    attestLifetime(build);
  } catch (error) {
    if (!failed) first = error;
    failed = true;
  }
  if (failed) throw first;
  return result;
}

function read() {
  const entry = registered(this);
  if (entry.closed || entry.owner.revoked)
    throw failure('DEC203_PIDFD_CAPABILITY_CLOSED');
  try {
    return observed(entry.owner.build, () => {
      if (entry.exited) throw failure('DEC203_PIDFD_PEER_EXITED');
      return entry.native.read();
    });
  } catch (error) {
    if (error.code === 'DEC203_PIDFD_PEER_EXITED') entry.exited = true;
    throw error;
  }
}

function close() {
  const entry = registered(this);
  if (entry.closed) return;
  entry.closed = true;
  entry.owner.entries.delete(entry);
  entry.native.close();
}

function capability(build) {
  const owner = {
    build,
    entries: new Set(),
    revoked: false,
    closing: undefined,
  };
  function open(socket) {
    if (owner.revoked) throw failure('DEC203_PIDFD_CAPABILITY_CLOSED');
    let native;
    let entry;
    try {
      observed(build, () => {
        native = build.addon.openPeerPidfd(socketDescriptor(socket));
      });
      const facade = Object.freeze({ read, close });
      entry = { owner, native, closed: false, exited: false };
      facades.set(facade, entry);
      owner.entries.add(entry);
      return facade;
    } catch (error) {
      if (entry) {
        entry.closed = true;
        owner.entries.delete(entry);
      }
      try {
        native?.close();
      } catch {
        error.cleanupFailed = true;
      }
      throw error;
    }
  }
  function closeReader() {
    if (owner.closing) return owner.closing;
    owner.revoked = true;
    const errors = [];
    for (const entry of owner.entries) entry.closed = true;
    for (const entry of owner.entries) {
      try {
        entry.native.close();
      } catch (error) {
        errors.push(error);
      }
    }
    owner.entries.clear();
    owner.closing = Promise.resolve().then(() => {
      try {
        removeOwnedOutput(build.run, build.metadata.output);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw errors[0];
    });
    return owner.closing;
  }
  return Object.freeze({ open, close: closeReader, metadata: build.metadata });
}

export async function buildPeerLifetimeReader(options) {
  return capability(await buildLifetime(options));
}
