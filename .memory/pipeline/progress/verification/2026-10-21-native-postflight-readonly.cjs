'use strict';
// WeJammin Slice 12 native POSTFLIGHT observation — entrypoint orchestration.
//
// One unprivileged window: UID-1000 six-field identities with readable exe/cwd
// links, plus metadata for the four fixed lock files and /proc/locks. The output
// file is reserved O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW 0600 before any
// observation and receives only the generated raw report. Diagnostic only: no
// acceptance, clear, role, ownership, absence or native-quiet claim; native
// tests stay HELD. No child_process, spawn, application import, process.env,
// secrets, signals, timers, network, database, command-line reads, argv, or
// mkdir/chmod/cleanup. The helpers are imported data-only; the single window,
// when invoked, runs here exactly once.

const crypto = require('node:crypto');
const fs = require('node:fs');
const processes = require('./2026-10-21-native-postflight-processes.cjs');
const locks = require('./2026-10-21-native-postflight-locks.cjs');

const MARKER = 'OBSERVED_METADATA_ONLY';
const OUTPUT_DIR =
  '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs';
const OUTPUT_PATH = OUTPUT_DIR + '/s12-native-postflight-20261021.json';
const KNOWN_PIDS = [712, 723, 4377, 4630];
const UID1000 = 1000;
const code = processes.code;

function verifyOutputDir() {
  try {
    const stat = fs.lstatSync(OUTPUT_DIR);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return { ok: false, reason: 'OUTPUT_PARENT_NOT_DIRECTORY' };
    }
    if (stat.uid !== UID1000) {
      return { ok: false, reason: 'OUTPUT_PARENT_NOT_UID1000' };
    }
    const canonical = fs.realpathSync(OUTPUT_DIR);
    if (canonical !== OUTPUT_DIR) {
      return { ok: false, reason: 'OUTPUT_PARENT_NOT_CANONICAL' };
    }
    return { ok: true, uid: stat.uid, canonical };
  } catch (error) {
    return { ok: false, reason: 'OUTPUT_PARENT_' + code(error) };
  }
}

function reserveOutput() {
  const flags =
    fs.constants.O_CREAT |
    fs.constants.O_EXCL |
    fs.constants.O_WRONLY |
    fs.constants.O_NOFOLLOW;
  try {
    return { fd: fs.openSync(OUTPUT_PATH, flags, 0o600) };
  } catch (error) {
    return { error: code(error) };
  }
}

function buildReport() {
  const startedAt = new Date().toISOString();
  const errors = [];
  const rows = [];
  const counters = {
    numericProcEntries: 0,
    capExceeded: false,
    capOmitted: 0,
    excludedByUidFilter: 0,
    filterErrors: 0,
    uid1000IdentitiesRead: 0,
    captureErrors: 0,
    unstableIdentities: 0,
    readableExeLinks: 0,
    readableCwdLinks: 0,
    exeLinkErrors: 0,
    cwdLinkErrors: 0,
    rowsWritten: 0,
  };
  const before = locks.lockFrame();
  const enumerated = processes.listNumericPids();
  counters.numericProcEntries = enumerated.numeric;
  counters.capExceeded = enumerated.capped;
  if (enumerated.error) {
    errors.push({ source: 'PROC_ENUMERATION', error: enumerated.error });
  }
  for (const item of enumerated.errors ?? []) {
    errors.push({ source: 'PROC_ENUMERATION', ...item });
    if (item.tag === 'PROC_ENUMERATION_CAPPED') {
      counters.capOmitted = item.omitted;
    }
  }
  for (const pid of enumerated.pids) {
    const dir = processes.dirUid(pid);
    if (dir.error) {
      counters.filterErrors += 1;
      errors.push({ source: 'DIR_FILTER', pid, error: dir.error });
      continue;
    }
    if (dir.uid !== UID1000) {
      counters.excludedByUidFilter += 1;
      continue;
    }
    counters.uid1000IdentitiesRead += 1;
    const row = processes.captureProcess(pid, dir.uid);
    rows.push(row);
    if (row.status !== 'OBSERVED') counters.captureErrors += 1;
    if (row.identityStable === false) counters.unstableIdentities += 1;
    if (row.exe && row.exe.value !== undefined) counters.readableExeLinks += 1;
    if (row.cwd && row.cwd.value !== undefined) counters.readableCwdLinks += 1;
    if (row.exe && row.exe.error) counters.exeLinkErrors += 1;
    if (row.cwd && row.cwd.error) counters.cwdLinkErrors += 1;
  }
  counters.rowsWritten = rows.length;
  const after = locks.lockFrame();
  for (let index = 0; index < locks.LOCK_PATHS.length; index += 1) {
    const prior = before.files[index];
    const later = after.files[index];
    if (JSON.stringify(prior) !== JSON.stringify(later)) {
      errors.push({
        source: 'LOCK_FILE_CHANGED',
        path: locks.LOCK_PATHS[index],
      });
    }
  }
  const capNote = counters.capExceeded
    ? ' [CAP APPLIED: ' + counters.capOmitted + ' omitted]'
    : '';
  const reconciliation =
    counters.numericProcEntries +
    ' = ' +
    counters.excludedByUidFilter +
    ' excluded + ' +
    counters.uid1000IdentitiesRead +
    ' read + ' +
    counters.filterErrors +
    ' filter-error' +
    capNote;
  return {
    version: 1,
    marker: MARKER,
    diagnosticOnly: true,
    nativeOrDatabaseAcceptance: false,
    nativeTestsHeld: true,
    acceptanceOrClearClaim: false,
    scope:
      'One observational window; not a globally atomic or continuous inventory and not global-absence proof',
    startedAt,
    endedAt: new Date().toISOString(),
    inspectionPid: process.pid,
    uid: process.getuid(),
    node: process.version,
    frames: { before, after },
    processes: rows,
    counters,
    captureReconciliation: reconciliation,
    errors: errors.concat(before.errors, after.errors),
    notes: [
      'Native tests remain HELD.',
      'OBSERVED_METADATA_ONLY: no acceptance, clear or native-quiet claim.',
    ],
  };
}

const emit = (value) => {
  process.stdout.write(JSON.stringify(value) + '\n');
};

// Writes the whole buffer, looping on short writes. The intended hash or byte
// count is never claimed as persisted unless every byte plus fsync and close
// landed, so a short write stays explicit and partial output is preserved.
function persist(fd, buffer) {
  let written = 0;
  let writeError = null;
  try {
    while (written < buffer.length) {
      const n = fs.writeSync(
        fd,
        buffer,
        written,
        buffer.length - written,
        null,
      );
      if (n <= 0) {
        writeError = 'SHORT_WRITE';
        break;
      }
      written += n;
    }
  } catch (error) {
    writeError = code(error);
  }
  let fsyncError = null;
  if (writeError === null) {
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      fsyncError = code(error);
    }
  }
  let closeError = null;
  try {
    fs.closeSync(fd);
  } catch (error) {
    closeError = code(error);
  }
  const complete =
    writeError === null &&
    fsyncError === null &&
    closeError === null &&
    written === buffer.length;
  return {
    complete,
    bytes: written,
    totalBytes: buffer.length,
    writeError,
    fsyncError,
    closeError,
  };
}

function main() {
  const dir = verifyOutputDir();
  if (!dir.ok) {
    emit({
      marker: MARKER,
      outputPath: OUTPUT_PATH,
      error: dir.reason,
      ran: false,
    });
    process.exitCode = 2;
    return;
  }
  const reserved = reserveOutput();
  if (reserved.error) {
    emit({
      marker: MARKER,
      outputPath: OUTPUT_PATH,
      error: 'RESERVE_' + reserved.error,
      ran: false,
    });
    process.exitCode = 3;
    return;
  }
  let report;
  try {
    report = buildReport();
  } catch (error) {
    report = {
      version: 1,
      marker: MARKER,
      startedAt: new Date().toISOString(),
      errors: [{ source: 'OBSERVATION', error: code(error) }],
    };
  }
  report.output = {
    path: OUTPUT_PATH,
    flags: 'O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW',
    mode: '0600',
    reservedBeforeObservation: true,
    parentUid: dir.uid,
    parentCanonical: dir.canonical,
  };
  const raw = JSON.stringify(report, null, 2) + '\n';
  const buffer = Buffer.from(raw, 'utf8');
  const persisted = persist(reserved.fd, buffer);
  const knownPids = {};
  const captured = report.processes ?? [];
  for (const pid of KNOWN_PIDS) {
    const row = captured.find((value) => value.pid === pid);
    knownPids[pid] = row
      ? {
          status: row.status,
          reason: row.reason,
          before: row.before,
          after: row.after,
          exe: row.exe,
          cwd: row.cwd,
        }
      : { status: 'NOT_OBSERVED' };
  }
  const sha256 = persisted.complete
    ? crypto.createHash('sha256').update(buffer).digest('hex')
    : null;
  emit({
    marker: MARKER,
    outputPath: OUTPUT_PATH,
    persisted,
    sha256,
    counters: report.counters ?? null,
    knownPids,
  });
  if (!persisted.complete) process.exitCode = 4;
}

main();
