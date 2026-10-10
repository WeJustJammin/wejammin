/** Controlled receiving causality only; no live SQL or stage-authority proof. */
import type { JobEffectPort } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
} from './async-entrypoint';
import {
  EVENT,
  JOB,
  OTHER,
  TOKEN,
  TOKEN2,
  envelope,
  fixture,
  gate,
  job,
  origin,
  R,
  read,
  receipt,
  restore,
  same,
  type OriginInput,
} from './async-entrypoint-cms-origin-admission-test-support';
import { createAsyncJobDependencies, createSupabaseRpc } from './async-runtime';
import type { AsyncRpcClient } from './async-runtime-rpc-types';

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

  it('retries receiver-owned cancellation while an origin refusal is deferred without ACK or writes', async () => {
    const NativeController = globalThis.AbortController;
    const owners = new Map<AbortSignal, AbortController>();
    class ObservedController extends NativeController {
      constructor() {
        super();
        owners.set(this.signal, this);
      }
    }
    const barrier = gate();
    const history: unknown[][] = [];
    const rpcCalls: Parameters<AsyncRpcClient>[] = [];
    const canonical = job();
    const before = JSON.stringify([envelope, canonical]);
    const fakeFetch: typeof fetch = async (resource, init) => {
      const url = new URL(
        resource instanceof Request ? resource.url : String(resource),
      );
      const headers = new Headers(init?.headers);
      same(
        [
          url.origin,
          url.pathname,
          init?.method,
          headers.get('accept-profile'),
          headers.get('content-profile'),
        ],
        [
          'https://controlled.invalid',
          '/rest/v1/rpc/read_canonical_job',
          'POST',
          'platform_api',
          'platform_api',
        ],
      );
      if (typeof init?.body !== 'string')
        throw new Error('Expected protected JSON body');
      const body: unknown = JSON.parse(init.body);
      history.push(R('read_canonical_job', body));
      return new Response(JSON.stringify(canonical), {
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
      history.push(['verify', input]);
      await barrier.hold();
      return false;
    });
    const effect = vi.fn<JobEffectPort['execute']>(async () => ({
      state: 'succeeded',
      resultRef: null,
      errorCode: null,
    }));
    const send = vi.fn(async () => ({
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
      verifyCmsSchemaDryRunOrigin,
      leaseToken: () => TOKEN,
      leaseSeconds: 300,
      now: () => 1_000,
    };
    const entrypoint = createAsyncEntrypoint(
      createAsyncJobDependencies(dependencies),
    );
    const ack = vi.fn(() => {
      history.push(['ack']);
    });
    const retry = vi.fn(() => {
      history.push(['retry']);
    });
    const context = { waitUntil: vi.fn() };
    const message = Object.freeze({
      body: envelope,
      id: 'origin-cancellation',
      attempts: 1,
      ack,
      retry,
    });
    let pending: Promise<void> | undefined;
    try {
      globalThis.AbortController = ObservedController;
      pending = entrypoint.queue(
        { queue: 'platform-jobs-staging', messages: [message] },
        env,
        context,
      );
      await Promise.race([
        barrier.entered,
        pending.then(() => {
          throw new Error('Receiver ended before origin cancellation barrier');
        }),
      ]);
      expect(verifyCmsSchemaDryRunOrigin.mock.calls.length).toBe(1);
      const input = verifyCmsSchemaDryRunOrigin.mock.calls[0]?.[0];
      if (input === undefined) throw new Error('Missing deferred origin input');
      expect(input.env === env).toBe(true);
      same(input.envelope, envelope);
      same(Reflect.ownKeys(input).sort(), ['env', 'envelope', 'signal']);
      expect(Object.isFrozen(input.envelope)).toBe(true);
      expect(input.signal instanceof AbortSignal && !input.signal.aborted).toBe(
        true,
      );
      const controller = owners.get(input.signal);
      if (controller === undefined)
        throw new Error('Verifier signal lacks receiver-owned controller');
      expect(controller.signal === input.signal).toBe(true);
      same(history, [read(), ['verify', input]]);
      same([ack.mock.calls, retry.mock.calls, effect.mock.calls], [[], [], []]);
      controller.abort();
      expect(input.signal.aborted).toBe(true);
      barrier.release();
      await pending;
      same(history, [read(), ['verify', input], ['retry']]);
      same(rpcCalls, [[env, 'read_canonical_job', { p_job_id: JOB }]]);
      expect(rpcCalls.every(([actualEnv]) => actualEnv === env)).toBe(true);
      same(verifyCmsSchemaDryRunOrigin.mock.calls, [[input]]);
      expect(
        verifyCmsSchemaDryRunOrigin.mock.calls[0]?.[0].signal ===
          controller.signal,
      ).toBe(true);
      same(
        [ack.mock.calls, retry.mock.calls, effect.mock.calls],
        [[], [[]], []],
      );
      same([send.mock.calls, context.waitUntil.mock.calls], [[], []]);
      expect(message.body === envelope).toBe(true);
      expect(JSON.stringify([envelope, canonical]) === before).toBe(true);
      expect(
        [message, envelope, canonical, input.envelope].every(Object.isFrozen),
      ).toBe(true);
    } finally {
      barrier.release();
      try {
        await pending;
      } finally {
        globalThis.AbortController = NativeController;
      }
    }
  });
});
