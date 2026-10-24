import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { assertDirectory, failure } from './peer-artifacts.mjs';

function identity(stat) {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    size: Number(stat.size),
    mode: Number(stat.mode),
    uid: Number(stat.uid),
  };
}

export function reserveLifetimeOutput(run) {
  assertDirectory(run);
  const path = join(run.path, 'peer-lifetime.node');
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
