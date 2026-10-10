/** Controlled receiving causality only; no live SQL or stage-authority proof. */
import type { CanonicalJob, JobEffectPort } from '@wejammin/application';
import type { QueueEnvelope } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
} from './async-entrypoint';
import type {
  PlatformJobsMessage,
  PlatformJobsQueue,
} from './async-entrypoint';
import { createAsyncJobDependencies, createSupabaseRpc } from './async-runtime';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import { createCmsSchemaDryRunOriginVerifier } from './content-schema-registry/schema-dry-run-origin-verifier';
import { createProductionAsyncEntrypoint } from './production-async-entrypoint';

const JOB = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORIGIN = 'cms_get_schema_migration_plan';
const envelope = Object.freeze({
  eventId: EVENT,
  eventType: 'job.requested',
  schemaVersion: 1,
  aggregateType: 'job',
  aggregateId: JOB,
  aggregateVersion: '7',
  correlationId: OTHER,
  causationId: null,
} satisfies QueueEnvelope);
const job = (
  version = '13',
  type = 'cms.schema.dry_run',
  state: CanonicalJob['state'] = 'queued',
  id = JOB,
): CanonicalJob =>
  Object.freeze({ id, type, state, version, leaseUntilMs: null });
const receipt = (expectedVersion = '13', version = '19', leaseToken = TOKEN) =>
  Object.freeze({
    jobId: JOB,
    expectedVersion,
    version,
    leaseToken,
    leaseUntilMs: 301_000,
  });
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
const same = (a: unknown, b: unknown) => expect(equal(a, b)).toBe(true);
const R = (operation: string, body: unknown = {}) => ['rpc', operation, body];
const read = () => R('read_canonical_job', { p_job_id: JOB });
const origin = (event: QueueEnvelope = envelope) =>
  R(ORIGIN, { p_request: { originEvent: event } });
const restore = () => R('read_restore_fence');
const gate = () => {
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
    release,
    hold: async () => {
      enter();
      await released;
    },
  };
};
type Mode =
  | 'true'
  | 'false'
  | 'missing'
  | 'throw'
  | 'http'
  | 'json'
  | 'length'
  | 'nonboolean';
type OriginInput = Readonly<{
  env: AsyncWorkerBindings;
  envelope: QueueEnvelope;
  signal: AbortSignal;
}>;
type Options = Readonly<{
  mode?: Mode;
  jobs?: readonly CanonicalJob[];
  production?: boolean;
  fenced?: boolean;
  hold?: boolean;
  body?: unknown;
  twice?: boolean;
}>;
const fixture = (options: Options = {}) => {
  const mode = options.mode ?? 'true';
  const jobs = options.jobs ?? [job('11'), job()];
  const leases = options.twice
    ? [receipt(), receipt('35', '41', TOKEN2)]
    : [receipt()];
  const history: unknown[][] = [];
  const rpcCalls: Parameters<AsyncRpcClient>[] = [];
  const barrier = gate();
  let reads = 0,
    claims = 0,
    effects = 0,
    delivery = 0;
  const fakeFetch: typeof fetch = async (resource, init) => {
    const url = new URL(
      resource instanceof Request ? resource.url : String(resource),
    );
    const headers = new Headers(init?.headers);
    same(
      [
        url.origin,
        init?.method,
        headers.get('accept-profile'),
        headers.get('content-profile'),
      ],
      ['https://controlled.invalid', 'POST', 'platform_api', 'platform_api'],
    );
    if (typeof init?.body !== 'string')
      throw new Error('Expected protected JSON body');
    const body: unknown = JSON.parse(init.body);
    const operation = url.pathname.replace('/rest/v1/rpc/', '');
    expect(url.pathname === `/rest/v1/rpc/${operation}`).toBe(true);
    history.push(R(operation, body));
    let value: unknown;
    if (operation === ORIGIN) {
      if (mode === 'http') return new Response('{}', { status: 503 });
      if (mode === 'json') return new Response('{');
      if (mode === 'length')
        return new Response('true', { headers: { 'content-length': 'bad' } });
      value = mode === 'nonboolean' ? { accepted: true } : mode !== 'false';
    } else if (operation === 'read_canonical_job') {
      value = jobs[reads++];
      if (value === undefined) throw new Error('Unexpected canonical read');
    } else if (operation === 'read_restore_fence') {
      value = {
        expected_epoch: '3',
        consumer_epoch: '3',
        integrity_verified: true,
        reconciliation_complete: !options.fenced,
      };
    } else if (operation === 'claim_job') {
      value = leases[claims++];
      if (value === undefined) throw new Error('Unexpected lease claim');
    } else if (operation === 'apply_job_outcome') {
      history.push(['applied', true]);
      value = true;
    } else if (operation === 'record_processed_event') {
      if (options.hold) await barrier.hold();
      history.push(['processed', 'recorded']);
      value = 'recorded';
    } else throw new Error('Unexpected receiving RPC');
    return new Response(JSON.stringify(value), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const transport = createSupabaseRpc(fakeFetch);
  const rpc: AsyncRpcClient = <T>(
    ...args: Parameters<AsyncRpcClient>
  ): Promise<T> => {
    rpcCalls.push(args);
    return transport<T>(...args);
  };
  const verifyCmsSchemaDryRunOrigin = vi.fn<
    (input: OriginInput) => Promise<boolean>
  >(async (input) => {
    if (mode === 'throw')
      throw new Error('Controlled unavailable origin reader');
    return createCmsSchemaDryRunOriginVerifier({
      port: {
        call: async (operation, request, signal) => {
          expect(signal === input.signal).toBe(true);
          expect(Object.isFrozen(request)).toBe(true);
          same(request, { originEvent: input.envelope });
          const response = await rpc<unknown>(
            input.env,
            operation,
            { p_request: request },
            signal,
          );
          if (typeof response !== 'boolean')
            throw new Error('Invalid origin Boolean');
          return response;
        },
      },
    }).verify(input.envelope, input.signal);
  });
  const effect = vi.fn<JobEffectPort['execute']>(async (input) => {
    history.push(['effect', input]);
    return {
      state: options.twice && effects++ === 0 ? 'queued' : 'succeeded',
      resultRef: null,
      errorCode: null,
    };
  });
  const send = vi.fn<PlatformJobsQueue['send']>(async () => ({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  }));
  const env = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'controlled-origin',
    SUPABASE_URL: 'https://controlled.invalid',
    SUPABASE_SECRET_KEY: 'controlled-not-a-real-secret',
    PLATFORM_JOBS: { send },
  } satisfies AsyncWorkerBindings;
  const dependencies = {
    rpc,
    effect,
    leaseToken: () => (delivery === 1 ? TOKEN : TOKEN2),
    leaseSeconds: 300,
    now: () => 1_000,
    ...(mode === 'missing' ? {} : { verifyCmsSchemaDryRunOrigin }),
  };
  const entrypoint = options.production
    ? createProductionAsyncEntrypoint(fakeFetch)
    : createAsyncEntrypoint(createAsyncJobDependencies(dependencies));
  const ack = vi.fn<PlatformJobsMessage['ack']>((...args) => {
    history.push(['ack', ...args]);
  });
  const retry = vi.fn<PlatformJobsMessage['retry']>((...args) => {
    history.push(['retry', ...args]);
  });
  const context = { waitUntil: vi.fn() };
  const body = options.body ?? envelope;
  const snapshots = JSON.stringify([body, jobs, leases]);
  const run = () => {
    delivery++;
    const message = Object.freeze({
      body,
      id: 'origin-delivery',
      attempts: delivery,
      ack,
      retry,
    });
    return entrypoint.queue(
      { queue: 'platform-jobs-staging', messages: [message] },
      env,
      context,
    );
  };
  const check = (expected: unknown[][], readerCount: number) => {
    same(history, expected);
    same(
      effect.mock.calls,
      expected.filter((x) => x[0] === 'effect').map((x) => [x[1]]),
    );
    for (const [input] of effect.mock.calls)
      expect(Object.isFrozen(input.envelope)).toBe(true);
    same(
      ack.mock.calls,
      expected.filter((x) => x[0] === 'ack').map(() => []),
    );
    same(
      retry.mock.calls,
      expected.filter((x) => x[0] === 'retry').map(() => []),
    );
    expect(verifyCmsSchemaDryRunOrigin.mock.calls.length).toBe(readerCount);
    for (const [input] of verifyCmsSchemaDryRunOrigin.mock.calls) {
      expect(input.env === env).toBe(true);
      same(input.envelope, body);
      expect(Object.isFrozen(input.envelope)).toBe(true);
      expect(input.signal instanceof AbortSignal && !input.signal.aborted).toBe(
        true,
      );
      same(Reflect.ownKeys(input).sort(), ['env', 'envelope', 'signal']);
    }
    if (!options.production) {
      let originIndex = 0;
      same(
        rpcCalls,
        expected
          .filter((x) => x[0] === 'rpc')
          .map((x) =>
            x[1] === ORIGIN
              ? [
                  env,
                  x[1],
                  x[2],
                  verifyCmsSchemaDryRunOrigin.mock.calls[originIndex++]?.[0]
                    .signal,
                ]
              : [env, x[1], x[2]],
          ),
      );
      expect(rpcCalls.every(([actualEnv]) => actualEnv === env)).toBe(true);
    }
    same(send.mock.calls, []);
    same(context.waitUntil.mock.calls, []);
    expect(JSON.stringify([body, jobs, leases]) === snapshots).toBe(true);
    expect([envelope, ...jobs, ...leases].every(Object.isFrozen)).toBe(true);
  };
  return { run, check, history, barrier, ack, retry };
};
const stages = (current = job(), acquired = receipt(), queued = false) => [
  R('claim_job', {
    p_job_id: JOB,
    p_expected_version: current.version,
    p_lease_token: acquired.leaseToken,
    p_lease_seconds: 300,
  }),
  [
    'effect',
    {
      envelope,
      job: current,
      leaseToken: acquired.leaseToken,
      claimedLease: acquired,
    },
  ],
  R('apply_job_outcome', {
    p_job_id: JOB,
    p_expected_version: acquired.version,
    p_lease_token: acquired.leaseToken,
    p_next_state: queued ? 'queued' : 'succeeded',
    p_result_ref: null,
    p_error_code: null,
    p_retryable: queued,
  }),
  ['applied', true],
];
const marker = () =>
  R('record_processed_event', {
    p_event_id: EVENT,
    p_event_type: 'job.requested',
    p_schema_version: 1,
    p_aggregate_id: JOB,
    p_pending_manual_review: false,
  });
const prefix = () => [read(), origin(), read(), restore(), restore()];
const done = () => [marker(), ['processed', 'recorded'], ['ack']];

describe('immutable CMS origin in actual generic receiving composition', () => {
  it('executes an older origin using the reread canonical claim and actual receipt CAS', async () => {
    const f = fixture();
    await f.run();
    f.check([...prefix(), ...stages(), ...done()], 1);
  });
  it('retries queued continuation then ACKs a fresh terminal claim for the same frozen origin', async () => {
    const f = fixture({
      twice: true,
      jobs: [job('11'), job(), job('31'), job('35')],
    });
    const first = [...prefix(), ...stages(job(), receipt(), true), ['retry']];
    await f.run();
    f.check(first, 1);
    await f.run();
    f.check(
      [
        ...first,
        ...prefix(),
        ...stages(job('35'), receipt('35', '41', TOKEN2)),
        ...done(),
      ],
      2,
    );
  });
  it('ACKs an untrusted whole origin at equal current version without effects or writes', async () => {
    const body = Object.freeze({ ...envelope, causationId: OTHER });
    const f = fixture({ mode: 'false', body, jobs: [job('7'), job('7')] });
    await f.run();
    f.check([read(), origin(body), ['ack']], 1);
  });
  it.each([
    'missing',
    'throw',
    'http',
    'json',
    'length',
    'nonboolean',
  ] as const)(
    'retries local origin reader %s before any claim or effect',
    async (mode) => {
      const f = fixture({ mode });
      await f.run();
      f.check(
        [
          read(),
          ...(mode === 'missing' || mode === 'throw' ? [] : [origin()]),
          ['retry'],
        ],
        mode === 'missing' ? 0 : 1,
      );
    },
  );
  it.each(['http', 'json', 'length', 'nonboolean'] as const)(
    'actual production factory retries protected origin response %s locally',
    async (mode) => {
      const f = fixture({ mode, production: true });
      await f.run();
      f.check([read(), origin(), ['retry']], 0);
    },
  );
  it('retains restore fencing after a true immutable origin', async () => {
    const f = fixture({ fenced: true });
    await f.run();
    f.check([read(), origin(), read(), restore(), ['retry']], 1);
  });
  it.each(['id', 'type'] as const)(
    'refuses a changed second canonical %s even at incoming version',
    async (kind) => {
      const second =
        kind === 'id'
          ? job('7', 'cms.schema.dry_run', 'queued', OTHER)
          : job('7', 'object.verify');
      const f = fixture({ jobs: [job('11'), second] });
      await f.run();
      f.check([read(), origin(), read(), restore(), ['ack']], 1);
    },
  );
  it.each([
    ['11', 'ack'],
    ['3', 'retry'],
  ] as const)(
    'keeps non-CMS version %s behavior without origin reads',
    async (version, outcome) => {
      const f = fixture({
        jobs: [job(version, 'object.verify'), job(version, 'object.verify')],
      });
      await f.run();
      f.check([read(), read(), restore(), [outcome]], 0);
    },
  );
  it.each(['flag', 'malformed'] as const)(
    'refuses %s wire input before all RPCs',
    async (kind) => {
      const body = Object.freeze(
        kind === 'flag'
          ? { ...envelope, verifiedImmutableJobOrigin: true }
          : { ...envelope, eventId: 'bad' },
      );
      const f = fixture({ body });
      await f.run();
      f.check([['retry']], 0);
    },
  );
  it('waits for the terminal processed response before ACK without sleeps', async () => {
    const f = fixture({ hold: true });
    const pending = f.run();
    try {
      await Promise.race([
        f.barrier.entered,
        pending.then(() => {
          throw new Error('Receiver ended before processed barrier');
        }),
      ]);
      same(f.history, [...prefix(), ...stages(), marker()]);
      same(f.ack.mock.calls, []);
      same(f.retry.mock.calls, []);
    } finally {
      f.barrier.release();
      await pending;
    }
    f.check([...prefix(), ...stages(), ...done()], 1);
  });
  it.each(['missing', 'throw'] as const)(
    'ACKs terminal CMS without invoking the %s reader',
    async (mode) => {
      const terminal = job('13', 'cms.schema.dry_run', 'succeeded');
      const f = fixture({ mode, jobs: [terminal, terminal] });
      await f.run();
      f.check([read(), read(), restore(), ['ack']], 0);
    },
  );
});
