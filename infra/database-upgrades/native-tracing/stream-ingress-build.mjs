import { realpathSync } from 'node:fs';
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
} from './peer-artifacts.mjs';
import { compileStream } from './stream-ingress-compiler.mjs';
import {
  captureStreamIdentity,
  isUncertainStreamLoad,
  loadStreamAddon,
  reserveStreamOutput,
} from './stream-ingress-output.mjs';

const SOURCE = fileURLToPath(new URL('./stream-ingress.c', import.meta.url));
const SUPPORT = [
  'stream-ingress-listener.h',
  'stream-ingress-receive.h',
  'stream-ingress-state.h',
  'stream-ingress-values.h',
  'stream-ingress-writer.h',
];
const HEADERS = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
const retainedBuilds = new Set();
const admittedBuilds = new WeakSet();

function requireRuntime() {
  if (
    process.platform !== 'linux' ||
    process.version !== 'v22.23.1' ||
    !Number.isInteger(Number(process.versions.napi)) ||
    Number(process.versions.napi) < 8 ||
    typeof process.getuid !== 'function'
  )
    throw failure('DEC203_NATIVE_UNAVAILABLE');
}

function requireOptions(options) {
  const keys = ['compilerPath', 'includeDirectory', 'runDirectory'];
  if (
    options === null ||
    typeof options !== 'object' ||
    types.isProxy(options) ||
    Reflect.ownKeys(options).length !== keys.length ||
    Reflect.ownKeys(options).some((key) => !keys.includes(key)) ||
    keys.some((key) => {
      const property = Object.getOwnPropertyDescriptor(options, key);
      return (
        !property ||
        !('value' in property) ||
        typeof property.value !== 'string'
      );
    })
  )
    throw failure('DEC203_INVALID_BUILD');
}

export function retainStreamBuild(build, error, owned) {
  if (!admittedBuilds.has(build))
    throw failure('DEC203_STREAM_INVALID_CAPABILITY');
  build.state.failures.push(error);
  if (!build.state.cleanupFailed) build.state.cleanupError = error;
  build.state.cleanupFailed = true;
  if (owned !== undefined) build.state.uncertain.add(owned);
  retainedBuilds.add(build);
}

export function attestStream(build) {
  if (!admittedBuilds.has(build))
    throw failure('DEC203_STREAM_INVALID_CAPABILITY');
  try {
    requireRuntime();
    assertDirectory(build.run);
    assertDirectory(build.headersDirectory);
    assertArtifacts(build.records);
    if (realpathSync(process.execPath) !== build.metadata.node.path) {
      throw failure('DEC203_IDENTITY_CHANGED');
    }
    if (
      build.state.identity &&
      JSON.stringify(captureStreamIdentity(build.run)) !==
        JSON.stringify(build.state.identity)
    )
      throw failure('DEC203_IDENTITY_CHANGED');
  } catch (error) {
    if (
      error.code === 'DEC203_IDENTITY_CHANGED' ||
      /^E[A-Z0-9]+$/.test(error.code ?? '')
    )
      throw failure('DEC203_STREAM_IDENTITY_CHANGED');
    if (error.code === 'DEC203_NATIVE_UNAVAILABLE')
      throw failure('DEC203_STREAM_UNAVAILABLE');
    throw error;
  }
}

export function observedStream(build, operation, unwind) {
  attestStream(build);
  let result;
  let primary;
  let failed = false;
  try {
    result = operation();
  } catch (error) {
    primary = error;
    failed = true;
  }
  try {
    attestStream(build);
  } catch (error) {
    if (failed) build.state.failures.push(error);
    else primary = error;
    failed = true;
  }
  if (failed) {
    try {
      unwind?.(primary);
    } catch (error) {
      retainStreamBuild(build, error);
    }
    throw primary;
  }
  return result;
}

function prepareBuild(options) {
  const run = directory(options.runDirectory, true);
  if (
    /\r|\n/.test(run.path) ||
    Buffer.byteLength(join(run.path, 'docker.sock')) >= 108
  ) {
    throw failure('DEC203_INVALID_BUILD');
  }
  const headersDirectory = directory(options.includeDirectory);
  const source = artifact(SOURCE);
  const compiler = artifact(options.compilerPath);
  executable(compiler);
  const headers = Object.freeze(
    HEADERS.map((name) => artifact(join(headersDirectory.path, name))),
  );
  const supportSources = Object.freeze(
    SUPPORT.map((name) =>
      artifact(fileURLToPath(new URL(name, import.meta.url))),
    ),
  );
  const inputs = Object.freeze([
    source,
    compiler,
    ...headers,
    ...supportSources,
  ]);
  const reserved = reserveStreamOutput(run);
  return {
    run,
    headersDirectory,
    source,
    compiler,
    headers,
    supportSources,
    inputs,
    reserved,
  };
}

function finishBuild(prepared) {
  assertDirectory(prepared.run);
  assertDirectory(prepared.headersDirectory);
  assertArtifacts(prepared.inputs);
  const output = artifact(prepared.reserved.path, 'DEC203_COMPILER_FAILED');
  if (
    output.device !== prepared.reserved.device ||
    output.inode !== prepared.reserved.inode ||
    output.uid !== prepared.reserved.uid ||
    output.size === 0
  )
    throw failure('DEC203_IDENTITY_CHANGED');
  const records = Object.freeze([...prepared.inputs, output]);
  const metadata = Object.freeze({
    node: Object.freeze({
      path: realpathSync(process.execPath),
      version: process.version,
      napi: 8,
    }),
    source: prepared.source,
    compiler: prepared.compiler,
    headers: prepared.headers,
    supportSources: prepared.supportSources,
    output,
  });
  const build = Object.freeze({
    run: prepared.run,
    headersDirectory: prepared.headersDirectory,
    records,
    metadata,
    addon: loadStreamAddon(output, records),
    state: {
      identity: undefined,
      failures: [],
      uncertain: new Set(),
      cleanupFailed: false,
      cleanupError: undefined,
    },
  });
  admittedBuilds.add(build);
  return build;
}

export async function buildStream(options) {
  requireRuntime();
  requireOptions(options);
  const prepared = prepareBuild(options);
  let mayClean = true;
  try {
    assertDirectory(prepared.headersDirectory);
    assertArtifacts(prepared.inputs);
    mayClean = false;
    await compileStream({
      compiler: prepared.compiler.path,
      includeDirectory: prepared.headersDirectory.path,
      output: prepared.reserved,
      run: prepared.run,
    });
    mayClean = true;
    return finishBuild(prepared);
  } catch (error) {
    mayClean =
      (mayClean || error.diagnostics?.drainProven === true) &&
      !isUncertainStreamLoad(error);
    if (mayClean) {
      try {
        removeOwnedOutput(prepared.run, prepared.reserved);
      } catch (cleanup) {
        error.cleanupFailed = true;
        retainedBuilds.add({ prepared, error, cleanup });
      }
    } else retainedBuilds.add({ prepared, error });
    throw error;
  }
}
