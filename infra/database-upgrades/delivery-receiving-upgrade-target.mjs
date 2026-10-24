import { Buffer } from 'node:buffer';

export function requireFact(condition, message) {
  if (!condition) throw new Error(`DEC197: ${message}`);
}

export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

export function sealTarget(value) {
  const expected = {
    kind: 'wejammin-alt-reset-v1',
    projectId: 'wejammin_ev',
    workdir: '/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb',
    container: 'supabase_db_wejammin_ev',
    database: 'postgres',
    dbPort: 55322,
    apiPort: 55321,
  };
  const locks = [
    { path: '/tmp/wejammin-supabase-ci.lock', mode: 'exclusive' },
    { path: '/tmp/wejammin-quiet.lock', mode: 'shared' },
    { path: '/tmp/wejammin-altdb.lock', mode: 'exclusive' },
    { path: '/tmp/wejammin-reset.lock', mode: 'exclusive' },
  ];
  requireFact(
    exactKeys(value, [...Object.keys(expected), 'locks']),
    'target shape',
  );
  for (const [key, fact] of Object.entries(expected)) {
    requireFact(value[key] === fact, `foreign target ${key}`);
  }
  requireFact(
    Array.isArray(value.locks) && value.locks.length === locks.length,
    'four ordered locks required',
  );
  locks.forEach((lock, index) => {
    const actual = value.locks[index];
    requireFact(
      exactKeys(actual, ['path', 'mode']) &&
        actual.path === lock.path &&
        actual.mode === lock.mode,
      'foreign lock',
    );
  });
  return Object.freeze({
    ...expected,
    locks: Object.freeze(locks.map((lock) => Object.freeze(lock))),
  });
}

export const hashText = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const positivePid = (value) => Number.isSafeInteger(value) && value > 0;

export function identifier(value) {
  return (
    typeof value === 'string' &&
    Buffer.byteLength(value, 'utf8') <= 63 &&
    /^[\p{L}\p{N}_.-]+$/u.test(value)
  );
}

function decimal(value, maximum) {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]*$/.test(value) &&
    value.length <= 20 &&
    BigInt(value) <= maximum
  );
}

export function assertIdentity(value, target, first) {
  requireFact(isRecord(value), 'missing identity');
  sealTarget(value.target);
  sealTarget(target);
  requireFact(hashText(value.containerId), 'missing observed container ID');
  requireFact(
    decimal(value.clusterId, 18446744073709551615n),
    'invalid cluster ID',
  );
  requireFact(decimal(value.databaseOid, 4294967295n), 'invalid database OID');
  if (first) {
    for (const key of ['containerId', 'clusterId', 'databaseOid']) {
      requireFact(value[key] === first[key], `changed ${key}`);
    }
  }
}

export function assertAttestation(value, plan) {
  assertIdentity(value, plan.target);
  requireFact(value.owner === 'postgres', 'database owner mismatch');
  requireFact(
    value.prefixSha256 === plan.prefixSha256 && hashText(value.baselineSha256),
    'unverified prefix/baseline digest',
  );
  const lease = value.lease;
  requireFact(
    isRecord(lease) &&
      positivePid(lease.ownerPid) &&
      Array.isArray(lease.locks) &&
      lease.locks.length === 4,
    'missing lock lease',
  );
  const descriptors = new Set();
  const files = new Set();
  lease.locks.forEach((lock, index) => {
    const expected = plan.target.locks[index];
    requireFact(
      isRecord(lock) &&
        lock.ownerPid === lease.ownerPid &&
        lock.path === expected.path &&
        lock.mode === expected.mode &&
        Number.isSafeInteger(lock.fd) &&
        lock.fd >= 0 &&
        Number.isSafeInteger(lock.dev) &&
        lock.dev >= 0 &&
        positivePid(lock.inode),
      'unverified lock record',
    );
    requireFact(
      !descriptors.has(lock.fd) && !files.has(`${lock.dev}:${lock.inode}`),
      'duplicate lock ownership',
    );
    descriptors.add(lock.fd);
    files.add(`${lock.dev}:${lock.inode}`);
  });
}

export function assertReset(value, plan, first) {
  assertIdentity(value, plan.target, first);
  requireFact(
    value.owner === 'postgres' && value.prefixSha256 === plan.prefixSha256,
    'reset did not verify predecessor prefix',
  );
  requireFact(
    typeof value.resetEpoch === 'string' &&
      /^[A-Za-z0-9_.-]{1,128}$/.test(value.resetEpoch),
    'invalid reset epoch',
  );
}

export function assertEnvelope(value, plan, first, reset) {
  assertIdentity(value, plan.target, first);
  requireFact(value.resetEpoch === reset.resetEpoch, 'stale case epoch');
}

export function assertRestoration(value, plan, first, reset) {
  assertIdentity(value, plan.target, first);
  requireFact(
    value.owner === 'postgres' && value.baselineSha256 === first.baselineSha256,
    'ordinary baseline not restored',
  );
  requireFact(
    typeof value.resetEpoch === 'string' &&
      /^[A-Za-z0-9_.-]{1,128}$/.test(value.resetEpoch) &&
      value.resetEpoch !== reset?.resetEpoch,
    'restoration epoch not fresh',
  );
}

/** Diagnostic links only; reset ownership is proved by the native port. */
export function assertResetTransition(
  value,
  { plan, initial, previous, purpose, sequence, inventorySha256 } = {},
) {
  requireFact(
    isRecord(value) && isRecord(plan) && isRecord(previous),
    'missing reset transition context',
  );
  assertAttestation(initial, plan);
  requireFact(
    (purpose === 'prefix' && sequence === 1) ||
      (purpose === 'baseline' && sequence === 2),
    'invalid reset purpose/sequence',
  );
  const expectedInventory =
    purpose === 'prefix' ? plan.prefixSha256 : initial.baselineSha256;
  requireFact(
    hashText(inventorySha256) && inventorySha256 === expectedInventory,
    'reset inventory context mismatch',
  );
  const transition = value.transition;
  requireFact(
    exactKeys(transition, [
      'kind',
      'purpose',
      'sequence',
      'from',
      'to',
      'fromEpoch',
      'toEpoch',
      'inventorySha256',
      'sourceSha256',
      'witnessSha256',
    ]),
    'reset transition shape',
  );
  const identityKeys = [
    'target',
    'containerId',
    'clusterId',
    'databaseOid',
    'owner',
  ];
  requireFact(
    exactKeys(transition.from, identityKeys) &&
      exactKeys(transition.to, identityKeys),
    'reset transition identity shape',
  );
  assertIdentity(previous, plan.target);
  if (purpose === 'prefix') assertIdentity(previous, plan.target, initial);
  assertIdentity(transition.from, plan.target, previous);
  assertIdentity(transition.to, plan.target);
  assertIdentity(value, plan.target, transition.to);
  requireFact(
    [previous, transition.from, transition.to, value].every(
      (identity) =>
        identity.owner === initial.owner &&
        identity.databaseOid === initial.databaseOid,
    ),
    'reset changed owner or database OID',
  );
  const priorEpoch =
    purpose === 'prefix' ? null : (previous.resetEpoch ?? null);
  const epoch = (candidate) =>
    typeof candidate === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(candidate);
  requireFact(
    (priorEpoch === null || epoch(priorEpoch)) &&
      transition.fromEpoch === priorEpoch &&
      epoch(transition.toEpoch) &&
      transition.toEpoch !== priorEpoch &&
      value.resetEpoch === transition.toEpoch,
    'reset transition epoch mismatch',
  );
  requireFact(
    transition.kind === 'DEC197_OWNED_RESET_V1' &&
      transition.purpose === purpose &&
      transition.sequence === sequence &&
      transition.inventorySha256 === inventorySha256 &&
      hashText(plan.sourceSha256) &&
      transition.sourceSha256 === plan.sourceSha256 &&
      hashText(plan.witnessSha256) &&
      transition.witnessSha256 === plan.witnessSha256,
    'reset transition provenance mismatch',
  );
  requireFact(
    value[purpose === 'prefix' ? 'prefixSha256' : 'baselineSha256'] ===
      inventorySha256,
    'reset output inventory mismatch',
  );
  return value;
}
