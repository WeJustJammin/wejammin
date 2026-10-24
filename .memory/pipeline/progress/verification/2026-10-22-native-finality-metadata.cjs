'use strict';

/* global require, module, Buffer, TextDecoder */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS VM boundary
const fs = require('node:fs');

const TARGET_PATH =
  '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/verification/2026-10-22-native-finality-audit-target.json';
const CGROUP_ROOT = '/sys/fs/cgroup';
const TARGET_LIMIT = 8192;
const STATUS_LIMIT = 65536;
const TARGET_KEYS = 'container,daemon,database,id,imageId,initPid,project';

const auditError = (code, stage, secondaryCodes = []) => ({
  code,
  stage,
  secondaryCodes,
});
const reject = (code, stage, secondaryCodes = []) => {
  throw auditError(code, stage, secondaryCodes);
};
const errorCode = (error) =>
  error && typeof error.code === 'string' ? error.code : 'AUDIT_FAILED';
const envelope = (state, target, members, frames, failure) => ({
  kind: 'diagnostic-only-native-finality-metadata',
  state,
  target,
  members,
  frames,
  failure,
});
const readText = (path, limit, stage, invalidCode = 'AUDIT_FAILED') => {
  let fd;
  try {
    fd = fs.openSync(path, 'r');
  } catch (error) {
    reject(errorCode(error), stage);
  }
  const buffer = Buffer.alloc(limit + 1);
  let text;
  let primary = null;
  try {
    const count = fs.readSync(fd, buffer, 0, limit + 1, null);
    if (!Number.isSafeInteger(count) || count < 0 || count > limit)
      primary = auditError('AUDIT_LIMIT', stage);
    else {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(
          buffer.subarray(0, count),
        );
      } catch {
        primary = auditError(invalidCode, stage);
      }
    }
  } catch (error) {
    primary = auditError(errorCode(error), stage);
  }
  const secondaryCodes = [];
  try {
    fs.closeSync(fd);
  } catch (error) {
    if (primary) secondaryCodes.push(errorCode(error));
    else primary = auditError(errorCode(error), stage);
  }
  if (primary) throw { ...primary, secondaryCodes };
  return text;
};

const asNumber = (value, pattern) =>
  pattern.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
const positive = (value) => asNumber(value, /^[1-9]\d*$/);
const nonnegative = (value) => asNumber(value, /^\d+$/);

const parseTarget = (text) => {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    reject('AUDIT_INVALID_TARGET', 'target');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    reject('AUDIT_INVALID_TARGET', 'target');
  if (Object.keys(value).sort().join(',') !== TARGET_KEYS)
    reject('AUDIT_INVALID_TARGET', 'target');
  if (
    value.container !== 'supabase_db_wejammin_ev' ||
    value.project !== 'wejammin_ev' ||
    value.database !== 'postgres' ||
    value.daemon !== 'unix:///run/docker.sock' ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.id) ||
    typeof value.imageId !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(value.imageId) ||
    !Number.isSafeInteger(value.initPid) ||
    value.initPid <= 0
  )
    reject('AUDIT_INVALID_TARGET', 'target');
  return value;
};

const parseStat = (text, pid) => {
  const line = text.endsWith('\n') ? text.slice(0, -1) : text;
  const close = line.lastIndexOf(') ');
  const match = (close < 0 ? '' : line.slice(0, close)).match(/^(\d+) \(/);
  if (!match || Number(match[1]) !== pid || close < 0)
    reject('AUDIT_MALFORMED_STAT', `stat:${pid}`);
  const fields = line.slice(close + 2).split(' ');
  if (fields.length < 20 || fields.some((field) => field === ''))
    reject('AUDIT_MALFORMED_STAT', `stat:${pid}`);
  if (fields[0] === 'Z' || fields[0] === 'X')
    reject('AUDIT_MALFORMED_STAT', `stat:${pid}`);
  const ppid = positive(fields[1]);
  const group = positive(fields[2]);
  const session = positive(fields[3]);
  if (
    ppid === null ||
    group === null ||
    session === null ||
    !/^[1-9]\d*$/.test(fields[19])
  )
    reject('AUDIT_MALFORMED_STAT', `stat:${pid}`);
  return { ppid, group, session, startTime: fields[19] };
};

const parseStatus = (text, pid, stat) => {
  const values = new Map();
  for (const line of text.split('\n')) {
    const separator = line.indexOf(':\t');
    if (separator < 0) continue;
    const key = line.slice(0, separator);
    if (!['Pid', 'PPid', 'Uid', 'NSpid'].includes(key)) continue;
    if (values.has(key)) reject('AUDIT_MALFORMED_STATUS', `status:${pid}`);
    values.set(key, line.slice(separator + 2));
  }
  if (!['Pid', 'PPid', 'Uid', 'NSpid'].every((key) => values.has(key)))
    reject('AUDIT_MALFORMED_STATUS', `status:${pid}`);
  const parsedPid = positive(values.get('Pid'));
  const ppid = positive(values.get('PPid'));
  const uids = values.get('Uid').split('\t').map(nonnegative);
  const nspid = values.get('NSpid').split('\t').map(positive);
  if (
    parsedPid !== pid ||
    ppid !== stat.ppid ||
    uids.length !== 4 ||
    uids.some((value) => value === null) ||
    nspid.length === 0 ||
    nspid.some((value) => value === null) ||
    nspid[0] !== pid
  )
    reject('AUDIT_MALFORMED_STATUS', `status:${pid}`);
  return { uids, nspid };
};

const parseCgroup = (text, id) => {
  const lines = text.split('\n').filter((line) => line.length > 0);
  if (lines.length !== 1 || !lines[0].startsWith('0::/'))
    reject('AUDIT_UNSUPPORTED_CGROUP', 'cgroup');
  const value = lines[0].slice(3);
  const segments = value.split('/').slice(1);
  if (
    !segments.length ||
    segments.some((segment) => segment === '' || segment === '.')
  )
    reject('AUDIT_CGROUP_ESCAPE', 'cgroup');
  if (segments.some((segment) => segment === '..'))
    reject('AUDIT_CGROUP_ESCAPE', 'cgroup');
  const leaf = segments[segments.length - 1];
  if (leaf !== id && leaf !== `docker-${id}.scope`)
    reject('AUDIT_UNSUPPORTED_CGROUP', 'cgroup');
  return value;
};

const parseNamespace = (value, pid) => {
  if (!/^pid:\[[1-9]\d*\]$/.test(value))
    reject('AUDIT_MALFORMED_NAMESPACE', `namespace:${pid}`);
  return value;
};
const taskPath = (pid, file) => `/proc/${pid}/${file}`;
const frameEqual = (left, right) => {
  const normalized = { ...left, round: right.round };
  return (
    left.round !== right.round &&
    JSON.stringify(normalized) === JSON.stringify(right)
  );
};

const readTask = (pid, round, targetId, expectedCgroup, expectedNamespace) => {
  const statPath = taskPath(pid, 'stat');
  const stat = parseStat(readText(statPath, TARGET_LIMIT, `stat:${pid}`), pid);
  const status = parseStatus(
    readText(taskPath(pid, 'status'), STATUS_LIMIT, `status:${pid}`),
    pid,
    stat,
  );
  const cgroup = parseCgroup(
    readText(taskPath(pid, 'cgroup'), TARGET_LIMIT, `cgroup:${pid}`),
    targetId,
  );
  if (expectedCgroup !== undefined && cgroup !== expectedCgroup)
    reject('AUDIT_IDENTITY_CHANGED', `cgroup:${pid}`);
  let namespace;
  try {
    namespace = fs.readlinkSync(taskPath(pid, 'ns/pid'));
  } catch (error) {
    reject(errorCode(error), `namespace:${pid}`);
  }
  namespace = parseNamespace(namespace, pid);
  if (expectedNamespace !== undefined && namespace !== expectedNamespace)
    reject('AUDIT_IDENTITY_CHANGED', `namespace:${pid}`);
  const finalStat = parseStat(
    readText(statPath, TARGET_LIMIT, `stat:${pid}`),
    pid,
  );
  if (JSON.stringify(stat) !== JSON.stringify(finalStat))
    reject('AUDIT_IDENTITY_CHANGED', `stat:${pid}`);
  return {
    round,
    pid,
    ppid: stat.ppid,
    group: stat.group,
    session: stat.session,
    startTime: stat.startTime,
    uids: status.uids,
    nspid: status.nspid,
    namespace,
    cgroup,
  };
};

const readMembership = (path, initPid) => {
  const lines = readText(path, STATUS_LIMIT, 'cgroup.procs')
    .split('\n')
    .filter((line) => line.length > 0);
  if (lines.length === 0 || lines.length > 256)
    reject('AUDIT_LIMIT', 'cgroup.procs');
  const members = lines.map(positive);
  if (
    members.some((value) => value === null) ||
    new Set(members).size !== members.length ||
    !members.includes(initPid)
  )
    reject('AUDIT_LIMIT', 'cgroup.procs');
  members.sort((left, right) => left - right);
  return members;
};

function runMetadataAudit() {
  const frames = [];
  let target = null;
  let members = [];
  try {
    target = parseTarget(
      readText(TARGET_PATH, TARGET_LIMIT, 'target', 'AUDIT_INVALID_TARGET'),
    );
    const init = readTask(target.initPid, 0, target.id);
    const groupPath = `${CGROUP_ROOT}${init.cgroup}`;
    const canonicalPaths = [
      CGROUP_ROOT,
      groupPath,
      `${groupPath}/cgroup.procs`,
    ];
    for (const path of canonicalPaths) {
      let resolved;
      try {
        resolved = fs.realpathSync(path);
      } catch (error) {
        reject(errorCode(error), `realpath:${path}`);
      }
      if (resolved !== path) reject('AUDIT_CGROUP_ESCAPE', `realpath:${path}`);
    }
    members = readMembership(canonicalPaths[2], target.initPid);
    frames.push(init);
    for (const pid of members) {
      if (pid === target.initPid) continue;
      frames.push(readTask(pid, 0, target.id, init.cgroup, init.namespace));
    }
    const roundZero = new Map(frames.map((frame) => [frame.pid, frame]));
    for (const pid of members) {
      const frame = readTask(pid, 1, target.id, init.cgroup, init.namespace);
      if (!frameEqual(roundZero.get(pid), frame))
        reject('AUDIT_IDENTITY_CHANGED', `stat:${pid}`);
      frames.push(frame);
    }
    const final = readMembership(canonicalPaths[2], target.initPid);
    if (JSON.stringify(final) !== JSON.stringify(members))
      reject('AUDIT_MEMBERSHIP_CHANGED', 'cgroup.procs');
    return envelope('complete', target, members, frames, null);
  } catch (error) {
    const problem =
      error && typeof error.code === 'string' && typeof error.stage === 'string'
        ? error
        : auditError('AUDIT_FAILED', 'audit');
    return envelope('refused', target, members, frames, problem);
  }
}

module.exports = { runMetadataAudit };
