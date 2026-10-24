'use strict';
// WeJammin Slice 12 native lock-recovery — reusable single-window collector.
//
// Side-effect-free on import. observe(stage) runs exactly one observational
// window: it rejects an invalid stage before any filesystem or observation
// work, verifies the canonical UID-1000 output parent, reserves the stage
// output before observing, performs one bounded /proc enumeration with the
// same UID filter and six-field before/after brackets and matching-only lock
// frames before and after, then persists the raw report. It never creates or
// acquires global locks and never spawns privilege; no admission, native-clear
// or lock-creation claim is made and ROOT interprets the actual evidence.

const output = require('./2026-10-21-native-lock-recovery-output.cjs');
const processes = require('./2026-10-21-native-postflight-processes.cjs');
const locks = require('./2026-10-21-native-postflight-locks.cjs');

const MARKER = output.MARKER;
const UID1000 = output.UID1000;
const APPROVAL_REF =
  '.memory/pipeline/progress/verification/2026-10-21-native-lock-recovery-owner-approval.json';
const code = processes.code;

function buildReport(stage, resolved) {
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
    stage,
    marker: MARKER,
    approvalRef: APPROVAL_REF,
    diagnosticOnly: true,
    nativeOrDatabaseAcceptance: false,
    nativeTestsHeld: true,
    acceptanceOrClearClaim: false,
    admissionClaimed: false,
    nativeClearClaimed: false,
    lockCreationPerformed: false,
    privilegedInvocation: false,
    scope:
      'One observational window; not a globally atomic or continuous inventory and not global-absence proof',
    startedAt,
    endedAt: new Date().toISOString(),
    inspectionPid: process.pid,
    uid: process.getuid(),
    node: process.version,
    output: {
      path: resolved.path,
      flags: output.OUTPUT_FLAGS,
      mode: '0600',
      reservedBeforeObservation: true,
      parentUid: resolved.parentUid,
      parentCanonical: resolved.parentCanonical,
    },
    frames: { before, after },
    processes: rows,
    counters,
    captureReconciliation: reconciliation,
    errors: errors.concat(before.errors, after.errors),
    notes: [
      'Native tests remain HELD.',
      'OBSERVED_METADATA_ONLY: no acceptance, clear, native-quiet or lock-creation claim.',
    ],
  };
}

function observe(stage) {
  const stageRef = typeof stage === 'string' ? stage : null;
  const resolvedStage = output.resolveStage(stage);
  if (!resolvedStage.ok) {
    output.emit({
      marker: MARKER,
      stage: stageRef,
      error: resolvedStage.reason,
      ran: false,
    });
    return { ok: false, reason: resolvedStage.reason };
  }
  const dir = output.verifyOutputDir();
  if (!dir.ok) {
    output.emit({
      marker: MARKER,
      stage,
      outputPath: resolvedStage.path,
      error: dir.reason,
      ran: false,
    });
    return { ok: false, reason: dir.reason };
  }
  const reserved = output.reserveOutput(resolvedStage.path);
  if (reserved.error) {
    output.emit({
      marker: MARKER,
      stage,
      outputPath: resolvedStage.path,
      error: 'RESERVE_' + reserved.error,
      ran: false,
    });
    return { ok: false, reason: reserved.error };
  }
  const resolved = {
    ...resolvedStage,
    parentUid: dir.uid,
    parentCanonical: dir.canonical,
  };
  let report;
  try {
    report = buildReport(stage, resolved);
  } catch (error) {
    report = {
      version: 1,
      stage,
      marker: MARKER,
      approvalRef: APPROVAL_REF,
      startedAt: new Date().toISOString(),
      errors: [{ source: 'OBSERVATION', error: code(error) }],
    };
  }
  const raw = JSON.stringify(report, null, 2) + '\n';
  const buffer = Buffer.from(raw, 'utf8');
  const persisted = output.persist(reserved.fd, buffer);
  const knownPids = {};
  const captured = report.processes ?? [];
  for (const pid of output.KNOWN_PIDS) {
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
  const sha256 = persisted.complete ? output.digest(buffer) : null;
  output.emit({
    marker: MARKER,
    stage,
    outputPath: resolvedStage.path,
    persisted,
    sha256,
    counters: report.counters ?? null,
    knownPids,
  });
  return { ok: persisted.complete, persisted, sha256 };
}

module.exports = { APPROVAL_REF, buildReport, observe };
