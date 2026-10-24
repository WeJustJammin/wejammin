import assert from 'node:assert/strict';
import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  gcc,
  headers,
  lockPaths,
  native,
  node,
} from './dec203-bootstrap-pre-ready-artifacts.mjs';
import { assertInventoryPayload } from './dec203-bootstrap-pre-ready-values.mjs';
export { processes } from './dec203-bootstrap-pre-ready-processes.mjs';

export const one = (records, kind, predicate = () => true) => {
  const values = records.filter(
    (value) => value.kind === kind && predicate(value.body),
  );
  assert.equal(values.length, 1, `one ${kind} record required`);
  return values[0];
};

export const objectKey = (value) => `${value.device}:${value.inode}`;
export const fd = (value, number) => {
  const found = value.fds.find((entry) => entry.fd === number);
  assert.ok(found, `actual FD${number} premise missing`);
  return found;
};
export function lease(result, processSet) {
  const raw = result.observer.seen;
  const owner = raw.inventories.get('owner-leased');
  const precompile = raw.inventories.get('coordinator-precompile');
  const pair = raw.compilerPair;
  assert.ok(
    owner && precompile && pair,
    'actual held lease/precompile/GCC pair required',
  );
  for (const inventory of [owner, precompile, pair.owner, pair.coordinator]) {
    assert.equal(inventory.locks.length, 4);
    for (let index = 0; index < 4; index += 1) {
      const number = index + 3;
      const entry = fd(inventory, number);
      const named = lstatSync(lockPaths[index], { bigint: true });
      assert.ok(named.isFile() && !named.isSymbolicLink());
      assert.equal(realpathSync(lockPaths[index]), lockPaths[index]);
      assert.equal(named.mode, 0o100644n);
      assert.equal(named.uid, 1000n);
      assert.equal(named.gid, 1000n);
      assert.equal(entry.target, lockPaths[index]);
      assert.equal(entry.device, String(named.dev));
      assert.equal(entry.inode, String(named.ino));
      assert.deepEqual(inventory.locks[index], {
        fd: number,
        ownerPid: processSet.c.process.pid,
        mode: index === 1 ? 'READ' : 'WRITE',
        device: String(named.dev),
        inode: String(named.ino),
        start: '0',
        end: 'EOF',
      });
    }
    for (const [number, target] of [
      [7, processSet.c.process.pid],
      [10, processSet.o.process.pid],
    ]) {
      assert.equal(fd(inventory, number).target, 'anon_inode:[pidfd]');
      assert.equal(fd(inventory, number).pidfd?.pid, target);
      assert.ok(fd(inventory, number).pidfd.nspid.includes(target));
    }
  }
  for (const number of [3, 4, 5, 6, 7, 10]) {
    assert.equal(
      objectKey(fd(pair.owner, number)),
      objectKey(fd(pair.coordinator, number)),
    );
  }
  assert.equal(
    objectKey(fd(pair.owner, 13)),
    objectKey(fd(pair.coordinator, 8)),
  );
  assert.equal(
    objectKey(fd(pair.owner, 12)),
    objectKey(fd(pair.coordinator, 9)),
  );
  assert.equal(
    new Set([8, 9, 12, 13].map((number) => objectKey(fd(pair.owner, number))))
      .size,
    4,
  );
  const outerChannels = new Set(
    [8, 9].map((number) => objectKey(fd(pair.owner, number))),
  );
  for (const entry of pair.coordinator.fds) {
    assert.ok(
      !outerChannels.has(objectKey(entry)),
      'no outer-channel object inherited by I',
    );
  }
  for (const inventory of [pair.owner, pair.coordinator]) {
    const numbers =
      inventory === pair.owner
        ? [3, 4, 5, 6, 7, 8, 9, 10, 12, 13]
        : [3, 4, 5, 6, 7, 8, 9, 10];
    const objects = new Set(
      numbers.map((number) => objectKey(fd(inventory, number))),
    );
    for (const entry of inventory.fds) {
      if (objects.has(objectKey(entry)))
        assert.ok(numbers.includes(entry.fd), 'no extra protected alias');
    }
  }
  return { owner, precompile, pair };
}

export function frames(result) {
  const records = result.records.filter((value) => value.kind === 'frame');
  assert.deepEqual(
    records.map((value) => value.body.frame.kind),
    [
      'HELLO',
      'INIT',
      'LEASE_READY',
      'START',
      'ADOPTION_ACK',
      'CANCEL',
      'CANCEL_ACK',
      'TERMINAL',
    ],
  );
  assert.deepEqual(
    records.map((value) => value.body.direction),
    [
      'C_TO_O',
      'O_TO_C',
      'C_TO_O',
      'O_TO_C',
      'C_TO_O',
      'O_TO_C',
      'C_TO_O',
      'C_TO_O',
    ],
  );
  assert.deepEqual(records[5].body.frame.body, { reason: 'close' });
  assert.deepEqual(records[7].body.frame.body, {
    state: 'drained',
    failure: 'DEC203_SUPERVISOR_CANCELLED',
    exitCode: 0,
    signal: null,
  });
  return records;
}

export function builds(result, processSet) {
  const artifacts = result.records.filter((value) => value.kind === 'artifact');
  assert.ok(artifacts.length > 0);
  for (const record of artifacts) {
    const value = record.body.artifact;
    const observed = result.artifacts.observed(value.path);
    if (record.body.phase === 'owner' && record.body.role === 'output') {
      assert.ok([0o100600, 0o100700].includes(value.mode));
      assert.deepEqual({ ...value, mode: observed.mode }, observed);
    } else assert.deepEqual(value, observed);
  }
  for (const phase of ['owner', 'lease']) {
    const required = [
      ['node', node],
      ['compiler', gcc],
      [
        'source',
        join(
          native,
          phase === 'owner' ? 'receiving-lease-owner.c' : 'receiving-lease.c',
        ),
      ],
      ['support', join(native, 'receiving-bootstrap-profile.h')],
      [
        'output',
        join(
          result.artifacts.root,
          phase === 'owner'
            ? 'owner/receiving-lease-owner'
            : 'lease/receiving-lease.node',
        ),
      ],
    ];
    if (phase === 'lease')
      required.push(...headers.map((path) => ['header', path]));
    for (const [role, path] of required) {
      assert.ok(
        artifacts.some(
          (value) =>
            value.body.phase === phase &&
            value.body.role === role &&
            value.body.artifact.path === path,
        ),
        `actual ${phase}/${role} artifact required`,
      );
    }
  }
  assert.equal(
    result.artifacts.observed(processSet.c.process.executable.path).mode,
    0o100700,
  );
  assert.equal(
    result.artifacts.observed(
      join(result.artifacts.root, 'lease/receiving-lease.node'),
    ).mode,
    0o100600,
  );
  const terminal = one(result.records, 'compiler-terminal').body;
  assert.deepEqual(
    terminal.process,
    processSet.actual.get('owner-compiler').process,
  );
  assert.equal(terminal.exitCode, 0);
  assert.equal(terminal.signal, null);
  assert.equal(terminal.stdout, 'eof');
  assert.equal(terminal.stderr, 'eof');
  assert.equal(terminal.session, 'absent');
  // I's compiler wait/streams are not invented as an O compiler-terminal record.
}

export function terminal(result, processSet) {
  const value = one(result.records, 'local-terminal').body;
  assert.deepEqual(value, {
    state: 'closed',
    failureCode: 'DEC203_SUPERVISOR_CANCELLED',
    ownerWait: {
      pid: processSet.c.process.pid,
      startTime: processSet.c.process.startTime,
      exitCode: 0,
      signal: null,
    },
    input: 'eof',
    channels: {
      ownerInput: 'finished',
      ownerStdout: 'eof',
      ownerStderr: 'eof',
      commands: 'finished',
      events: 'eof',
    },
  });
  assert.deepEqual(result.actualClose, { code: 0, signal: null });
  assert.ok(
    result.provedClosed &&
      result.stdout.ended &&
      result.stderr.ended &&
      result.stdin.finished,
  );
}

export function inventories(result, raw) {
  const inherited = [3, 4, 5, 6, 7, 8, 9, 10];
  const root = result.artifacts.root;
  const ownedDirectories = [root, join(root, 'owner'), join(root, 'lease')];
  const protectedRows = [
    ...[...inherited, 12, 13].map((number) => fd(raw.pair.owner, number)),
    ...inherited.map((number) => fd(raw.pair.coordinator, number)),
  ];
  const directories = [raw.owner, raw.precompile, ...Object.values(raw.pair)]
    .flatMap((snapshot) => snapshot.fds)
    .filter(
      (entry) =>
        (entry.mode & 0o170000) === 0o040000 &&
        ownedDirectories.includes(entry.target),
    );
  const artifacts = Array.from(
    result.artifacts.records.values(),
    (record) => record.value,
  );
  const anchors = new Map();
  for (const [phase, snapshot] of [
    ['owner-leased', raw.owner],
    ['coordinator-precompile', raw.precompile],
    ['lease-compiler-live', raw.pair.compiler],
    ['coordinator-adopted', raw.precompile],
  ]) {
    const compiler = phase === 'lease-compiler-live';
    const numbers = compiler ? [0, 1, 2] : inherited;
    anchors.set(phase, {
      phase,
      process: snapshot.process,
      root: result.artifacts.root,
      requiredFds: numbers.map((number) => fd(snapshot, number)),
      locks: compiler ? [] : snapshot.locks,
      forbiddenObjects: protectedRows.map(objectKey),
      artifacts,
      directories,
      kernelMetadata: result.artifacts.metadata(),
    });
  }
  for (const record of result.records.filter(
    (value) => value.kind === 'inventory',
  )) {
    assertInventoryPayload(record.body, anchors.get(record.body.phase));
  }
}
