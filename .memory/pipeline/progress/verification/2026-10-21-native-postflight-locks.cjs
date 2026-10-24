'use strict';
// WeJammin Slice 12 native POSTFLIGHT — lock metadata helpers.
//
// Data-only, synchronous, side-effect-free on import. The four fixed lock files
// are only lstat'd; they are never opened, created, acquired or modified. One
// bounded /proc/locks read per frame retains only rows whose major:minor:inode
// tuple matches a fixed lock file. Parse/read/missing/type/ownership errors fail
// closed as UNKNOWN, and unparseable global rows are recorded by line number and
// tag only (never the unrelated raw kernel row).

const fs = require('node:fs');
const helpers = require('./2026-10-21-native-postflight-processes.cjs');
const { boundedRead, code } = helpers;

const PROC_LOCKS = '/proc/locks';
const LOCKS_CAP = 1048576;
const OWNER_UID = 1000;
const LOCK_PATHS = [
  '/tmp/wejammin-supabase-ci.lock',
  '/tmp/wejammin-quiet.lock',
  '/tmp/wejammin-altdb.lock',
  '/tmp/wejammin-reset.lock',
];

// Linux dev_t major/minor split (kernel/glibc layout); bigint keeps 64-bit dev.
const major = (dev) => ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & 0xfffff000n);
const minor = (dev) => (dev & 0xffn) | ((dev >> 12n) & 0xffffff00n);

// /proc/locks rows: "<id>: [-> ]TYPE MODE ACCESS pid major:minor:inode start
// end". A blocked lock carries a LEADING arrow after the id colon; a trailing
// arrow region is tolerated but not relied upon.
const LOCK_ROW =
  /^(\d+):\s+(?:->\s+)?(\S+)\s+(\S+)\s+(\S+)\s+(-?\d+)\s+([0-9a-f]+):([0-9a-f]+):(\d+)\s+(\S+)\s+(\S+)(?:\s+->.*)?$/;

function lockEntry(path) {
  try {
    const lstat = fs.lstatSync(path, { bigint: true });
    if (lstat.isSymbolicLink() || !lstat.isFile()) {
      return { path, present: true, error: 'NOT_REGULAR_FILE' };
    }
    const uid = Number(lstat.uid);
    if (uid !== OWNER_UID) {
      return { path, present: true, error: 'UNSAFE_OWNER_UID', uid };
    }
    const maj = major(lstat.dev);
    const min = minor(lstat.dev);
    return {
      path,
      present: true,
      mode: Number(lstat.mode),
      uid,
      gid: Number(lstat.gid),
      size: lstat.size.toString(),
      dev: lstat.dev.toString(),
      ino: lstat.ino.toString(),
      major: maj.toString(),
      minor: min.toString(),
      tuple: maj + ':' + min + ':' + lstat.ino,
    };
  } catch (error) {
    return { path, present: false, error: code(error) };
  }
}

// lstat metadata only on the four fixed lock files plus one bounded /proc/locks
// read; only rows matching a fixed lock tuple are retained as structured data.
function lockFrame() {
  const errors = [];
  const files = [];
  const wanted = new Map();
  for (const path of LOCK_PATHS) {
    const entry = lockEntry(path);
    files.push(entry);
    if (entry.error) {
      errors.push({ source: 'LOCK_LSTAT', path, error: entry.error });
    } else {
      wanted.set(entry.tuple, path);
    }
  }
  const retained = [];
  const unparsed = [];
  const read = boundedRead(PROC_LOCKS, LOCKS_CAP);
  if (read.error) {
    errors.push({
      source: 'PROC_LOCKS',
      error: read.error,
      closeError: read.closeError ?? null,
    });
  } else if (read.truncated) {
    errors.push({ source: 'PROC_LOCKS', error: 'PROC_LOCKS_OVER_CAP' });
  } else {
    const lines = read.text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const row = lines[index].trim();
      if (!row) continue;
      const match = LOCK_ROW.exec(row);
      if (!match) {
        unparsed.push({ line: index + 1, tag: 'ROW_UNPARSEABLE' });
        continue;
      }
      const maj = BigInt('0x' + match[6]);
      const min = BigInt('0x' + match[7]);
      const inode = BigInt(match[8]);
      const tuple = maj + ':' + min + ':' + inode;
      if (!wanted.has(tuple)) continue;
      retained.push({
        path: wanted.get(tuple),
        type: match[2],
        mode: match[3],
        access: match[4],
        owner: Number(match[5]),
        major: maj.toString(),
        minor: min.toString(),
        inode: inode.toString(),
        start: match[9],
        end: match[10],
        blocked: /^\d+:\s+->/.test(row) || /\s->/.test(row),
      });
    }
  }
  if (unparsed.length > 0) {
    errors.push({
      source: 'PROC_LOCKS',
      tag: 'ROWS_UNPARSEABLE',
      count: unparsed.length,
    });
  }
  return {
    files,
    procLocks: {
      path: PROC_LOCKS,
      bytes: read.bytes ?? 0,
      truncated: read.truncated ?? false,
      error: read.error ?? null,
      retainedCount: retained.length,
      retained,
      unparsed,
    },
    status: errors.length === 0 ? 'COMPLETE' : 'UNKNOWN',
    errors,
  };
}

module.exports = { LOCKS_CAP, OWNER_UID, LOCK_PATHS, lockEntry, lockFrame };
