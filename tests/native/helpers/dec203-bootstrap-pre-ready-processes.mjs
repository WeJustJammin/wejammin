import assert from 'node:assert/strict';
import {
  closeSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import {
  coordinator,
  gcc,
  launcher,
  native,
  node,
  repository,
} from './dec203-bootstrap-pre-ready-artifacts.mjs';
import * as liveValues from './dec203-bootstrap-pre-ready-values.mjs';

export function processes(result) {
  const actual = result.observer.seen.processes;
  for (const role of [
    'outer',
    'owner-compiler',
    'owner',
    'coordinator',
    'lease-compiler',
  ]) {
    assert.ok(actual.has(role), `live independently derived ${role} required`);
  }
  const o = actual.get('outer');
  const c = actual.get('owner');
  const i = actual.get('coordinator');
  const id = result.records[0].bootstrapId;
  assert.deepEqual(o.argv, [node, '--', launcher]);
  assert.equal(o.cwd, resolve(repository));
  assert.deepEqual(c.argv, [
    join(result.artifacts.root, 'owner/receiving-lease-owner'),
    id,
  ]);
  assert.deepEqual(i.argv, [node, '--', coordinator, id]);
  assert.equal(c.cwd, result.artifacts.root);
  assert.equal(i.cwd, result.artifacts.root);
  assert.equal(c.process.ppid, o.process.pid);
  assert.equal(i.process.ppid, c.process.pid);
  for (const value of actual.values())
    assert.equal(value.namespace, o.namespace);
  assert.equal(
    new Set([...actual.values()].map((value) => value.process.pid)).size,
    5,
  );
  for (const role of ['owner-compiler', 'lease-compiler']) {
    const compiler = actual.get(role);
    assert.equal(compiler.process.executable.path, gcc);
    assert.equal(
      compiler.process.ppid,
      role === 'owner-compiler' ? o.process.pid : i.process.pid,
    );
    assert.equal(compiler.process.session, compiler.process.pid);
    assert.equal(compiler.group, compiler.process.pid);
  }
  assert.deepEqual(actual.get('owner-compiler').argv, [
    gcc,
    '-std=c11',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-D_GNU_SOURCE',
    join(native, 'receiving-lease-owner.c'),
    '-o',
    c.process.executable.path,
  ]);
  assert.deepEqual(actual.get('lease-compiler').argv, [
    gcc,
    '-std=c11',
    '-O2',
    '-fPIC',
    '-shared',
    '-pthread',
    '-DNAPI_VERSION=8',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-I',
    '/usr/include/node',
    join(native, 'receiving-lease.c'),
    '-o',
    join(result.artifacts.root, 'lease/receiving-lease.node'),
  ]);
  for (const value of result.records.filter(
    (entry) => entry.kind === 'process',
  )) {
    assert.deepEqual(value.body.process, actual.get(value.body.role)?.process);
  }
  for (const role of [
    'owner-compiler',
    'owner',
    'coordinator',
    'lease-compiler',
  ]) {
    assert.ok(
      result.records.some(
        (entry) => entry.kind === 'process' && entry.body.role === role,
      ),
    );
  }
  return { actual, o, c, i };
}

export function text(path, limit = 65_536) {
  const bytes = Buffer.alloc(limit + 1);
  const fd = openSync(path, 'r');
  let length = 0;
  let primary;
  let primaryFailed = false;
  let result;
  try {
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    assert.ok(length <= limit, 'bounded kernel observation');
    result = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(0, length),
    );
  } catch (error) {
    primary = error;
    primaryFailed = true;
  }
  let closeFailure;
  let closeFailed = false;
  try {
    closeSync(fd);
  } catch (error) {
    closeFailure = error;
    closeFailed = true;
  }
  if (closeFailed) {
    if (primaryFailed)
      throw new AggregateError(
        [primary, closeFailure],
        'kernel observation close',
        {
          cause: primary,
        },
      );
    throw closeFailure;
  }
  if (primaryFailed) throw primary;
  return result;
}

export function facts(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const raw = text(`/proc/${pid}/stat`);
  const fields = liveValues.liveStatFields(raw, pid);
  const result = {
    pid,
    ppid: Number(fields[1]),
    group: Number(fields[2]),
    session: Number(fields[3]),
    startTime: fields[19],
    uid: Number(lstatSync(`/proc/${pid}`).uid),
    image: readlinkSync(`/proc/${pid}/exe`),
    namespace: readlinkSync(`/proc/${pid}/ns/pid`),
  };
  for (const key of ['ppid', 'group', 'session']) {
    assert.ok(Number.isSafeInteger(result[key]) && result[key] > 0);
  }
  assert.equal(result.uid, process.getuid());
  return result;
}

export function processInfo(pid, artifacts) {
  const before = facts(pid);
  assert.ok(
    [node, gcc].includes(before.image) ||
      before.image ===
        join(artifacts.root ?? '', 'owner/receiving-lease-owner'),
  );
  const executable = artifacts.capture(before.image);
  const argv = liveValues.liveArguments(text(`/proc/${pid}/cmdline`));
  const cwd = readlinkSync(`/proc/${pid}/cwd`);
  assert.deepEqual(facts(pid), before);
  return {
    process: {
      pid,
      ppid: before.ppid,
      startTime: before.startTime,
      session: before.session,
      uid: before.uid,
      executable,
    },
    argv,
    cwd,
    group: before.group,
    namespace: before.namespace,
  };
}

export const children = (pid) =>
  text(`/proc/${pid}/task/${pid}/children`)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => {
      assert.match(value, /^[1-9][0-9]*$/);
      const pid = Number(value);
      assert.ok(Number.isSafeInteger(pid));
      return pid;
    });

export function childClassificationMessage(raw, o) {
  return JSON.stringify({
    imageClass:
      raw.image === node
        ? 'fixed-node'
        : raw.image === gcc
          ? 'fixed-gcc'
          : raw.image.endsWith('/owner/receiving-lease-owner')
            ? 'owner-suffix'
            : 'other',
    pid: raw.pid,
    ppid: raw.ppid,
    group: raw.group,
    session: raw.session,
    startTime: raw.startTime,
    uid: raw.uid,
    parentMatchesOuter: raw.ppid === o.process.pid,
    namespaceMatchesOuter: raw.namespace === o.namespace,
    uidMatchesOuter: raw.uid === o.process.uid,
    groupIsSelf: raw.group === raw.pid,
    sessionIsSelf: raw.session === raw.pid,
  });
}

function absenceStat(raw, pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.ok(Buffer.byteLength(raw) <= 65_536);
  const prefix = `${pid} (`;
  assert.ok(raw.startsWith(prefix));
  const closing = raw.lastIndexOf(') ');
  assert.ok(closing >= prefix.length, 'actual closing comm delimiter required');
  const fields = raw
    .slice(closing + 2)
    .trim()
    .split(/\s+/);
  assert.ok(fields.length >= 20, 'required stat fields must exist');
  assert.match(fields[0], /^[A-Za-z]$/);
  for (const value of fields.slice(1))
    assert.match(value, /^(0|-?[1-9][0-9]*)$/);
  for (const index of [1, 2, 3, 19])
    assert.match(fields[index], /^(0|[1-9][0-9]*)$/);
  const session = Number(fields[3]);
  assert.ok(Number.isSafeInteger(session) && session >= 0);
  return { startTime: fields[19], session };
}

export function assertAbsent(record) {
  assert.ok(Number.isSafeInteger(record.pid) && record.pid > 0);
  assert.match(record.startTime, /^(0|[1-9][0-9]*)$/);
  try {
    const raw = text(`/proc/${record.pid}/stat`);
    const actual = absenceStat(raw, record.pid);
    assert.notEqual(
      actual.startTime,
      record.startTime,
      'original owned instance must be absent',
    );
  } catch (error) {
    if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
  }
}

export function assertSessionAbsent(session) {
  assert.ok(Number.isSafeInteger(session) && session > 0);
  for (const name of readdirSync('/proc')) {
    if (!/^[1-9][0-9]*$/.test(name)) continue;
    try {
      const raw = text(`/proc/${name}/stat`);
      const actual = absenceStat(raw, Number(name));
      assert.notEqual(
        actual.session,
        session,
        'owned compiler session must be empty',
      );
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
    }
  }
}

export function assertCompilerAbsent(info) {
  assertAbsent(info.process);
  assertSessionAbsent(info.process.session);
}
