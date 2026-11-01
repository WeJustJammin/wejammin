import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clonePayload,
  crossedBindings,
  different,
  inventoryFixture,
  inventoryPhases,
  namedMutations,
  statLiteral,
} from './dec203-bootstrap-pre-ready-inventory-fixtures.mjs';
import {
  assertInventoryPayload,
  liveStatFields,
} from './dec203-bootstrap-pre-ready-values.mjs';

const fd = (value, number) => {
  const found = value.fds.find((entry) => entry.fd === number);
  assert.ok(found, `actual FD${number} premise missing`);
  return found;
};

const leasePhases = inventoryPhases.filter(
  (phase) => phase !== 'lease-compiler-live',
);

function rejectInventories(phase, mutations) {
  const { payload, anchor } = inventoryFixture(phase);
  assertInventoryPayload(payload, anchor);
  assert.ok(mutations.length > 0, 'each negative group has actual variants');
  for (const mutate of mutations) {
    const candidate = clonePayload(payload);
    mutate(candidate); // Fixture mistakes occur outside the expected-error boundary.
    assert.throws(() => assertInventoryPayload(candidate, anchor), {
      name: 'AssertionError',
      code: 'ERR_ASSERTION',
    });
  }
}

test('INV01: independently anchored literal baselines accept all four phases', () => {
  for (const phase of inventoryPhases) {
    const { payload, anchor } = inventoryFixture(phase);
    assertInventoryPayload(payload, anchor);
  }
});

test('INV02: lawful auxiliary FD churn does not demand whole-table equality', () => {
  for (const phase of inventoryPhases) {
    const { payload, anchor } = inventoryFixture(phase);
    assertInventoryPayload(payload, anchor);
    const moved = clonePayload(payload);
    Object.assign(fd(moved, 20), { fd: 27, flags: '02000000', pos: '23' });
    moved.fds.sort((left, right) => left.fd - right.fd);
    assertInventoryPayload(moved, anchor);
    const removed = clonePayload(payload);
    removed.fds = removed.fds.filter((value) => value.fd !== 20);
    assertInventoryPayload(removed, anchor);
    const directory = clonePayload(payload);
    Object.assign(fd(directory, 21), { fd: 28, flags: '02000000', pos: '23' });
    directory.fds.sort((left, right) => left.fd - right.fd);
    assertInventoryPayload(directory, anchor);
  }
});

test('INV03: empty emitted FD tables refuse in every phase', () => {
  for (const phase of inventoryPhases)
    rejectInventories(phase, [
      (value) => {
        value.fds = [];
      },
    ]);
});

test('INV04: each independently required FD is mandatory', () => {
  for (const phase of inventoryPhases) {
    const { anchor } = inventoryFixture(phase);
    rejectInventories(
      phase,
      anchor.requiredFds.map(({ fd: number }) => (value) => {
        value.fds = value.fds.filter((entry) => entry.fd !== number);
      }),
    );
  }
});

test('INV05: empty or individually omitted FLOCK payloads refuse', () => {
  for (const phase of leasePhases) {
    const { anchor } = inventoryFixture(phase);
    rejectInventories(phase, [
      (value) => {
        value.locks = [];
      },
      ...anchor.locks.map(({ fd: number }) => (value) => {
        value.locks = value.locks.filter((entry) => entry.fd !== number);
      }),
    ]);
  }
});

test('INV06: forged protected object identity or ownership refuses', () => {
  for (const phase of inventoryPhases) {
    const { anchor } = inventoryFixture(phase);
    rejectInventories(
      phase,
      anchor.requiredFds.flatMap(({ fd: number }) =>
        ['device', 'inode', 'mode', 'uid', 'gid'].map((key) => (value) => {
          const entry = fd(value, number);
          entry[key] = different(entry[key]);
        }),
      ),
    );
    rejectInventories(
      phase,
      anchor.requiredFds.flatMap(({ fd: number }) =>
        ['cloexec', 'access'].map((change) => (value) => {
          const entry = fd(value, number);
          const before = BigInt(`0o${entry.flags}`);
          const access = before & 3n;
          assert.ok(access <= 2n, 'valid original access mode');
          const after =
            change === 'cloexec'
              ? before ^ 0o2000000n
              : (before & ~3n) | (access === 0n ? 1n : 0n);
          assert.notEqual(after, before, 'actual protected flag change');
          assert.ok((after & 3n) <= 2n, 'valid changed access mode');
          entry.flags = after === 0n ? '0' : `0${after.toString(8)}`;
        }),
      ),
    );
  }
});

test('INV07: forged FLOCK mode, owner or object identity refuses', () => {
  for (const phase of leasePhases) {
    const { anchor } = inventoryFixture(phase);
    rejectInventories(
      phase,
      anchor.locks.flatMap(({ fd: number }) =>
        ['mode', 'ownerPid', 'device', 'inode'].map((key) => (value) => {
          const entry = value.locks.find((lock) => lock.fd === number);
          assert.ok(entry, 'literal lock mutation premise');
          entry[key] =
            key === 'mode'
              ? entry.mode === 'READ'
                ? 'WRITE'
                : 'READ'
              : different(entry[key]);
        }),
      ),
    );
  }
});

test('INV08: an extra alias at any other FD cannot hide a protected object', () => {
  for (const phase of leasePhases) {
    const { anchor } = inventoryFixture(phase);
    rejectInventories(
      phase,
      anchor.requiredFds.map(({ fd: number }) => (value) => {
        const alias = clonePayload(fd(value, number));
        alias.fd = 31;
        value.fds.push(alias);
      }),
    );
  }
});

test('INV09: crossed original lifetime and channel bindings refuse', () => {
  for (const phase of leasePhases) rejectInventories(phase, crossedBindings());
});

test('INV10: GCC cannot carry protected objects, pidfds or FLOCK rows', () => {
  const { payload } = inventoryFixture('coordinator-precompile');
  const { anchor } = inventoryFixture('lease-compiler-live');
  assert.ok(!anchor.forbiddenObjects.includes('1:931'));
  rejectInventories('lease-compiler-live', [
    ...[3, 7, 8].map((number) => (value) => {
      const alias = clonePayload(fd(payload, number));
      alias.fd = 31;
      value.fds.push(alias);
    }),
    (value) => {
      fd(value, 1).pidfd = { pid: 501, nspid: [501] };
    },
    (value) => {
      value.locks = clonePayload(payload.locks);
    },
    ...['anon_inode:[pidfd]', 'anon_inode:pidfd'].map((target) => (value) => {
      assert.ok(!value.fds.some((entry) => entry.fd === 31));
      value.fds.push({
        fd: 31,
        target,
        device: '1',
        inode: '931',
        mode: 0o700,
        uid: 1000,
        gid: 1000,
        flags: '02000002',
        pos: '0',
        pidfd: null,
      });
    }),
  ]);
});

test('INV11: unknown or forged named-file payloads refuse', () => {
  for (const phase of inventoryPhases)
    rejectInventories(phase, namedMutations());
  for (const phase of inventoryPhases) {
    const { payload, anchor } = inventoryFixture(phase);
    assert.equal(anchor.directories.length, 3);
    assert.ok(!anchor.forbiddenObjects.includes('1:924'));
    const rawExtra = Object.freeze({
      fd: 24,
      target: '/unit/run/extra',
      device: '1',
      inode: '924',
      mode: 0o040700,
      uid: 1000,
      gid: 1000,
      flags: '02000000',
      pos: '0',
      pidfd: null,
    });
    const extended = Object.freeze({
      ...anchor,
      directories: Object.freeze([...anchor.directories, rawExtra]),
    });
    assertInventoryPayload(payload, extended); // Unused observation grants no ownership.
    const candidate = clonePayload(payload);
    assert.ok(!candidate.fds.some((entry) => entry.fd === 31));
    candidate.fds.push({
      fd: 31,
      target: '/unit/run/extra',
      device: '1',
      inode: '924',
      mode: 0o040700,
      uid: 1000,
      gid: 1000,
      flags: '02000000',
      pos: '0',
      pidfd: null,
    });
    assert.notEqual(rawExtra, candidate.fds.at(-1));
    assert.deepEqual({ ...rawExtra, fd: 31 }, candidate.fds.at(-1));
    assert.throws(() => assertInventoryPayload(candidate, extended), {
      name: 'AssertionError',
      code: 'ERR_ASSERTION',
    });
  }
});

test('INV12: phase and original process bindings cannot be substituted', () => {
  for (const phase of inventoryPhases)
    rejectInventories(phase, [
      (value) => {
        value.phase = 'unknown';
      },
      (value) => {
        value.phase =
          phase === 'owner-leased' ? 'coordinator-adopted' : 'owner-leased';
      },
      ...['pid', 'ppid', 'startTime', 'session', 'uid'].map(
        (key) => (value) => {
          value.process[key] = different(value.process[key]);
        },
      ),
      (value) => {
        value.process.executable.inode += '9';
      },
    ]);
});

test('STAT01: terminal stat races keep malformed data fatal', () => {
  const fields = liveStatFields(statLiteral, 503);
  assert.deepEqual(
    [fields[0], fields[1], fields[2], fields[3], fields[19]],
    ['S', '502', '503', '503', '5030'],
  );
  for (const state of ['Z', 'X']) {
    const dead = statLiteral.replace(') S ', `) ${state} `);
    assert.throws(() => liveStatFields(dead, 503), {
      code: 'DEC203_TEST_INCOMPLETE_SNAPSHOT',
    });
  }
  for (const raw of [
    statLiteral.replace('5030 0 0\n', ''),
    statLiteral.replace('503 (', '504 ('),
    statLiteral.replace('5030', 'bad'),
    statLiteral.replace('5030', '0'),
    statLiteral.replace(') S ', ') Z ').replace('5030', 'bad'),
    statLiteral.replace(') S ', ') X ').replace('5030 0 0\n', ''),
  ]) {
    assert.throws(() => liveStatFields(raw, 503), {
      name: 'AssertionError',
      code: 'ERR_ASSERTION',
    });
  }
});
