/** No-DB external boundaries only. Never delegates a process or fetch to the host. */
import { execFileSync } from 'node:child_process';
import { setImmediate } from 'node:timers/promises';
import type { JobEffectInput } from '@wejammin/application';
import { vi } from 'vitest';

import {
  openDec194AltStack,
  type IsolationWorld,
} from './phase-02-slice-12-dec194-alt-stack';
import { createDec194IsolationWorker } from './phase-02-slice-12-dec194-isolation-worker';
import { finishDec194IsolationRun } from './phase-02-slice-12-dec194-lifecycle';
import { createUnitCatalog } from './phase-02-slice-12-dec194-unit-catalog';
export type { Binding } from './phase-02-slice-12-dec194-unit-catalog';

const id = (n: number): string =>
  `19400000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const WORLD: IsolationWorld = {
  authUserId: id(1),
  personId: id(2),
  partyId: id(3),
  bindingId: id(4),
  taxonomyId: id(5),
  sourceId: id(6),
  survivorId: id(7),
  sourceKey: 'iso-source',
  expectedVersion: '1',
  upstreamJobId: id(8),
};
export const CLAIMED: JobEffectInput = {
  job: {
    id: id(9),
    type: 'cms.taxonomy.merge_converge',
    state: 'queued',
    version: '1',
    leaseUntilMs: null,
  },
  envelope: {
    aggregateId: id(9),
    aggregateType: 'job',
    aggregateVersion: '1',
    causationId: null,
    correlationId: id(10),
    eventId: id(11),
    eventType: 'job.requested',
    schemaVersion: 1,
  },
  leaseToken: id(12),
  claimedLease: {
    jobId: id(9),
    leaseToken: id(12),
    expectedVersion: '1',
    version: '2',
    leaseUntilMs: Date.parse('2026-10-16T12:05:00Z'),
  },
};
type Watched = {
  settled: boolean;
  countsAsWork: boolean;
  value?: unknown;
  error?: unknown;
  done: Promise<void>;
};
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await vi.advanceTimersByTimeAsync(0);
    await setImmediate();
  }
};
export const tick = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
};

export const createUnitHarness = (activate = true) => {
  if (!vi.isMockFunction(execFileSync))
    throw new Error('Unit process mock is mandatory.');
  for (const key of ['ROOT', 'FIXTURE', 'CLEANUP'])
    vi.stubEnv(`S12_DEC194_RPC_${key}_RELEASE`, '2026-10-16-local-alt');
  vi.stubEnv('S12_DEC194_RPC_NON_RC_EXPECTED', undefined);
  const events: string[] = [];
  const dropped: {
    restoredFetch: boolean;
    activeFetches: number;
    activeWork: number;
  }[] = [];
  const watched: Watched[] = [];
  let onDrop = () => {};
  const catalog = createUnitCatalog(events, () => onDrop());
  const { schemas, triggers, statements } = catalog;
  const container = (name: string) =>
    JSON.stringify([
      {
        Name: `/${name}`,
        State: { Running: true },
        Config: {
          Env: [
            'PGRST_DB_SCHEMAS=platform_api,public_api',
            'PGRST_DB_URI=postgres://unit:unit@supabase_db_wejammin_ev:5432/postgres',
          ],
        },
        NetworkSettings: {
          Ports: {
            '5432/tcp': [{ HostPort: '55322' }],
            '8000/tcp': [{ HostPort: '55321' }],
          },
        },
      },
    ]);
  const execute = (statement: string): string => {
    const result = catalog.execute(statement);
    if (result !== undefined) return result;
    if (/select ids from/iu.test(statement)) return JSON.stringify(WORLD);
    if (/aggregateId/iu.test(statement))
      return JSON.stringify(CLAIMED.envelope);
    if (/jsonb_build_object/iu.test(statement))
      return JSON.stringify({
        id: WORLD.upstreamJobId,
        type: CLAIMED.job.type,
        state: 'cancelled',
        version: '3',
      });
    throw new Error('Unrecognised unit SQL boundary.');
  };
  vi.mocked(execFileSync).mockImplementation(((
    program: string,
    args: string[],
    options: { input?: string },
  ) => {
    if (program === 'pnpm')
      return 'API_URL="http://127.0.0.1:55321"\nDB_URL="postgres://unit:unit@127.0.0.1:55322/postgres"';
    if (program !== 'docker') throw new Error('Unrecognised unit process.');
    if (args[0] === 'inspect') return container(args[1]!);
    if (args.includes('/home/kong/kong.yml'))
      return 'supabase_rest_wejammin_ev sb_secret_unit_only';
    if (args.includes('psql')) return execute(options.input ?? '');
    throw new Error('Unrecognised unit Docker boundary.');
  }) as typeof execFileSync);

  type Call = {
    operation: string;
    signal: AbortSignal;
    aborted: boolean;
    settled: boolean;
    acknowledge: () => void;
  };
  const calls: Call[] = [];
  let mode: 'hold' | 'retry' | 'success' = 'hold';
  const success = (
    operation: string,
    body: Record<string, unknown>,
  ): Response => {
    if (operation === 'cms_reconcile_taxonomy_merge_converge')
      return Response.json({ requested: 0 });
    if (operation === 'cms_run_taxonomy_merge_converge')
      return Response.json({
        converged: 1,
        remaining: 0,
        continuationJobId: null,
      });
    if (operation === 'apply_job_outcome') return Response.json(true);
    if (operation === 'read_canonical_job')
      return Response.json({
        id: body.p_job_id,
        type: CLAIMED.job.type,
        state: body.p_job_id === WORLD.upstreamJobId ? 'cancelled' : 'queued',
        version: body.p_job_id === WORLD.upstreamJobId ? '3' : '1',
        leaseUntilMs: null,
      });
    if (operation === 'claim_job')
      return Response.json({
        jobId: body.p_job_id,
        version: '2',
        leaseToken: body.p_lease_token,
        leaseUntilMs: Date.now() + 300_000,
      });
    return Response.json({
      id: WORLD.sourceId,
      termId: WORLD.sourceId,
      version: '2',
      contentHash: 'a'.repeat(64),
      createdAt: '2026-10-16T12:00:00Z',
      updatedAt: '2026-10-16T12:00:00Z',
      lifecycle: 'merged',
      taxonomyId: WORLD.taxonomyId,
      termKey: WORLD.sourceKey,
      parentId: null,
      successorId: WORLD.survivorId,
    });
  };
  const fetchBoundary = vi.fn<typeof fetch>((input, init) => {
    const operation = new URL(String(input)).pathname.split('/').at(-1)!;
    if (!(init?.signal instanceof AbortSignal))
      throw new Error('Production transport signal missing.');
    const signal = init.signal;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    let resolve!: (value: Response) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const onAbort = () => {
      call.aborted = true;
      events.push(`abort:${operation}`);
    };
    const call: Call = {
      operation,
      signal,
      aborted: signal.aborted,
      settled: false,
      acknowledge: () => {
        if (call.settled) return;
        call.settled = true;
        signal.removeEventListener('abort', onAbort);
        events.push(`ack:${operation}`);
        if (call.aborted)
          reject(
            new DOMException('Unit cancellation acknowledged', 'AbortError'),
          );
        else resolve(success(operation, body));
      },
    };
    calls.push(call);
    events.push(`fetch:${operation}`);
    signal.addEventListener('abort', onAbort, { once: true });
    if (mode === 'retry') {
      call.settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(
        Response.json({ code: 'P0001', message: 'CONFLICT' }, { status: 409 }),
      );
    } else if (mode === 'success') call.acknowledge();
    return pending;
  });
  vi.stubGlobal('fetch', fetchBoundary);
  const stack = openDec194AltStack();
  stack.prepareFixture();
  if (activate) stack.activateProbe();
  const worker = createDec194IsolationWorker(stack, WORLD);
  const watch = (promise: Promise<unknown>, countsAsWork = true): Watched => {
    const state: Watched = {
      settled: false,
      countsAsWork,
      done: Promise.resolve(),
    };
    state.done = promise.then(
      (value) => {
        state.value = value;
        state.settled = true;
      },
      (error: unknown) => {
        state.error = error;
        state.settled = true;
      },
    );
    watched.push(state);
    return state;
  };
  onDrop = () =>
    dropped.push({
      restoredFetch: globalThis.fetch === fetchBoundary,
      activeFetches: calls.filter((call) => !call.settled).length,
      activeWork: watched.filter(
        (state) => state.countsAsWork && !state.settled,
      ).length,
    });
  const finish = () =>
    watch(Promise.resolve(finishDec194IsolationRun({ stack, worker })), false);
  const drain = async (): Promise<void> => {
    mode = 'success';
    for (const call of calls) call.acknowledge();
    await tick(250_000);
    await Promise.all(watched.map((state) => state.done));
  };
  return {
    stack,
    worker,
    events,
    schemas,
    triggers,
    statements,
    dropped,
    calls,
    fetchBoundary,
    watch,
    finish,
    drain,
    mode: (value: typeof mode) => {
      mode = value;
    },
  };
};
export type UnitHarness = ReturnType<typeof createUnitHarness>;
