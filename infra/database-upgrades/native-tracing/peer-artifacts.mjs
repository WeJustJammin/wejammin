import { createHash } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function absolute(path, code) {
  if (
    typeof path !== 'string' ||
    path.includes('\0') ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    realpathSync(path) !== path
  ) {
    throw failure(code);
  }
}

function identity(stat) {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    size: Number(stat.size),
    mode: Number(stat.mode),
    uid: Number(stat.uid),
  };
}

function sameStat(left, right) {
  return JSON.stringify(identity(left)) === JSON.stringify(identity(right));
}

export function artifact(path, code = 'DEC203_INVALID_BUILD') {
  let descriptor;
  try {
    absolute(path, code);
    const before = lstatSync(path, { bigint: true });
    if (!before.isFile() || !Number.isSafeInteger(Number(before.size))) {
      throw failure(code);
    }
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    absolute(path, code);
    const named = lstatSync(path, { bigint: true });
    if (
      !sameStat(before, opened) ||
      !sameStat(opened, after) ||
      !sameStat(after, named) ||
      bytes.length !== Number(after.size) ||
      !named.isFile()
    ) {
      throw failure(code);
    }
    return Object.freeze({
      path,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ...identity(after),
    });
  } catch (error) {
    if (error.code === code) throw error;
    throw failure(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function assertArtifacts(records) {
  for (const record of records) {
    const current = artifact(record.path, 'DEC203_IDENTITY_CHANGED');
    if (JSON.stringify(current) !== JSON.stringify(record)) {
      throw failure('DEC203_IDENTITY_CHANGED');
    }
  }
}

export function directory(path, privateRun = false) {
  try {
    absolute(path, 'DEC203_INVALID_BUILD');
    const stat = lstatSync(path, { bigint: true });
    if (
      !stat.isDirectory() ||
      (privateRun &&
        (Number(stat.uid) !== process.getuid() ||
          (Number(stat.mode) & 0o7777) !== 0o700 ||
          readdirSync(path).length !== 0))
    ) {
      throw failure('DEC203_INVALID_BUILD');
    }
    return Object.freeze({ path, ...identity(stat) });
  } catch {
    throw failure('DEC203_INVALID_BUILD');
  }
}

export function assertDirectory(record) {
  try {
    absolute(record.path, 'DEC203_IDENTITY_CHANGED');
    const stat = lstatSync(record.path, { bigint: true });
    if (
      !stat.isDirectory() ||
      String(stat.dev) !== record.device ||
      String(stat.ino) !== record.inode ||
      Number(stat.uid) !== record.uid ||
      Number(stat.mode) !== record.mode
    ) {
      throw failure('DEC203_IDENTITY_CHANGED');
    }
  } catch {
    throw failure('DEC203_IDENTITY_CHANGED');
  }
}

export function executable(record) {
  try {
    accessSync(record.path, constants.X_OK);
    if ((record.mode & 0o6000) !== 0) throw failure('DEC203_INVALID_BUILD');
  } catch {
    throw failure('DEC203_INVALID_BUILD');
  }
}

export function reserveOutput(run) {
  assertDirectory(run);
  const path = join(run.path, 'peer-credentials.node');
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
    return Object.freeze({
      path,
      ...identity(fstatSync(descriptor, { bigint: true })),
    });
  } catch {
    throw failure('DEC203_INVALID_BUILD');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function removeOwnedOutput(run, output) {
  try {
    assertDirectory(run);
    const stat = lstatSync(output.path, { bigint: true });
    if (
      !stat.isFile() ||
      String(stat.dev) !== output.device ||
      String(stat.ino) !== output.inode ||
      Number(stat.uid) !== output.uid
    ) {
      return false;
    }
    unlinkSync(output.path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'DEC203_IDENTITY_CHANGED') {
      return false;
    }
    throw failure('DEC203_COMPILER_FAILED');
  }
}
