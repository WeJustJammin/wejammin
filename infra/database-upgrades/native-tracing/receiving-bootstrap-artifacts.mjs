import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRECTORY,
  PROFILE,
  SOURCE_NAMES,
} from './receiving-bootstrap-profile.mjs';
import { ensure, failure, stamp } from './receiving-bootstrap-resources.mjs';

export {
  failure,
  ensure,
  stamp,
  validateOwnedStat,
  throwFileCloseErrors,
} from './receiving-bootstrap-resources.mjs';

const ledgers = new WeakMap();
const retained = new Set();
let active = null;

export function reservedFileSlot(directory) {
  ensure(typeof directory === 'boolean', 'DEC203_SUPERVISOR_REFUSED');
  return {
    directory,
    path: null,
    fd: null,
    birth: null,
    closeAttempted: false,
    closeFailed: false,
    closeFailure: undefined,
    created: false,
    allocations: [],
  };
}

export function reservedFileLedger(phase) {
  ensure(['owner', 'lease'].includes(phase), 'DEC203_SUPERVISOR_REFUSED');
  return {
    phase,
    status: 'reserved',
    root: null,
    inputs: null,
    directories: [
      reservedFileSlot(true),
      reservedFileSlot(true),
      reservedFileSlot(true),
    ],
    output: reservedFileSlot(false),
    reader: reservedFileSlot(false),
    sealAttempted: false,
    sealed: null,
    errors: [],
    residue: [],
    closeAttempted: false,
    closeFailed: false,
    closeError: undefined,
  };
}

export function reservedOwnerChannelState() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return {
    initialized: false,
    spawnAttempted: false,
    child: null,
    wait: null,
    streams: {
      input: null,
      stdout: null,
      stderr: null,
      commandsRead: null,
      commandsWrite: null,
      eventsRead: null,
      eventsWrite: null,
    },
    id: null,
    decoder: null,
    decoderFatal: false,
    seq: 0n,
    slots: new Set(),
    issued: new Set(),
    written: new Set(),
    arrived: new Set(),
    pending: new Set(),
    frames: [],
    finishing: false,
    ended: new Set(),
    failure: null,
    settlement: null,
  };
}

export function fileCloseFailures(slots) {
  const errors = [];
  for (const slot of slots) {
    if (slot.closeFailed) errors.push(slot.closeFailure);
    if (slot.allocations.some((attempt) => !attempt.returned))
      errors.push(failure('DEC203_SUPERVISOR_DRAIN_UNCERTAIN'));
  }
  return errors;
}

export function reservedEntryState() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return {
    guard: null,
    ledger: null,
    input: null,
    inputAttempted: false,
    workspace: null,
    build: null,
    buildAttempted: false,
    channel: null,
    view: null,
    observer: null,
    diagnostics: null,
    terminalEmitted: false,
    failure: null,
    secondary: [],
    closeDeadline: null,
    uncertain: false,
  };
}

export function reserveInspectionLedger() {
  ensure(
    arguments.length === 0 && active === null,
    'DEC203_SUPERVISOR_REFUSED',
  );
  ensure(
    fileURLToPath(import.meta.url) ===
      `${DIRECTORY}/receiving-bootstrap-artifacts.mjs`,
  );
  const key = Object.freeze({});
  active = { key, slots: new Set(), finished: false };
  ledgers.set(key, active);
  retained.add(active);
  return key;
}

export function assertInspectionLedgerClear(key) {
  const ledger = ledgers.get(key);
  ensure(
    arguments.length === 1 &&
      ledger !== undefined &&
      ledger === active &&
      !ledger.finished,
    'DEC203_SUPERVISOR_REFUSED',
  );
  ensure(ledger.slots.size === 0, 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
}

export function finishInspectionLedger(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  assertInspectionLedgerClear(key);
  const ledger = ledgers.get(key);
  ledger.finished = true;
  retained.delete(ledger);
}

export function named(path, directory = false) {
  ensure(realpathSync(path) === path);
  const stat = lstatSync(path, { bigint: true });
  ensure(
    !stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()),
  );
  return stat;
}

function inspect(path, flags, action) {
  ensure(active !== null && !active.finished, 'DEC203_SUPERVISOR_REFUSED');
  const slot = {
    path,
    fd: null,
    closeAttempted: false,
    closeFailure: undefined,
  };
  active.slots.add(slot);
  let primary;
  let failed = false;
  let result;
  try {
    slot.fd = openSync(path, flags);
    result = action(slot.fd);
  } catch (error) {
    primary = error;
    failed = true;
  }
  let closeFailed = false;
  if (slot.fd !== null) {
    slot.closeAttempted = true;
    try {
      closeSync(slot.fd);
    } catch (error) {
      slot.closeFailure = error;
      closeFailed = true;
    }
  }
  if (!closeFailed) active.slots.delete(slot);
  if (closeFailed && failed)
    throw new AggregateError(
      [primary, slot.closeFailure],
      'owned artifact close',
      { cause: primary },
    );
  if (closeFailed) throw slot.closeFailure;
  if (failed) throw primary;
  return result;
}

export function artifact(path) {
  named(path);
  const bytes = Buffer.alloc(65_536);
  return inspect(path, constants.O_RDONLY | constants.O_NOFOLLOW, (fd) => {
    const before = fstatSync(fd, { bigint: true });
    ensure(before.isFile() && Number.isSafeInteger(Number(before.size)));
    ensure(stamp(named(path)) === stamp(before));
    const hash = createHash('sha256');
    let size = 0;
    for (;;) {
      const count = readSync(fd, bytes, 0, bytes.length, size);
      if (!count) break;
      size += count;
      ensure(Number.isSafeInteger(size) && BigInt(size) <= before.size);
      hash.update(bytes.subarray(0, count));
    }
    ensure(BigInt(size) === before.size);
    ensure(stamp(fstatSync(fd, { bigint: true })) === stamp(before));
    ensure(stamp(named(path)) === stamp(before));
    return Object.freeze({
      path,
      sha256: hash.digest('hex'),
      device: String(before.dev),
      inode: String(before.ino),
      size,
      mode: Number(before.mode),
      uid: Number(before.uid),
    });
  });
}

export function kernelText(path, limit = 65_536) {
  ensure(
    path.startsWith('/proc/') &&
      Number.isSafeInteger(limit) &&
      limit > 0 &&
      limit <= 1_048_576,
    'DEC203_SUPERVISOR_REFUSED',
  );
  const bytes = Buffer.alloc(limit + 1);
  return inspect(path, constants.O_RDONLY, (fd) => {
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    ensure(size <= limit, 'DEC203_SUPERVISOR_HISTORY_GAP');
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes.subarray(0, size),
    );
  });
}

export function snapshotInputs() {
  const records = [
    ...PROFILE.map((value) => artifact(value.path)),
    ...SOURCE_NAMES.map((name) => artifact(join(DIRECTORY, name))),
  ];
  for (const expected of PROFILE) {
    const actual = records.find((value) => value.path === expected.path);
    for (const [key, value] of Object.entries(expected))
      ensure(actual[key] === value);
  }
  return Object.freeze(records);
}

export function assertInputs(records) {
  for (const record of records)
    ensure(JSON.stringify(artifact(record.path)) === JSON.stringify(record));
}
