import assert from 'node:assert/strict';
import { isAbsolute, join, resolve } from 'node:path';

const records = new WeakMap();
const positive = (value) => Number.isSafeInteger(value) && value > 0;

function core(value) {
  assert.ok(positive(value.pid) && positive(value.ppid));
  assert.ok(Number.isSafeInteger(value.uid) && value.uid >= 0);
  assert.equal(typeof value.startTime, 'string');
  assert.match(value.startTime, /^[1-9][0-9]*$/);
  assert.equal(typeof value.namespace, 'string');
  return {
    pid: value.pid,
    ppid: value.ppid,
    startTime: value.startTime,
    uid: value.uid,
    namespace: value.namespace,
  };
}

function begin(record, count, expected) {
  assert.ok(!record.failed);
  record.failed = true;
  assert.equal(count, expected);
}

function parent(record, value) {
  if (record.outer === null) return;
  assert.deepEqual(
    [value.ppid, value.uid, value.namespace],
    [record.outer.pid, record.outer.uid, record.outer.namespace],
  );
}

function bindOuter(record, outer) {
  const value = {
    pid: outer.process.pid,
    uid: outer.process.uid,
    namespace: outer.namespace,
    group: outer.group,
    session: outer.process.session,
  };
  assert.ok(
    positive(value.pid) && positive(value.group) && positive(value.session),
  );
  assert.ok(Number.isSafeInteger(value.uid) && value.uid >= 0);
  assert.equal(typeof value.namespace, 'string');
  if (record.outer === null) record.outer = value;
  else assert.deepEqual(value, record.outer);
  if (record.compiler !== null) parent(record, record.compiler.core);
}

function pair(value) {
  assert.ok(positive(value.group) && positive(value.session));
  return [value.group, value.session];
}

function compilerPair(record, value, gcc) {
  const observed = pair(value);
  const detached = observed.every((part) => part === value.pid);
  const inherited =
    record.outer !== null &&
    observed[0] === record.outer.group &&
    observed[1] === record.outer.session;
  assert.ok(detached || (!gcc && inherited));
  assert.ok(!record.compiler.detached || detached);
  record.compiler.detached ||= detached;
}

function bracket(value) {
  return {
    ...value.process,
    group: value.group,
    namespace: value.namespace,
    image: value.process.executable.path,
  };
}

function considerOwner(record, raw, value) {
  assert.ok(record.compiler?.resolved);
  assert.notEqual(value.pid, record.compiler.core.pid);
  parent(record, value);
  assert.deepEqual(pair(raw), [record.outer.group, record.outer.session]);
  if (record.owner === null)
    record.owner = { core: value, image: null, complete: false };
  else assert.deepEqual(value, record.owner.core);
  const owner = record.owner;
  if (raw.image === record.fixedNode) {
    assert.ok(!owner.complete && owner.image === null);
    return true;
  }
  if (owner.image === null) owner.image = raw.image;
  else assert.equal(raw.image, owner.image);
  return false;
}

export function createPendingCompilerExec(fixedNode, fixedGcc) {
  assert.equal(arguments.length, 2);
  assert.equal(typeof fixedNode, 'string');
  assert.equal(typeof fixedGcc, 'string');
  assert.notEqual(fixedNode, fixedGcc);
  const record = {
    fixedNode,
    fixedGcc,
    outer: null,
    compiler: null,
    owner: null,
    failed: false,
  };
  const state = Object.freeze({
    consider(raw, outer) {
      begin(record, arguments.length, 2);
      const ownerImage =
        typeof raw.image === 'string' &&
        raw.image.endsWith('/owner/receiving-lease-owner');
      if (![fixedNode, fixedGcc].includes(raw.image) && !ownerImage) {
        assert.ok(
          raw.pid !== record.compiler?.core.pid &&
            raw.pid !== record.owner?.core.pid,
        );
        record.failed = false;
        return false;
      }
      bindOuter(record, outer);
      const value = core(raw);
      if (
        ownerImage ||
        (raw.image === fixedNode &&
          record.compiler?.resolved &&
          raw.pid !== record.compiler.core.pid)
      ) {
        const pending = considerOwner(record, raw, value);
        record.failed = false;
        return pending;
      }
      assert.equal(record.owner, null);
      parent(record, value);
      if (record.compiler === null)
        record.compiler = { core: value, detached: false, resolved: false };
      else assert.deepEqual(value, record.compiler.core);
      assert.ok(!record.compiler.resolved || raw.image === fixedGcc);
      compilerPair(record, raw, raw.image === fixedGcc);
      record.failed = false;
      return raw.image === fixedNode;
    },
    resolve(compiler) {
      begin(record, arguments.length, 1);
      assert.equal(record.owner, null);
      const raw = bracket(compiler);
      assert.equal(raw.image, fixedGcc);
      const value = core(raw);
      parent(record, value);
      if (record.compiler === null)
        record.compiler = { core: value, detached: false, resolved: false };
      else assert.deepEqual(value, record.compiler.core);
      compilerPair(record, raw, true);
      record.compiler.resolved = true;
      record.failed = false;
    },
    assertComplete() {
      if (arguments.length !== 0) {
        record.failed = true;
        assert.fail('zero-argument completion required');
      }
      assert.ok(
        !record.failed &&
          (record.compiler === null || record.compiler.resolved) &&
          (record.owner === null || record.owner.complete),
      );
    },
  });
  records.set(state, record);
  return state;
}

export function completeOwnerPending(state, value, actualRoot) {
  const record = records.get(state);
  assert.ok(record);
  begin(record, arguments.length, 3);
  assert.ok(record.compiler?.resolved && record.owner !== null);
  assert.equal(typeof actualRoot, 'string');
  assert.ok(isAbsolute(actualRoot) && resolve(actualRoot) === actualRoot);
  const raw = bracket(value);
  const expected = join(actualRoot, 'owner/receiving-lease-owner');
  assert.equal(raw.image, expected);
  assert.equal(value.cwd, actualRoot);
  assert.deepEqual(core(raw), record.owner.core);
  parent(record, record.owner.core);
  assert.deepEqual(pair(raw), [record.outer.group, record.outer.session]);
  if (record.owner.image !== null) assert.equal(raw.image, record.owner.image);
  record.owner.image = raw.image;
  record.owner.complete = true;
  record.failed = false;
}
