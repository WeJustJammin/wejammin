'use strict';
// WeJammin Slice 12 native lock-recovery — shared output and reservation.
//
// Data-only and side-effect-free on import: only functions and frozen constants
// are defined here. It resolves only the fixed, finite two-stage map, and an
// invalid stage is rejected before any filesystem or observation work. Each
// invocation makes one O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW 0600 reservation (no
// overwrite, repair or retry) and writes the generated raw report through a
// short-write-safe loop. Public stdout carries only counters, the four known
// PIDs and actual persistence metadata.

const crypto = require('node:crypto');
const fs = require('node:fs');
const { code } = require('./2026-10-21-native-postflight-processes.cjs');

const MARKER = 'OBSERVED_METADATA_ONLY';
const OUTPUT_DIR =
  '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs';
const KNOWN_PIDS = [712, 723, 4377, 4630];
const UID1000 = 1000;
const OUTPUT_FLAGS = 'O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW';
const STAGES = Object.freeze({
  preflight: 's12-native-lock-recovery-preflight-20261021.json',
  postflight: 's12-native-lock-recovery-postflight-20261021.json',
});

// Resolves one fixed stage to its raw output path; an invalid stage is rejected
// here, before any filesystem call or observation, so no free-form path or argv
// can reach the write path.
function resolveStage(stage) {
  if (
    typeof stage !== 'string' ||
    !Object.prototype.hasOwnProperty.call(STAGES, stage)
  ) {
    return { ok: false, reason: 'INVALID_STAGE' };
  }
  return { ok: true, stage, path: OUTPUT_DIR + '/' + STAGES[stage] };
}

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

function reserveOutput(path) {
  const flags =
    fs.constants.O_CREAT |
    fs.constants.O_EXCL |
    fs.constants.O_WRONLY |
    fs.constants.O_NOFOLLOW;
  try {
    return { fd: fs.openSync(path, flags, 0o600) };
  } catch (error) {
    return { error: code(error) };
  }
}

// Writes the whole buffer, looping on short writes; the intended hash or byte
// count is only claimed when every byte plus fsync and close landed.
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

const emit = (value) => {
  process.stdout.write(JSON.stringify(value) + '\n');
};

const digest = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

module.exports = {
  MARKER,
  OUTPUT_DIR,
  OUTPUT_FLAGS,
  KNOWN_PIDS,
  UID1000,
  STAGES,
  digest,
  emit,
  persist,
  reserveOutput,
  resolveStage,
  verifyOutputDir,
};
