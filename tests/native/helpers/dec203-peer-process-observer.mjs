import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';

export function childrenNow() {
  const text = readFileSync(`/proc/self/task/${process.pid}/children`, 'utf8');
  const names = text.trim() ? text.trim().split(/\s+/) : [];
  for (const name of names) assert.match(name, /^[1-9][0-9]*$/);
  const pids = names.map(Number);
  for (const pid of pids) assert.ok(Number.isSafeInteger(pid));
  assert.equal(new Set(pids).size, pids.length);
  return pids;
}

function processRecord(pid) {
  const text = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const boundary = text.lastIndexOf(')');
  assert.ok(boundary > 0, 'actual process stat boundary');
  assert.equal(text.slice(0, text.indexOf(' ')), String(pid));
  const fields = text
    .slice(boundary + 2)
    .trim()
    .split(/\s+/);
  assert.ok(fields.length >= 20);
  assert.match(fields[19], /^[0-9]+$/);
  for (const index of [1, 2, 3]) {
    assert.match(fields[index], /^[0-9]+$/);
    assert.ok(Number.isSafeInteger(Number(fields[index])));
  }
  return {
    pid,
    parent: Number(fields[1]),
    group: Number(fields[2]),
    session: Number(fields[3]),
    start: fields[19],
    state: fields[0],
  };
}

export function compilerRecord(pid, compiler) {
  const record = {
    ...processRecord(pid),
    uid: lstatSync(`/proc/${pid}`).uid,
    exe: realpathSync(`/proc/${pid}/exe`),
  };
  assert.equal(record.uid, process.getuid(), 'actual compiler UID');
  assert.equal(record.parent, process.pid, 'actual direct compiler parent');
  assert.equal(record.group, pid, 'fresh compiler process group');
  assert.equal(record.session, pid, 'fresh compiler session');
  assert.match(record.start, /^[1-9][0-9]*$/);
  assert.equal(record.exe, compiler, 'canonical actual compiler executable');
  return record;
}

export function sameCompiler(expected, actual) {
  for (const key of [
    'pid',
    'parent',
    'group',
    'session',
    'start',
    'uid',
    'exe',
  ]) {
    assert.equal(actual[key], expected[key], `owned compiler ${key} fence`);
  }
}

export function sessionAbsent(session) {
  for (const name of readdirSync('/proc')) {
    if (!/^[1-9][0-9]*$/.test(name)) continue;
    try {
      if (processRecord(Number(name)).session === session) return false;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    }
  }
  return true;
}
