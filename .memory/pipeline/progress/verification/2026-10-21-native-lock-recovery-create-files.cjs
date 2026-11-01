'use strict';
// WeJammin Slice 12 native lock recovery — fixed lock-path fixture and creator.
//
// Data plus one bounded creator, all filesystem-local: the four fixed lock paths
// are module-owned, and a lock file is only ever created for a validated finite
// index rather than an arbitrary caller path. A freshly created descriptor is
// checked for a regular UID/GID-1000 0o644 empty file, and the named path is
// re-verified against the held descriptor. Every created file is closed exactly
// once; the first error and any close error are both retained. No flock, unlink,
// rollback, repair, retry, child process, network, database, environment, argv,
// secret, signal or /proc read.

const fs = require('node:fs');
const { code } = require('./2026-10-21-native-postflight-processes.cjs');

const OWNER_UID = 1000;
const OWNER_GID = 1000;
const MODE_0644 = 0o644;
const LOCK_PATHS = [
  '/tmp/wejammin-supabase-ci.lock',
  '/tmp/wejammin-quiet.lock',
  '/tmp/wejammin-altdb.lock',
  '/tmp/wejammin-reset.lock',
];
const CREATE_FLAGS =
  fs.constants.O_RDWR |
  fs.constants.O_CREAT |
  fs.constants.O_EXCL |
  fs.constants.O_NOFOLLOW;

// JSON-safe snapshot of bigint stat fields; permission bits shown as octal.
const snapshot = (stat) => ({
  mode: '0' + (Number(stat.mode) & 0o7777).toString(8),
  uid: Number(stat.uid),
  gid: Number(stat.gid),
  dev: stat.dev.toString(),
  ino: stat.ino.toString(),
  size: stat.size.toString(),
});

const perms = (stat) => Number(stat.mode) & 0o7777;
const owned = (stat) =>
  Number(stat.uid) === OWNER_UID && Number(stat.gid) === OWNER_GID;
const fail = (record, tag) => {
  if (record.firstError === null) record.firstError = tag;
};

// Read-only lstat of one fixed path; never opens, reads, chmods or deletes it.
function snapshotAt(path) {
  try {
    return {
      path,
      present: true,
      lstat: snapshot(fs.lstatSync(path, { bigint: true })),
    };
  } catch (error) {
    return { path, present: false, error: code(error) };
  }
}

// The fixed lock path for a validated finite index; any other index is rejected
// before any filesystem call, so no arbitrary caller path reaches openSync.
function resolveLockPath(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCK_PATHS.length) {
    return { ok: false, reason: 'INVALID_INDEX' };
  }
  return { ok: true, path: LOCK_PATHS[index] };
}

// All four fixed locks must be ENOENT before any creation; an existing file or
// non-ENOENT error stops with zero creations.
function preflightLocks() {
  const entries = LOCK_PATHS.map(snapshotAt);
  const ok = entries.every(
    (entry) => !entry.present && entry.error === 'ENOENT',
  );
  return { ok, entries };
}

// Named-versus-held identity at creation time: the path must still be a regular
// UID/GID-1000 0o644 file whose device/inode match the held descriptor.
function verifyNamed(record) {
  try {
    const named = fs.lstatSync(record.path, { bigint: true });
    record.named = snapshot(named);
    if (named.isSymbolicLink() || !named.isFile()) {
      return fail(record, 'NAMED_NOT_REGULAR_FILE');
    }
    if (!owned(named)) return fail(record, 'NAMED_NOT_OWNER');
    if (perms(named) !== MODE_0644) return fail(record, 'NAMED_MODE_NOT_0644');
    if (
      record.held === null ||
      named.dev.toString() !== record.held.dev ||
      named.ino.toString() !== record.held.ino
    ) {
      return fail(record, 'NAMED_HELD_MISMATCH');
    }
    record.realpath = fs.realpathSync(record.path);
    if (record.realpath !== record.path) fail(record, 'NAMED_NOT_CANONICAL');
  } catch (error) {
    fail(record, code(error));
  }
}

// Creates one lock file for a validated index. Once a descriptor is allocated it
// is always closed exactly once; the first error and any close error are kept.
function createOne(index) {
  const resolved = resolveLockPath(index);
  const record = {
    index,
    path: resolved.ok ? resolved.path : null,
    created: false,
    verified: false,
    firstError: resolved.ok ? null : resolved.reason,
    closeError: null,
    held: null,
    named: null,
    realpath: null,
  };
  if (!resolved.ok) return record;
  let fd;
  try {
    fd = fs.openSync(resolved.path, CREATE_FLAGS, MODE_0644);
  } catch (error) {
    record.firstError = 'OPEN_' + code(error);
    return record;
  }
  record.created = true;
  try {
    const held = fs.fstatSync(fd, { bigint: true });
    record.held = snapshot(held);
    if (held.isSymbolicLink() || !held.isFile()) {
      fail(record, 'HELD_NOT_REGULAR_FILE');
    } else if (!owned(held)) {
      fail(record, 'HELD_NOT_OWNER');
    } else if (perms(held) !== MODE_0644) {
      fs.fchmodSync(fd, MODE_0644);
      const after = fs.fstatSync(fd, { bigint: true });
      record.held = snapshot(after);
      if (perms(after) !== MODE_0644) fail(record, 'HELD_MODE_NOT_0644');
    }
    if (record.firstError === null) fs.fsyncSync(fd);
  } catch (error) {
    fail(record, code(error));
  } finally {
    try {
      fs.closeSync(fd);
    } catch (error) {
      record.closeError = code(error);
    }
  }
  if (record.firstError === null && record.closeError === null) {
    verifyNamed(record);
  }
  record.verified = record.firstError === null && record.closeError === null;
  return record;
}

// Final named validation: the created file must still be a regular, non-symlink,
// UID/GID-1000, 0o644, empty file whose device/inode match its held identity.
function finalCheck(record) {
  const result = { path: record.path, finalError: null, final: null };
  try {
    const named = fs.lstatSync(record.path, { bigint: true });
    result.final = snapshot(named);
    if (named.isSymbolicLink() || !named.isFile()) {
      result.finalError = 'FINAL_NOT_REGULAR_FILE';
    } else if (!owned(named)) {
      result.finalError = 'FINAL_NOT_OWNER';
    } else if (perms(named) !== MODE_0644) {
      result.finalError = 'FINAL_MODE_NOT_0644';
    } else if (named.size !== 0n) {
      result.finalError = 'FINAL_SIZE_NONZERO';
    } else if (
      record.held === null ||
      named.dev.toString() !== record.held.dev ||
      named.ino.toString() !== record.held.ino
    ) {
      result.finalError = 'FINAL_HELD_MISMATCH';
    }
  } catch (error) {
    result.finalError = 'FINAL_' + code(error);
  }
  return result;
}

module.exports = {
  OWNER_UID,
  OWNER_GID,
  MODE_0644,
  LOCK_PATHS,
  createOne,
  finalCheck,
  preflightLocks,
  resolveLockPath,
  snapshot,
  snapshotAt,
};
