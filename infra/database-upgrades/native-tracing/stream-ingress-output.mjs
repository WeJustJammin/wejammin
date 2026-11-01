import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  assertArtifacts,
  assertDirectory,
  failure,
} from './peer-artifacts.mjs';

const retainedBuilds = new Set();
const uncertainLoads = new WeakSet();

export function isUncertainStreamLoad(error) {
  return uncertainLoads.has(error);
}

export function loadStreamAddon(output, records) {
  let descriptor;
  let loaded;
  let primary;
  try {
    assertArtifacts(records);
    descriptor = openSync(
      output.path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const stat = fstatSync(descriptor, { bigint: true });
    if (
      String(stat.dev) !== output.device ||
      String(stat.ino) !== output.inode ||
      Number(stat.size) !== output.size ||
      Number(stat.mode) !== output.mode ||
      Number(stat.uid) !== output.uid
    )
      throw failure('DEC203_IDENTITY_CHANGED');
    loaded = { exports: {} };
    process.dlopen(loaded, output.path);
    assertArtifacts(records);
    const property = Object.getOwnPropertyDescriptor(
      loaded.exports,
      'createIngress',
    );
    if (
      Reflect.ownKeys(loaded.exports).length !== 1 ||
      !property ||
      !('value' in property) ||
      typeof property.value !== 'function'
    )
      throw failure('DEC203_COMPILER_FAILED');
  } catch (error) {
    primary =
      error.code === 'DEC203_IDENTITY_CHANGED'
        ? error
        : failure('DEC203_COMPILER_FAILED');
  }
  try {
    if (descriptor !== undefined) closeSync(descriptor);
  } catch (secondary) {
    primary ??= failure('DEC203_COMPILER_FAILED');
    uncertainLoads.add(primary);
    retainedBuilds.add({ output, descriptor, primary, secondary });
  }
  if (primary) throw primary;
  return loaded.exports;
}

function identity(path, stat) {
  return Object.freeze({
    path,
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    uid: Number(stat.uid),
  });
}

export function reserveStreamOutput(run) {
  assertDirectory(run);
  const path = join(run.path, 'stream-ingress.node');
  let descriptor;
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    const stat = fstatSync(descriptor, { bigint: true });
    return Object.freeze({ ...identity(path, stat), size: Number(stat.size) });
  } catch {
    throw failure('DEC203_INVALID_BUILD');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function observedPath(path, socket) {
  const before = lstatSync(path, { bigint: true });
  const canonical = realpathSync(path);
  const after = lstatSync(path, { bigint: true });
  const mode = socket ? 0o140600 : 0o040700;
  if (
    canonical !== path ||
    before.isSymbolicLink() ||
    after.isSymbolicLink() ||
    (socket ? !after.isSocket() : !after.isDirectory()) ||
    Number(after.mode) !== mode ||
    Number(after.uid) !== process.getuid() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.mode !== after.mode ||
    before.uid !== after.uid
  ) {
    throw failure('DEC203_IDENTITY_CHANGED');
  }
  return identity(path, after);
}

export function captureStreamIdentity(run) {
  try {
    assertDirectory(run);
    const parent = observedPath(run.path, false);
    const socket = observedPath(join(run.path, 'docker.sock'), true);
    assertDirectory(run);
    return Object.freeze({ parent, socket });
  } catch (error) {
    if (
      error.code === 'DEC203_IDENTITY_CHANGED' ||
      /^E[A-Z0-9]+$/.test(error.code ?? '')
    ) {
      throw failure('DEC203_STREAM_IDENTITY_CHANGED');
    }
    throw error;
  }
}
