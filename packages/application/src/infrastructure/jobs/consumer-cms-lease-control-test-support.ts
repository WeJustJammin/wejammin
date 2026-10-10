import { QueueEnvelopeSchema } from '@wejammin/contracts';
import { expect, vi } from 'vitest';

import { executeJobDispatch } from './consumer.ts';
import type {
  CanonicalJob,
  JobConsumerInput,
  JobEffectInput,
  JobEffectResult,
  JobHeartbeatRequest,
  JobLeaseClaimResult,
  JobPersistencePort,
} from './runtime-types.ts';

export const ID = '11111111-1111-4111-8111-111111111111';
export const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FOREIGN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export type Checkpoint =
  | Readonly<{ kind: 'lost' }>
  | Readonly<{
      kind: 'current';
      claimedJob: Readonly<{
        jobId: string;
        version: string;
        leaseToken: string;
      }>;
      leaseUntilMs: number;
    }>;
export type Control = Readonly<{ checkpoint(): Promise<Checkpoint> }>;
export type Effect = (
  input: JobEffectInput,
  control?: Control,
) => Promise<JobEffectResult>;
export type Call = readonly unknown[];
const equal = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b) ||
    Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)
  )
    return false;
  const keys = Reflect.ownKeys(a);
  return (
    keys.length === Reflect.ownKeys(b).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equal(Reflect.get(a, key), Reflect.get(b, key)),
    )
  );
};
export const same = (actual: unknown, expected: unknown) =>
  expect(equal(actual, expected)).toBe(true);
export const metadata = (value: object) => ({
  prototype: Object.getPrototypeOf(value),
  descriptors: Object.getOwnPropertyDescriptors(value),
  frozen: Object.isFrozen(value),
  extensible: Object.isExtensible(value),
});
export const gate = () => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered,
    resolved: released,
    release: () => release(),
    hold: async () => {
      enter();
      await released;
    },
  };
};
export const reached = (entered: Promise<void>, delivery: Promise<unknown>) =>
  Promise.race([
    entered,
    delivery.then(() => {
      throw new Error('Delivery ended before checkpoint gate');
    }),
  ]);
export const need = (control: Control | undefined): Control => {
  if (control === undefined) throw new Error('Expected CMS lease control');
  return control;
};
export const retry = {
  kind: 'retry',
  reason: 'lease_conflict',
  acknowledge: false,
};
export const outcome = (
  state: JobEffectResult['state'] = 'succeeded',
): JobEffectResult =>
  Object.freeze({ state, resultRef: null, errorCode: null });
export const running = (version = '37', leaseUntilMs = 501_000): CanonicalJob =>
  Object.freeze({
    id: ID,
    type: 'cms.schema.dry_run',
    state: 'running',
    version,
    leaseUntilMs,
  });
export const current = (
  version = '37',
  leaseUntilMs = 501_000,
): Checkpoint => ({
  kind: 'current',
  claimedJob: { jobId: ID, version, leaseToken: TOKEN },
  leaseUntilMs,
});
export const heartbeat = (version = '19', expiry = 301_000, now = 201_000) => ({
  jobId: ID,
  leaseToken: TOKEN,
  expectedVersion: version,
  leaseUntilMs: expiry,
  leaseSeconds: 300,
  nowMs: now,
});
export const apply = (
  version = '37',
  state: JobEffectResult['state'] = 'succeeded',
) => ({
  currentState: 'running',
  currentVersion: `"${version}"`,
  expectedVersion: `"${version}"`,
  jobId: ID,
  leaseToken: TOKEN,
  nextState: state,
  retryable: state === 'queued',
  resultRef: null,
  errorCode: null,
  nextVersion: `"${BigInt(version) + 1n}"`,
});
export const record = {
  aggregateId: ID,
  eventId: '22222222-2222-4222-8222-222222222222',
  eventType: 'job.requested',
  schemaVersion: 1,
  pendingManualReview: false,
};
export const renewedCalls = (
  version = '19',
  expiry = 301_000,
  now = 201_000,
): Call[] => [
  ['restore'],
  ['heartbeat', heartbeat(version, expiry, now)],
  ['read', ID],
];
export const completed = (version = '37', state = 'succeeded') => ({
  kind: 'completed',
  outcome: {
    kind: 'applied',
    jobId: ID,
    nextState: state,
    nextVersion: `"${BigInt(version) + 1n}"`,
  },
  processed:
    state === 'queued'
      ? null
      : { kind: 'recorded', canonicalWrite: true, replayable: true },
});
type Options = {
  type?: string;
  verified?: boolean;
  clock?: boolean;
  hb?: boolean;
  receipt?: Partial<JobLeaseClaimResult>;
  now?: number;
};
export const fixture = (options: Options = {}) => {
  const calls: Call[] = [];
  const time = { value: options.now ?? 201_000 };
  const canonical: CanonicalJob = Object.freeze({
    id: ID,
    type: options.type ?? 'cms.schema.dry_run',
    state: 'queued',
    version: '7',
    leaseUntilMs: null,
  });
  const envelope = QueueEnvelopeSchema.parse({
    eventId: record.eventId,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateId: ID,
    aggregateType: 'job',
    aggregateVersion: '7',
    correlationId: '33333333-3333-4333-8333-333333333333',
    causationId: null,
  });
  const receipt: JobLeaseClaimResult = Object.freeze({
    jobId: ID,
    leaseToken: TOKEN,
    expectedVersion: '7',
    version: '19',
    leaseUntilMs: 301_000,
    ...options.receipt,
  });
  const originals = [canonical, envelope, receipt];
  const before = originals.map(metadata);
  const open = Object.freeze({
    expectedEpoch: '1',
    consumerEpoch: '1',
    integrityVerified: true,
    reconciliationComplete: true,
  });
  let reads = 0;
  const read = vi.fn<JobPersistencePort['readCanonicalJob']>(
    async (...args) => {
      calls.push(['read', ...args]);
      return reads++ === 0 ? canonical : running();
    },
  );
  const restore = vi.fn<JobPersistencePort['readRestoreFence']>(
    async (...args) => {
      calls.push(['restore', ...args]);
      return open;
    },
  );
  const claim = vi.fn<JobPersistencePort['claimJobLease']>(async (...args) => {
    calls.push(['claim', ...args]);
    return receipt;
  });
  const hb = vi.fn<JobPersistencePort['heartbeatJobLease']>(async (...args) => {
    calls.push(['heartbeat', ...args]);
    return true;
  });
  const write = vi.fn<JobPersistencePort['applyJobOutcome']>(
    async (...args) => {
      calls.push(['apply', ...args]);
      return true;
    },
  );
  const processed = vi.fn<JobPersistencePort['recordProcessedEvent']>(
    async (...args) => {
      calls.push(['processed', ...args]);
      return 'recorded';
    },
  );
  const clock = vi.fn(() => time.value);
  const execute = vi.fn<Effect>(async () => outcome());
  const persistence = {
    readCanonicalJob: read,
    readRestoreFence: restore,
    claimJobLease: claim,
    applyJobOutcome: write,
    recordProcessedEvent: processed,
    ...(options.hb === false ? {} : { heartbeatJobLease: hb }),
  };
  const input = Object.freeze({
    persistence,
    effect: { execute },
    envelope,
    leaseToken: TOKEN,
    leaseSeconds: 300,
    nowMs: 1_000,
    processedEventIds: [],
    eventJobType: canonical.type,
    verifiedImmutableJobOrigin: options.verified ?? true,
    ...(options.clock === false ? {} : { leaseNow: clock }),
  } satisfies JobConsumerInput & {
    verifiedImmutableJobOrigin: boolean;
    leaseNow?: () => number;
  });
  const prefix: Call[] = [
    ['read', ID],
    ['restore'],
    ['restore'],
    [
      'claim',
      {
        jobId: ID,
        leaseToken: TOKEN,
        expectedVersion: '7',
        leaseSeconds: 300,
        nowMs: 1_000,
      },
    ],
  ];
  const effectArgs = {
    envelope,
    job: canonical,
    claimedLease: receipt,
    leaseToken: TOKEN,
  };
  const assertEffect = (controlled = true) => {
    const args = execute.mock.calls[0];
    if (args === undefined) throw new Error('Expected effect invocation');
    same(execute.mock.calls, [
      controlled ? [effectArgs, args[1]] : [effectArgs],
    ]);
    expect(args[0].job === canonical && args[0].claimedLease === receipt).toBe(
      true,
    );
    if (controlled) expect(args[1] !== undefined).toBe(true);
    same(originals.map(metadata), before);
  };
  return {
    input,
    calls,
    prefix,
    time,
    canonical,
    envelope,
    receipt,
    read,
    restore,
    claim,
    hb,
    write,
    processed,
    clock,
    execute,
    open,
    originals,
    before,
    assertEffect,
    run: () => executeJobDispatch(input),
  };
};
export type Fixture = ReturnType<typeof fixture>;
export const observe = (
  f: Fixture,
  reply: () => Promise<CanonicalJob | null>,
) => {
  f.read.mockImplementation(async (...args) => {
    f.calls.push(['read', ...args]);
    return f.read.mock.calls.length === 1 ? f.canonical : reply();
  });
};
export const beat = (f: Fixture, reply: () => Promise<unknown>) => {
  Object.defineProperty(f.input.persistence, 'heartbeatJobLease', {
    value: async (...args: [JobHeartbeatRequest]) => {
      f.calls.push(['heartbeat', ...args]);
      return reply();
    },
  });
};

export const healthyPolicy = async (mode: string) => {
  const f = fixture();
  let retained: Control | undefined;
  const prepareSchemaDryRun = vi.fn<Effect>(async (_input, control) => {
    retained = need(control);
    if (mode === 'throw') throw new Error('Controlled effect failure');
    return outcome('pending_manual_review');
  });
  f.execute.mockImplementation(prepareSchemaDryRun);
  same(await f.run(), {
    kind: 'manual_review',
    canonicalWrite: false,
    replayable: false,
  });
  same(f.calls, f.prefix);
  same(await need(retained).checkpoint(), { kind: 'lost' });
  same(f.calls, f.prefix);
  f.assertEffect();
};
