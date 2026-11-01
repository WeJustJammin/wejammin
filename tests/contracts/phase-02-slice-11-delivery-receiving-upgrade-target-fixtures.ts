import { Buffer } from 'node:buffer';

// Unit DTOs only: the real adapter must independently prove raw target/lease facts.
export type Lock = { path: string; mode: 'shared' | 'exclusive' };
export type AltTarget = {
  kind: string;
  projectId: string;
  workdir: string;
  container: string;
  database: string;
  dbPort: number;
  apiPort: number;
  locks: Lock[];
};
export type LeaseRecord = Lock & {
  ownerPid: number;
  fd: number;
  dev: number;
  inode: number;
};
export type Identity = {
  target: AltTarget;
  containerId: string;
  clusterId: string;
  databaseOid: string;
  owner: string;
};
export type Attestation = Identity & {
  prefixSha256: string;
  baselineSha256: string;
  lease: { ownerPid: number; locks: LeaseRecord[] };
};
export type Reset = Identity & { resetEpoch: string; prefixSha256: string };
export type Restoration = Identity & {
  resetEpoch: string;
  baselineSha256: string;
};
export type Envelope = Omit<Identity, 'owner'> & { resetEpoch: string };
export type Session = {
  witness: string;
  database: string;
  databaseOid: string;
  backendPid: number;
  applicationName: string;
};

export function altTarget(): AltTarget {
  return {
    kind: 'wejammin-alt-reset-v1',
    projectId: 'wejammin_ev',
    workdir: '/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb',
    container: 'supabase_db_wejammin_ev',
    database: 'postgres',
    dbPort: 55322,
    apiPort: 55321,
    locks: [
      { path: '/tmp/wejammin-supabase-ci.lock', mode: 'exclusive' },
      { path: '/tmp/wejammin-quiet.lock', mode: 'shared' },
      { path: '/tmp/wejammin-altdb.lock', mode: 'exclusive' },
      { path: '/tmp/wejammin-reset.lock', mode: 'exclusive' },
    ],
  };
}

export const SESSION_SQL =
  "select pg_catalog.jsonb_build_object('witness','DEC197_MIGRATION_SESSION_V1','database',pg_catalog.current_database(),'databaseOid',(select oid::text from pg_catalog.pg_database where datname=pg_catalog.current_database()),'backendPid',pg_catalog.pg_backend_pid(),'applicationName',pg_catalog.current_setting('application_name'))::text;";

export function session(applicationName: string, backendPid = 301): Session {
  return {
    witness: 'DEC197_MIGRATION_SESSION_V1',
    database: 'postgres',
    databaseOid: '5',
    backendPid,
    applicationName,
  };
}
export const marker = (value: Session): string => `${JSON.stringify(value)}\n`;

export function identity(target: AltTarget = altTarget()): Identity {
  return {
    target,
    containerId: 'a'.repeat(64),
    clusterId: '7425798034715029691',
    databaseOid: '5',
    owner: 'postgres',
  };
}
export function attestation(
  target: AltTarget,
  prefixSha256: string,
): Attestation {
  return {
    ...identity(target),
    prefixSha256,
    baselineSha256: 'e'.repeat(64),
    lease: {
      ownerPid: 4001,
      locks: target.locks.map((lock, index) => ({
        ...lock,
        ownerPid: 4001,
        fd: 20 + index,
        dev: 2049,
        inode: 200 + index,
      })),
    },
  };
}
export function reset(
  target: AltTarget,
  prefixSha256: string,
  mode: string,
): Reset {
  return {
    ...identity(target),
    resetEpoch: `unit-prefix-${mode}`,
    prefixSha256,
  };
}
export function envelope(value: Reset): Envelope {
  const { target, containerId, clusterId, databaseOid, resetEpoch } = value;
  return { target, containerId, clusterId, databaseOid, resetEpoch };
}
export function expectedInvocation(plan: {
  target: AltTarget;
  applicationName: string;
  mode: string;
  witness: Buffer;
}) {
  return {
    command: 'docker',
    args: [
      'exec',
      '-i',
      '-e',
      `PGAPPNAME=${plan.applicationName}`,
      plan.target.container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      plan.target.database,
      '-v',
      `ON_ERROR_STOP=${plan.mode === 'negative' ? 0 : 1}`,
      '-v',
      'VERBOSITY=verbose',
      '-A',
      '-t',
      '-c',
      SESSION_SQL,
      '-f',
      '-',
    ],
    input: Buffer.from(plan.witness),
  };
}

function closedIdentity(value: Identity): Identity {
  return {
    target: structuredClone(value.target),
    containerId: value.containerId,
    clusterId: value.clusterId,
    databaseOid: value.databaseOid,
    owner: value.owner,
  };
}

// Independent injected DTOs, not a transition validator or native reset proof.
// Capture once before mutants; never repair changed outputs at an I/O boundary.
export function runnerResetFixtures(
  plan: {
    target: AltTarget;
    mode: string;
    prefixSha256: string;
    sourceSha256: string;
    witnessSha256: string;
  },
  observedContainerId: string,
) {
  const first = {
    ...attestation(plan.target, plan.prefixSha256),
    containerId: observedContainerId,
  };
  const caseReset = {
    ...reset(plan.target, plan.prefixSha256, plan.mode),
    containerId: observedContainerId,
  };
  const restored = {
    ...identity(plan.target),
    containerId: observedContainerId,
    resetEpoch: `unit-restored-${plan.mode}`,
    baselineSha256: first.baselineSha256,
  };
  const transition = (
    purpose: 'prefix' | 'baseline',
    previous: Identity,
    next: Reset | Restoration,
    fromEpoch: string | null,
    inventorySha256: string,
  ) => ({
    kind: 'DEC197_OWNED_RESET_V1',
    purpose,
    sequence: purpose === 'prefix' ? 1 : 2,
    from: closedIdentity(previous),
    to: closedIdentity(next),
    fromEpoch,
    toEpoch: next.resetEpoch,
    inventorySha256,
    sourceSha256: plan.sourceSha256,
    witnessSha256: plan.witnessSha256,
  });
  return {
    prefix: first,
    reset: {
      ...caseReset,
      transition: transition(
        'prefix',
        first,
        caseReset,
        null,
        plan.prefixSha256,
      ),
    },
    restored: {
      ...restored,
      transition: transition(
        'baseline',
        caseReset,
        restored,
        caseReset.resetEpoch,
        first.baselineSha256,
      ),
    },
    recovery: {
      transition: transition(
        'baseline',
        first,
        restored,
        null,
        first.baselineSha256,
      ),
      recoveryAttempt: {
        purpose: 'prefix',
        sequence: 1,
        from: closedIdentity(first),
        to: closedIdentity(first),
        acceptedEpoch: null,
      },
    },
  };
}
