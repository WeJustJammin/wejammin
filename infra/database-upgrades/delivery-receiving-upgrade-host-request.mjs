import { Buffer } from 'node:buffer';
import { isAbsolute, normalize } from 'node:path';

import {
  assertIdentity,
  exactKeys,
  hashText,
  isRecord,
  positivePid,
  requireFact,
  sealTarget,
} from './delivery-receiving-upgrade-target.mjs';
import { SUPABASE } from './delivery-receiving-upgrade-local-target.mjs';
import {
  manifestHash,
  sha256,
} from './delivery-receiving-upgrade-local-inventory.mjs';

// Copies stay private: freezing an object does not freeze its Buffer storage.
export function snapshot(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
  if (isRecord(value)) {
    const result = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, snapshot(item)]),
    );
    return Object.freeze(result);
  }
  return value;
}

export function sameValue(left, right) {
  if (Buffer.isBuffer(left) || Buffer.isBuffer(right)) {
    return (
      Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right)
    );
  }
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  return (
    isRecord(left) &&
    isRecord(right) &&
    exactKeys(left, Object.keys(right)) &&
    Object.keys(left).every((key) => sameValue(left[key], right[key]))
  );
}

export function hostDependencies(options) {
  requireFact(
    exactKeys(options, ['fs', 'process', 'clock', 'lease']),
    'explicit host dependencies required',
  );
  const { fs, process, clock, lease } = options;
  for (const method of [
    'readFile',
    'readdir',
    'lstat',
    'stat',
    'realpath',
    'readlink',
  ]) {
    requireFact(
      typeof fs?.[method] === 'function',
      `injected fs.${method} required`,
    );
  }
  requireFact(positivePid(process?.pid), 'host PID required');
  for (const method of [
    'spawn',
    'observeBoundary',
    'readResetTrace',
    'observeBackends',
    'observeProcessTree',
    'observeDaemonWork',
  ]) {
    requireFact(
      typeof process?.[method] === 'function',
      `independent process.${method} required`,
    );
  }
  for (const method of ['now', 'setTimeout', 'clearTimeout']) {
    requireFact(
      typeof clock?.[method] === 'function',
      `injected clock.${method} required`,
    );
  }
  requireFact(
    isRecord(process.nativeBinding),
    'independent native binding required',
  );
  requireFact(
    exactKeys(lease, ['ownerPid', 'locks']) &&
      positivePid(lease.ownerPid) &&
      Array.isArray(lease.locks) &&
      lease.locks.length === 4,
    'four-lock lease required',
  );
  return {
    fs,
    process,
    clock,
    lease: snapshot(lease),
    binding: snapshot(process.nativeBinding),
  };
}

function inventory(value) {
  requireFact(
    Array.isArray(value) && value.length > 0,
    'complete inventory required',
  );
  let previous = '';
  return value.map((entry) => {
    requireFact(
      exactKeys(entry, ['path', 'bytes', 'sha256']) &&
        typeof entry.path === 'string' &&
        isAbsolute(entry.path) &&
        normalize(entry.path) === entry.path &&
        !/[\0\r\n]/.test(entry.path) &&
        entry.path > previous &&
        Buffer.isBuffer(entry.bytes) &&
        entry.bytes.length > 0 &&
        hashText(entry.sha256) &&
        sha256(entry.bytes) === entry.sha256,
      'invalid ordered inventory bytes',
    );
    previous = entry.path;
    return snapshot(entry);
  });
}

export function sealRequest(value, lease) {
  requireFact(
    exactKeys(value, [
      'command',
      'target',
      'priorIdentity',
      'fromEpoch',
      'purpose',
      'sequence',
      'inventory',
      'inventorySha256',
      'sourceSha256',
      'witnessSha256',
      'lease',
    ]),
    'owned reset request shape',
  );
  const target = sealTarget(value.target);
  requireFact(
    exactKeys(value.command, ['command', 'args']) &&
      value.command.command === SUPABASE &&
      sameValue(value.command.args, [
        'db',
        'reset',
        '--local',
        '--workdir',
        target.workdir,
      ]),
    'fixed S11 local reset command required',
  );
  requireFact(
    exactKeys(value.priorIdentity, [
      'target',
      'containerId',
      'clusterId',
      'databaseOid',
      'owner',
    ]),
    'prior identity shape',
  );
  assertIdentity(value.priorIdentity, target);
  requireFact(value.priorIdentity.owner === 'postgres', 'prior owner mismatch');
  requireFact(
    (value.purpose === 'prefix' &&
      value.sequence === 1 &&
      value.fromEpoch === null) ||
      (value.purpose === 'baseline' &&
        value.sequence === 2 &&
        (value.fromEpoch === null ||
          (typeof value.fromEpoch === 'string' &&
            /^[A-Za-z0-9_.-]{1,128}$/.test(value.fromEpoch)))),
    'invalid owned reset purpose/sequence/epoch',
  );
  requireFact(sameValue(value.lease, lease), 'foreign request lease');
  lease.locks.forEach((lock, index) => {
    requireFact(
      exactKeys(lock, ['ownerPid', 'path', 'fd', 'dev', 'inode', 'mode']) &&
        lock.ownerPid === lease.ownerPid &&
        lock.path === target.locks[index].path &&
        lock.mode === target.locks[index].mode,
      'foreign lease record shape',
    );
  });
  const entries = inventory(value.inventory);
  requireFact(
    hashText(value.inventorySha256) &&
      manifestHash(entries) === value.inventorySha256 &&
      hashText(value.sourceSha256) &&
      hashText(value.witnessSha256) &&
      value.sourceSha256 === value.witnessSha256,
    'reset source/inventory digest mismatch',
  );
  return snapshot({ ...value, target, inventory: entries });
}
