'use strict';
// WeJammin Slice 12 native POSTFLIGHT — process observation helpers.
//
// Data-only, synchronous, side-effect-free on import: only functions are
// defined here; the entrypoint decides when the single window runs, once. No
// child_process, spawn, application import, process.env, secrets, signals,
// timers, network, database, command-line/environment/namespace/fd/status
// reads, or argv. Bounded open/read loops only; proc files report size 0, so an
// unbounded readFile is never used as a first read.

const fs = require('node:fs');

const PROC = '/proc';
const STAT_CAP = 65536;
const LINK_CAP = 4096;
const CHUNK = 65536;
const ENUM_CAP = 4096;
const FIELDS = ['pid', 'ppid', 'group', 'session', 'startTime', 'uid'];

const code = (error) =>
  error && typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR';

// Reads at most `cap` bytes and never an extra chunk past the cap; a read that
// lands exactly on the cap stays conservative-unknown (truncated). The first
// read failure and any close failure are both retained.
function boundedRead(target, cap) {
  let fd;
  try {
    fd = fs.openSync(target, 'r');
  } catch (error) {
    return { error: code(error), bytes: 0 };
  }
  const parts = [];
  let total = 0;
  let readError = null;
  const buffer = Buffer.allocUnsafe(Math.min(CHUNK, cap) || 1);
  try {
    while (total < cap) {
      const room = Math.min(buffer.length, cap - total);
      const read = fs.readSync(fd, buffer, 0, room, null);
      if (read <= 0) break;
      parts.push(Buffer.from(buffer.subarray(0, read)));
      total += read;
    }
  } catch (error) {
    readError = code(error);
  }
  let closeError = null;
  try {
    fs.closeSync(fd);
  } catch (error) {
    closeError = code(error);
  }
  const error = readError ?? closeError;
  if (error) return { error, bytes: total, closeError };
  return {
    text: Buffer.concat(parts).toString('utf8'),
    bytes: total,
    truncated: total >= cap,
  };
}

// /proc/<pid>/stat: comm can hold spaces and parens, so anchor on the last ')'.
// The parsed pid must equal the requested pid, and every used field is numeric.
function parseStat(pid) {
  const read = boundedRead(PROC + '/' + pid + '/stat', STAT_CAP);
  if (read.error) return { error: read.error };
  if (read.truncated) return { error: 'STAT_OVER_CAP' };
  const boundary = read.text.lastIndexOf(')');
  if (boundary <= 0) return { error: 'STAT_UNPARSEABLE' };
  const lead = read.text.slice(0, read.text.indexOf(' '));
  const fields = read.text
    .slice(boundary + 2)
    .trim()
    .split(/\s+/);
  if (!/^[0-9]+$/.test(lead) || Number(lead) !== pid) {
    return { error: 'STAT_PID_MISMATCH' };
  }
  if (fields.length < 20) return { error: 'STAT_SHORT' };
  for (const index of [1, 2, 3, 19]) {
    if (!/^[0-9]+$/.test(fields[index])) return { error: 'STAT_FIELD_INVALID' };
  }
  for (const index of [1, 2, 3]) {
    if (!Number.isSafeInteger(Number(fields[index]))) {
      return { error: 'STAT_FIELD_RANGE' };
    }
  }
  return {
    pid: Number(lead),
    ppid: Number(fields[1]),
    group: Number(fields[2]),
    session: Number(fields[3]),
    startTime: fields[19],
  };
}

function readLink(pid, name) {
  let value;
  try {
    value = fs.readlinkSync(PROC + '/' + pid + '/' + name);
  } catch (error) {
    return { error: code(error) };
  }
  if (Buffer.byteLength(value) > LINK_CAP) return { error: 'LINK_OVER_CAP' };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { error: 'LINK_CONTROL' };
  return { value };
}

function dirUid(pid) {
  try {
    const stat = fs.lstatSync(PROC + '/' + pid);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return { error: 'DIR_NOT_DIRECTORY' };
    }
    return { uid: stat.uid };
  } catch (error) {
    return { error: code(error) };
  }
}

const identity = (parsed, uid) => ({
  pid: parsed.pid,
  ppid: parsed.ppid,
  group: parsed.group,
  session: parsed.session,
  startTime: parsed.startTime,
  uid,
});

// One bounded /proc enumeration. Non-numeric names are ignored; a numeric name
// that is not a positive safe integer is counted invalid; the numeric list is
// capped at ENUM_CAP and the cap is surfaced (never silently reconciled).
function listNumericPids() {
  let names;
  try {
    names = fs.readdirSync(PROC);
  } catch (error) {
    return { pids: [], numeric: 0, capped: false, error: code(error) };
  }
  const errors = [];
  const pids = [];
  let invalid = 0;
  for (const name of names) {
    if (!/^[0-9]+$/.test(name)) continue;
    const pid = Number(name);
    if (!Number.isSafeInteger(pid) || pid <= 0) {
      invalid += 1;
      continue;
    }
    pids.push(pid);
  }
  let capped = false;
  let selected = pids;
  if (pids.length > ENUM_CAP) {
    capped = true;
    selected = pids.slice(0, ENUM_CAP);
    errors.push({
      tag: 'PROC_ENUMERATION_CAPPED',
      omitted: pids.length - ENUM_CAP,
    });
  }
  if (invalid > 0) errors.push({ tag: 'PID_ENTRY_INVALID', count: invalid });
  return { pids: selected, numeric: pids.length, capped, errors };
}

// The directory UID is filtered before stat/exe/cwd. The six-field identity is
// captured before and after one unprivileged readlink each for exe and cwd, and
// the directory UID is rechecked afterwards. Any error, mismatch, vanishing or
// unreadable exe/cwd leaves the row explicit UNKNOWN and unclassified.
function captureProcess(pid, filterUid) {
  const row = {
    pid,
    before: null,
    exe: null,
    cwd: null,
    after: null,
    identityStable: null,
    status: 'UNKNOWN',
    reason: null,
  };
  const before = parseStat(pid);
  if (before.error) {
    row.reason = before.error;
    return row;
  }
  row.before = identity(before, filterUid);
  row.exe = readLink(pid, 'exe');
  row.cwd = readLink(pid, 'cwd');
  const after = parseStat(pid);
  const recheck = dirUid(pid);
  if (after.error) {
    row.reason = after.error;
    return row;
  }
  if (recheck.error) {
    row.after = { error: recheck.error };
    row.reason = 'DIR_RECHECK_' + recheck.error;
    return row;
  }
  row.after = identity(after, recheck.uid);
  row.identityStable = FIELDS.every(
    (key) => row.before[key] === row.after[key],
  );
  if (!row.identityStable) {
    row.reason = 'IDENTITY_MISMATCH';
    return row;
  }
  if (row.exe.error || row.cwd.error) {
    const linkError = row.exe.error || row.cwd.error;
    row.reason = (row.exe.error ? 'EXE_' : 'CWD_') + linkError;
    return row;
  }
  row.status = 'OBSERVED';
  return row;
}

module.exports = {
  PROC,
  ENUM_CAP,
  boundedRead,
  code,
  dirUid,
  listNumericPids,
  parseStat,
  readLink,
  captureProcess,
};
