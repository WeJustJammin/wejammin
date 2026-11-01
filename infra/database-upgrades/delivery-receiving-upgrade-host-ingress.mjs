import { Buffer } from 'node:buffer';
import { isAbsolute, join, normalize } from 'node:path';
import { getuid } from 'node:process';

import {
  exactKeys,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';

const UPSTREAM = 'unix:///run/docker.sock';

function decimal(value, zero) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !/[^0-9]/.test(value) &&
    (value === '0' ? zero : value[0] !== '0')
  );
}

function identity(value, mode, uid) {
  return (
    exactKeys(value, ['path', 'device', 'inode', 'mode', 'uid']) &&
    typeof value.path === 'string' &&
    isAbsolute(value.path) &&
    normalize(value.path) === value.path &&
    !/[\0\r\n]/.test(value.path) &&
    decimal(value.device, true) &&
    decimal(value.inode, false) &&
    value.mode === mode &&
    Number.isSafeInteger(value.uid) &&
    value.uid >= 0 &&
    value.uid === uid
  );
}

// Shape validation permits getuid only: no filesystem, launch or process inspection.
export function assertIngress(ingress) {
  const uid = typeof getuid === 'function' ? getuid() : undefined;
  requireFact(
    Number.isSafeInteger(uid) &&
      uid >= 0 &&
      exactKeys(ingress, [
        'parent',
        'socket',
        'endpoint',
        'upstreamEndpoint',
      ]) &&
      identity(ingress.parent, 0o040700, uid) &&
      identity(ingress.socket, 0o140600, uid) &&
      ingress.socket.path === join(ingress.parent.path, 'docker.sock') &&
      Buffer.byteLength(ingress.socket.path, 'utf8') < 108 &&
      (ingress.parent.device !== ingress.socket.device ||
        ingress.parent.inode !== ingress.socket.inode) &&
      ingress.endpoint === 'unix://' + ingress.socket.path &&
      ingress.upstreamEndpoint === UPSTREAM &&
      ingress.endpoint !== UPSTREAM,
    'invalid private ingress binding',
  );
}

function sameObservation(stat, expected, kind) {
  return (
    stat !== null &&
    typeof stat === 'object' &&
    typeof stat.dev === 'bigint' &&
    typeof stat.ino === 'bigint' &&
    typeof stat.mode === 'bigint' &&
    typeof stat.uid === 'bigint' &&
    typeof stat.isSymbolicLink === 'function' &&
    stat.isSymbolicLink() === false &&
    typeof stat[kind] === 'function' &&
    stat[kind]() === true &&
    stat.dev === BigInt(expected.device) &&
    stat.ino === BigInt(expected.inode) &&
    stat.mode === BigInt(expected.mode) &&
    stat.uid === BigInt(expected.uid)
  );
}

// Repeated pathname snapshots do not manufacture ownership or lifetime authority.
export async function verifyIngress(fs, ingress) {
  assertIngress(ingress);
  for (const [part, kind] of [
    ['parent', 'isDirectory'],
    ['socket', 'isSocket'],
  ]) {
    const expected = ingress[part];
    const before = await fs.lstat(expected.path, { bigint: true });
    const resolved = await fs.realpath(expected.path);
    const after = await fs.lstat(expected.path, { bigint: true });
    requireFact(
      resolved === expected.path &&
        sameObservation(before, expected, kind) &&
        sameObservation(after, expected, kind),
      'changed private ingress filesystem identity',
    );
  }
}
