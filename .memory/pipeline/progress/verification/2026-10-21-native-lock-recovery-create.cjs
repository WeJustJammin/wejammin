'use strict';
// WeJammin Slice 12 native lock recovery — one-shot UID-1000 operational creator.
//
// Source only, authored for review; never run here. When executed it is invoked
// exactly once and unprivileged, only after a separate preflight/batch
// admission; it is not a self-authorizing DTO and makes no native-admission,
// acceptance or clear claim.
//
// The run gate (getuid/getgid 1000, node v22.23.1) precedes any mutation. A
// private one-run marker/result is reserved O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW
// 0600 before any lock work and is terminal if it exists (no retry, no
// alternate path). All four fixed locks must lstat ENOENT before any creation,
// then each is created once through the validated-index helper. The first error
// stops remaining creations; created files and a partial marker are preserved.
// After creation every created file is re-validated against its held identity
// by a final named lstat, and the report is complete only when each final file
// is a regular non-symlink UID/GID-1000 0o644 empty file whose device/inode
// match. No flock, unlink, rollback, repair, retry, child process, network,
// database, environment, argv, secret, signal, service, stack or /proc read.

const fs = require('node:fs');
const files = require('./2026-10-21-native-lock-recovery-create-files.cjs');
const output = require('./2026-10-21-native-lock-recovery-output.cjs');
const { code } = require('./2026-10-21-native-postflight-processes.cjs');

const MARKER = 'ONE_SHOT_LOCK_RECOVERY_CREATE';
const SCOPE =
  'One-shot fixed UID-1000 operational creator for the four coordination lock files; not native admission, acceptance or a self-authorizing grant';
const NODE_VERSION = 'v22.23.1';
const OWNER_UID = 1000;
const OWNER_GID = 1000;
const MODE_0600 = 0o600;
const MARKER_DIR = output.OUTPUT_DIR;
const MARKER_PATH =
  MARKER_DIR + '/s12-native-lock-recovery-create-20261021.json';
const MARKER_FLAGS =
  fs.constants.O_CREAT |
  fs.constants.O_EXCL |
  fs.constants.O_WRONLY |
  fs.constants.O_NOFOLLOW;

// Fixed run gate. Reads no environment, argv or secrets.
function gate() {
  const uid = process.getuid();
  const gid = process.getgid();
  const node = process.version;
  const failures = [];
  if (uid !== OWNER_UID) failures.push({ gate: 'UID', value: uid });
  if (gid !== OWNER_GID) failures.push({ gate: 'GID', value: gid });
  if (node !== NODE_VERSION) failures.push({ gate: 'NODE', value: node });
  return { ok: failures.length === 0, uid, gid, node, failures };
}

// The fixed canonical .lane-logs parent must be a real non-symlink UID-1000
// directory whose realpath is the literal path; otherwise the run never starts.
function verifyMarkerDir() {
  try {
    const stat = fs.lstatSync(MARKER_DIR);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return { ok: false, reason: 'MARKER_PARENT_NOT_DIRECTORY' };
    }
    if (stat.uid !== OWNER_UID) {
      return { ok: false, reason: 'MARKER_PARENT_NOT_UID1000' };
    }
    const canonical = fs.realpathSync(MARKER_DIR);
    if (canonical !== MARKER_DIR) {
      return { ok: false, reason: 'MARKER_PARENT_NOT_CANONICAL' };
    }
    return { ok: true, uid: stat.uid, canonical };
  } catch (error) {
    return { ok: false, reason: 'MARKER_PARENT_' + code(error) };
  }
}

// One-run reservation: the sole guard against a second execution. Any failure,
// including EEXIST, is terminal and never retried on another path.
function reserveMarker() {
  try {
    return { fd: fs.openSync(MARKER_PATH, MARKER_FLAGS, MODE_0600) };
  } catch (error) {
    return { error: code(error) };
  }
}

// Report shape. The report is complete only when every intended creation is
// verified, every final named file still matches its held identity, and the
// marker persisted fully; any write/fsync/close/inode/mode/final error stays
// explicit.
function buildReport(context) {
  const createdPaths = context.created
    .filter((record) => record.created)
    .map((record) => record.path);
  let firstFinalError = null;
  for (const entry of context.finals) {
    if (entry.finalError !== null) {
      firstFinalError = entry.finalError;
      break;
    }
  }
  const complete =
    context.preflight.ok &&
    !context.stopped &&
    context.created.length === files.LOCK_PATHS.length &&
    context.created.every((record) => record.verified) &&
    context.finals.length === files.LOCK_PATHS.length &&
    context.finals.every((entry) => entry.finalError === null);
  let status = 'COMPLETE';
  if (!context.preflight.ok) status = 'STOPPED_PREFLIGHT';
  else if (context.stopped) status = 'STOPPED_CREATE';
  else if (firstFinalError !== null) status = 'FINAL_MISMATCH';
  else if (!complete) status = 'INCOMPLETE';
  return {
    version: 1,
    marker: MARKER,
    scope: SCOPE,
    operationalCreateOnly: true,
    nativeAdmissionClaim: false,
    acceptanceOrClearClaim: false,
    startedAt: context.startedAt,
    endedAt: new Date().toISOString(),
    identity: {
      uid: context.gate.uid,
      gid: context.gate.gid,
      node: context.gate.node,
      pid: process.pid,
    },
    markerPath: MARKER_PATH,
    lockPaths: files.LOCK_PATHS,
    preflight: context.preflight,
    created: context.created,
    createdPaths,
    stopped: context.stopped,
    stopReason: context.stopReason,
    finals: context.finals,
    firstFinalError,
    complete,
    status,
    errors: context.errors,
  };
}

// Early terminal stop before the marker exists: nothing is created and no retry
// or alternate path is attempted.
function stop(stage, error, exitCode) {
  output.emit({
    marker: MARKER,
    ran: false,
    stage,
    error,
    markerPath: MARKER_PATH,
    markerSha256: null,
    persisted: null,
  });
  process.exitCode = exitCode;
}

function main() {
  const startedAt = new Date().toISOString();
  const gateResult = gate();
  if (!gateResult.ok) {
    stop('GATE', gateResult.failures, 2);
    return;
  }
  const dir = verifyMarkerDir();
  if (!dir.ok) {
    stop('MARKER_DIR', dir.reason, 2);
    return;
  }
  const reserved = reserveMarker();
  if (reserved.error) {
    stop('MARKER_RESERVE', reserved.error, 3);
    return;
  }
  const preflight = files.preflightLocks();
  const created = [];
  const errors = [];
  let stopped = false;
  let stopReason = null;
  if (preflight.ok) {
    for (let index = 0; index < files.LOCK_PATHS.length; index += 1) {
      const record = files.createOne(index);
      created.push(record);
      if (record.firstError !== null || record.closeError !== null) {
        stopped = true;
        stopReason = record.firstError ?? 'CLOSE_' + record.closeError;
        errors.push({
          stage: 'CREATE',
          path: record.path,
          reason: stopReason,
        });
        break;
      }
    }
  } else {
    stopped = true;
    stopReason = 'PREFLIGHT_NOT_EMPTY';
    for (const entry of preflight.entries) {
      if (entry.present || entry.error !== 'ENOENT') {
        errors.push({ stage: 'PREFLIGHT', ...entry });
      }
    }
  }
  const finals = created
    .filter((record) => record.created)
    .map((record) => files.finalCheck(record));
  let finalMismatches = 0;
  for (const entry of finals) {
    if (entry.finalError !== null) {
      finalMismatches += 1;
      errors.push({
        stage: 'FINAL',
        path: entry.path,
        reason: entry.finalError,
      });
    }
  }
  const report = buildReport({
    startedAt,
    gate: gateResult,
    preflight,
    created,
    stopped,
    stopReason,
    finals,
    errors,
  });
  const raw = JSON.stringify(report, null, 2) + '\n';
  const buffer = Buffer.from(raw, 'utf8');
  const persisted = output.persist(reserved.fd, buffer);
  const sha256 = persisted.complete ? output.digest(buffer) : null;
  const createdPaths = created
    .filter((record) => record.created)
    .map((record) => record.path);
  output.emit({
    marker: MARKER,
    ran: true,
    status: report.status,
    createdPaths,
    createdCount: createdPaths.length,
    expectedCount: files.LOCK_PATHS.length,
    finalMismatches,
    firstFinalError: report.firstFinalError,
    markerPath: MARKER_PATH,
    markerSha256: sha256,
    complete: report.complete && persisted.complete,
    persisted,
  });
  if (!persisted.complete || !report.complete) process.exitCode = 4;
}

main();
