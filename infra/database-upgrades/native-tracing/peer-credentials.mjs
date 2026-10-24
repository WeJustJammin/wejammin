import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  realpathSync,
} from 'node:fs';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import {
  artifact,
  assertArtifacts,
  assertDirectory,
  directory,
  executable,
  failure,
  removeOwnedOutput,
  reserveOutput,
} from './peer-artifacts.mjs';
import { compilePeer } from './peer-build.mjs';

const SOURCE = fileURLToPath(new URL('./peer-credentials.c', import.meta.url));
const HEADERS = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
const SOCKET_HANDLE_GETTER = Object.getOwnPropertyDescriptor(
  Socket.prototype,
  '_handle',
)?.get;

function requireRuntime() {
  if (
    process.platform !== 'linux' ||
    process.version !== 'v22.23.1' ||
    !Number.isInteger(Number(process.versions.napi)) ||
    Number(process.versions.napi) < 8 ||
    typeof process.getuid !== 'function'
  ) {
    throw failure('DEC203_NATIVE_UNAVAILABLE');
  }
}

function requireOptions(options) {
  const expected = ['compilerPath', 'includeDirectory', 'runDirectory'];
  if (
    options === null ||
    typeof options !== 'object' ||
    types.isProxy(options) ||
    Reflect.ownKeys(options).length !== expected.length ||
    expected.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(options, key);
      return (
        !descriptor ||
        !('value' in descriptor) ||
        typeof descriptor.value !== 'string'
      );
    }) ||
    Reflect.ownKeys(options).some((key) => !expected.includes(key))
  ) {
    throw failure('DEC203_INVALID_BUILD');
  }
}

function loadAddon(output, records) {
  let descriptor;
  try {
    assertArtifacts(records);
    descriptor = openSync(
      output.path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const pinned = fstatSync(descriptor, { bigint: true });
    if (
      String(pinned.dev) !== output.device ||
      String(pinned.ino) !== output.inode ||
      Number(pinned.size) !== output.size ||
      Number(pinned.mode) !== output.mode ||
      Number(pinned.uid) !== output.uid
    ) {
      throw failure('DEC203_IDENTITY_CHANGED');
    }
    const loaded = { exports: {} };
    process.dlopen(loaded, output.path);
    assertArtifacts(records);
    if (
      Object.getOwnPropertyNames(loaded.exports).length !== 1 ||
      typeof loaded.exports.readPeerCredentials !== 'function'
    ) {
      throw failure('DEC203_COMPILER_FAILED');
    }
    return loaded.exports;
  } catch (error) {
    if (error.code === 'DEC203_IDENTITY_CHANGED') throw error;
    throw failure('DEC203_COMPILER_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

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
  if (Object.hasOwn(socket, '_handle')) throw failure('DEC203_INVALID_SOCKET');
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
    throw failure('DEC203_INVALID_SOCKET');
  }
  const pipe = Object.getPrototypeOf(handle);
  const stream = pipe && !types.isProxy(pipe) && Object.getPrototypeOf(pipe);
  if (!stream || types.isProxy(stream)) throw failure('DEC203_INVALID_SOCKET');
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
    throw failure('DEC203_INVALID_SOCKET');
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
      throw failure('DEC203_INVALID_SOCKET');
    }
    const descriptor = ownedSocketDescriptor(socket);
    if (
      !Number.isInteger(descriptor) ||
      descriptor < 0 ||
      descriptor > 0x7fffffff
    ) {
      throw failure('DEC203_INVALID_SOCKET');
    }
    return descriptor;
  } catch {
    throw failure('DEC203_INVALID_SOCKET');
  }
}

function capability(addon, metadata, records, run) {
  let revoked = false;
  let closing;
  function read(socket) {
    if (revoked) throw failure('DEC203_CAPABILITY_CLOSED');
    assertDirectory(run);
    assertArtifacts(records);
    const result = addon.readPeerCredentials(socketDescriptor(socket));
    assertArtifacts(records);
    return Object.freeze(result);
  }
  async function close() {
    revoked = true;
    closing ??= Promise.resolve().then(() => {
      removeOwnedOutput(run, metadata.output);
    });
    return closing;
  }
  return Object.freeze({ read, close, metadata });
}

function prepareBuild(options) {
  const run = directory(options.runDirectory, true);
  const headersDirectory = directory(options.includeDirectory);
  const source = artifact(SOURCE);
  const compiler = artifact(options.compilerPath);
  executable(compiler);
  const headers = Object.freeze(
    HEADERS.map((name) => artifact(join(headersDirectory.path, name))),
  );
  const inputs = [source, compiler, ...headers];
  const reserved = reserveOutput(run);
  return { run, headersDirectory, source, compiler, headers, inputs, reserved };
}

function finishBuild(build) {
  const { run, headersDirectory, source, compiler, headers, inputs, reserved } =
    build;
  assertDirectory(run);
  assertDirectory(headersDirectory);
  assertArtifacts(inputs);
  const output = artifact(reserved.path, 'DEC203_COMPILER_FAILED');
  if (
    output.device !== reserved.device ||
    output.inode !== reserved.inode ||
    output.uid !== reserved.uid ||
    output.size === 0
  ) {
    throw failure('DEC203_IDENTITY_CHANGED');
  }
  const records = Object.freeze([...inputs, output]);
  const metadata = Object.freeze({
    node: Object.freeze({
      path: realpathSync(process.execPath),
      version: process.version,
      napi: 8,
    }),
    source,
    compiler,
    headers,
    output,
  });
  const addon = loadAddon(output, records);
  return capability(addon, metadata, records, run);
}

export async function buildPeerCredentialReader(options) {
  requireRuntime();
  requireOptions(options);
  const build = prepareBuild(options);
  let mayClean = true;
  try {
    assertDirectory(build.headersDirectory);
    assertArtifacts(build.inputs);
    mayClean = false;
    await compilePeer({
      compiler: build.compiler.path,
      includeDirectory: build.headersDirectory.path,
      output: build.reserved,
      run: build.run,
    });
    mayClean = true;
    return finishBuild(build);
  } catch (error) {
    mayClean ||= error.diagnostics?.drainProven === true;
    if (mayClean) {
      try {
        removeOwnedOutput(build.run, build.reserved);
      } catch {
        error.cleanupFailed = true;
      }
    }
    throw error;
  }
}
