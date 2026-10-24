import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  realpathSync,
} from 'node:fs';
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
import { compileLifetime } from './peer-lifetime-compiler.mjs';
import { reserveLifetimeOutput } from './peer-lifetime-output.mjs';

const SOURCE = fileURLToPath(new URL('./peer-lifetime.c', import.meta.url));
const SUPPORT = fileURLToPath(
  new URL('./peer-lifetime-state.h', import.meta.url),
);
const HEADERS = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
// An uncertain compiler already retains its child; retain its input ownership too.
const retainedBuilds = new Set();

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
      Reflect.ownKeys(loaded.exports).length !== 1 ||
      typeof loaded.exports.openPeerPidfd !== 'function'
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

export function attestLifetime(build) {
  assertDirectory(build.run);
  assertDirectory(build.headersDirectory);
  assertArtifacts(build.records);
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
  const supportSources = Object.freeze([artifact(SUPPORT)]);
  const inputs = Object.freeze([
    source,
    compiler,
    ...headers,
    ...supportSources,
  ]);
  const reserved = reserveLifetimeOutput(run);
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

function finishBuild(build) {
  const {
    run,
    headersDirectory,
    source,
    compiler,
    headers,
    supportSources,
    inputs,
    reserved,
  } = build;
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
    supportSources,
    output,
  });
  const addon = loadAddon(output, records);
  return Object.freeze({ run, headersDirectory, records, metadata, addon });
}

export async function buildLifetime(options) {
  requireRuntime();
  requireOptions(options);
  const build = prepareBuild(options);
  let mayClean = true;
  try {
    assertDirectory(build.headersDirectory);
    assertArtifacts(build.inputs);
    mayClean = false;
    await compileLifetime({
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
    } else {
      retainedBuilds.add(build);
    }
    throw error;
  }
}
