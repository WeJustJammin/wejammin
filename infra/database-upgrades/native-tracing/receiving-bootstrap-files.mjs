import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import {
  artifact,
  ensure,
  fileCloseFailures,
  named,
  reservedFileLedger,
  snapshotInputs,
  stamp,
  throwFileCloseErrors,
  validateOwnedStat,
} from './receiving-bootstrap-artifacts.mjs';
import { entry, facts } from './receiving-bootstrap-processes.mjs';
import { PHASES, UID } from './receiving-bootstrap-profile.mjs';
import {
  validateCompiledMode,
  validateUnsealedOutput,
} from './receiving-bootstrap-resources.mjs';

const records = new WeakMap();
const retained = new Set();
const attempted = new Set();

function state(key, argc, statuses) {
  const value = records.get(key);
  ensure(
    argc === 1 &&
      value !== undefined &&
      (statuses === undefined || statuses.includes(value.status)),
    'DEC203_SUPERVISOR_REFUSED',
  );
  return value;
}

function reserve(phase) {
  ensure(!attempted.has(phase), 'DEC203_SUPERVISOR_REFUSED');
  attempted.add(phase);
  const key = Object.freeze({});
  const value = reservedFileLedger(phase);
  records.set(key, value);
  retained.add(value);
  return key;
}

export function reserveOwnerFiles() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return reserve('owner');
}

export function reserveLeaseFiles() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return reserve('lease');
}

function allocate(record, operation, action) {
  const attempt = { operation, returned: false, result: undefined };
  record.allocations.push(attempt);
  attempt.result = action();
  attempt.returned = true;
}

function openDirectory(record) {
  const before = named(record.path, true);
  ensure(before.uid === BigInt(UID) && before.mode === 0o040700n);
  allocate(
    record,
    'open-directory',
    () =>
      (record.fd = fs.openSync(
        record.path,
        fs.constants.O_RDONLY |
          fs.constants.O_DIRECTORY |
          fs.constants.O_NOFOLLOW,
      )),
  );
  record.birth = fs.fstatSync(record.fd, { bigint: true });
  ensure(stamp(record.birth) === stamp(before));
}

export function initializeFiles(key) {
  const value = state(key, arguments.length, ['reserved']);
  value.status = 'initializing';
  entry(value.phase);
  value.inputs = snapshotInputs();
  const root = value.directories[0];
  if (value.phase === 'owner') {
    allocate(root, 'mkdtemp', () => {
      root.path = fs.mkdtempSync('/tmp/dec203-bootstrap-');
      root.created = true;
      return root.path;
    });
  } else {
    const parent = facts(process.ppid);
    root.path = dirname(dirname(parent.image));
    ensure(parent.image === join(root.path, 'owner/receiving-lease-owner'));
    ensure(
      fs.readlinkSync(`/proc/${process.ppid}/exe`) === parent.image &&
        facts(process.ppid).startTime === parent.startTime,
    );
    ensure(process.cwd() === root.path);
  }
  value.root = root.path;
  openDirectory(root);
  for (const [index, name] of ['owner', 'lease'].entries()) {
    const record = value.directories[index + 1];
    record.path = join(root.path, name);
    if (value.phase === 'owner') {
      allocate(record, 'mkdir', () => {
        fs.mkdirSync(record.path, { mode: 0o700 });
        record.created = true;
        return record.path;
      });
    }
    openDirectory(record);
  }
  const output = value.output;
  output.path = join(
    root.path,
    PHASES[value.phase].directory,
    PHASES[value.phase].basename,
  );
  allocate(output, 'open-output', () => {
    output.fd = fs.openSync(
      output.path,
      fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_RDWR |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    output.created = true;
    return output.fd;
  });
  output.birth = fs.fstatSync(output.fd, { bigint: true });
  validateUnsealedOutput(output.birth);
  ensure(stamp(named(output.path)) === stamp(output.birth));
  value.status = 'initialized';
}

export function fileInfo(key) {
  const value = state(key, arguments.length, ['initialized', 'sealed']);
  return Object.freeze({
    phase: value.phase,
    root: value.root,
    inputs: value.inputs,
  });
}

function owned(record) {
  ensure(
    Number.isSafeInteger(record.fd) &&
      !record.closeAttempted &&
      record.birth !== null,
  );
  return validateOwnedStat(
    fs.fstatSync(record.fd, { bigint: true }),
    record.birth,
    record.directory,
  );
}

export function assertFiles(key) {
  const value = state(key, arguments.length, ['initialized', 'sealed']);
  for (const record of value.directories)
    ensure(stamp(named(record.path, true)) === stamp(owned(record)));
  const output = value.status === 'sealed' ? value.reader : value.output;
  ensure(stamp(named(output.path)) === stamp(owned(output)));
  if (value.sealed !== null)
    ensure(
      JSON.stringify(artifact(output.path)) === JSON.stringify(value.sealed),
    );
}

function closeSlot(record) {
  if (record.fd === null || record.closeAttempted) return;
  owned(record);
  const fd = record.fd;
  record.closeAttempted = true;
  record.fd = null;
  record.closedFd = fd;
  try {
    fs.closeSync(fd);
  } catch (error) {
    record.closeFailed = true;
    record.closeFailure = error;
    throw error;
  }
}

export function sealFiles(key) {
  const value = state(key, arguments.length, ['initialized']);
  ensure(!value.sealAttempted, 'DEC203_SUPERVISOR_REFUSED');
  value.sealAttempted = true;
  assertFiles(key);
  const output = value.output;
  const before = owned(output);
  const bytes = artifact(output.path);
  validateCompiledMode(bytes.mode, value.phase);
  ensure(bytes.size > 0 && stamp(owned(output)) === stamp(before));
  fs.fchmodSync(output.fd, value.phase === 'owner' ? 0o700 : 0o600);
  const reader = value.reader;
  reader.path = output.path;
  allocate(
    reader,
    'open-reader',
    () =>
      (reader.fd = fs.openSync(
        reader.path,
        fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
      )),
  );
  reader.birth = fs.fstatSync(reader.fd, { bigint: true });
  ensure(
    reader.birth.dev === before.dev &&
      reader.birth.ino === before.ino &&
      stamp(owned(output)) === stamp(reader.birth),
  );
  const sealed = artifact(reader.path);
  ensure(
    sealed.sha256 === bytes.sha256 &&
      sealed.mode === (value.phase === 'owner' ? 0o100700 : 0o100600),
  );
  ensure(stamp(owned(reader)) === stamp(owned(output)));
  closeSlot(output);
  value.sealed = sealed;
  value.status = 'sealed';
  return sealed;
}

export function closeFiles(key) {
  const value = state(key, arguments.length);
  if (value.closeAttempted) {
    if (value.closeFailed) throw value.closeError;
    ensure(value.status === 'closed', 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
    return;
  }
  value.closeAttempted = true;
  try {
    const output = value.output;
    value.errors.push(
      ...fileCloseFailures([value.reader, output, ...value.directories]),
    );
    if (!value.errors.length && output.created && output.path !== null) {
      try {
        const record = value.reader.fd !== null ? value.reader : output;
        const held = owned(record);
        ensure(stamp(named(output.path)) === stamp(held));
        if (value.sealed !== null)
          ensure(
            JSON.stringify(artifact(output.path)) ===
              JSON.stringify(value.sealed),
          );
        fs.unlinkSync(output.path);
        output.created = false;
      } catch (error) {
        value.errors.push(error);
      }
    }
    for (const record of [
      ...value.directories,
      output,
      value.reader,
    ].reverse()) {
      try {
        closeSlot(record);
      } catch (error) {
        value.errors.push(error);
      }
    }
    throwFileCloseErrors(value.errors);
    for (const record of [...value.directories].reverse()) {
      if (!record.created || record.path === null) continue;
      try {
        const current = named(record.path, true);
        ensure(record.birth !== null);
        validateOwnedStat(current, record.birth, true);
        fs.rmdirSync(record.path);
        record.created = false;
      } catch (error) {
        if (!['ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
        value.residue.push(record.path);
      }
    }
    ensure(value.residue.length === 0, 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
    value.status = 'closed';
    retained.delete(value);
  } catch (error) {
    value.closeFailed = true;
    value.closeError = error;
    throw error;
  }
}
