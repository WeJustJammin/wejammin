/**
 * A controlled PostgREST for one `cms.schema.dry_run` Job delivered through the real production async
 * entrypoint (queue handler, orchestration, consumer, dispatcher, preparation callback, claimed entry and
 * stage modules). Only the HTTP edge is scripted; the Job lease states follow the real SQL rules closely
 * enough for the checkpoint session (version bump on claim and apply, token-aware outcome) and the plan
 * replies are supplied per test. No SQL authority is proven here: the apispec files do that.
 */
import { vi } from 'vitest';

import { QueueEnvelopeSchema } from '@wejammin/contracts';

import {
  createProductionAsyncEntrypoint,
  type ProductionSchemaMigrationWorkerOptions,
} from './index';
import type { AsyncWorkerBindings } from './async-entrypoint';
import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import type { SchemaMigrationRpcName } from './content-schema-registry/migration-worker-constants';
import {
  firstFixture,
  IDS,
} from './content-schema-registry/schema-dry-run-claim-response-test-support';

export { IDS };
export const PRECLAIM_VERSION = '7';
export const CLAIM_VERSION = '19';
export const SCAN_TOKEN = 'eeeeeeee-0000-4000-8000-000000000021';
export const BACKFILL_TOKEN = 'ffffffff-0000-4000-8000-000000000022';

export const ENVELOPE = QueueEnvelopeSchema.parse({
  eventId: IDS.event,
  eventType: 'job.requested',
  schemaVersion: 1,
  aggregateType: 'job',
  aggregateId: IDS.job,
  aggregateVersion: '3',
  correlationId: IDS.other,
  causationId: null,
});

export const bindings = (
  overrides: Partial<Record<'SUPABASE_URL', string>> = {},
): AsyncWorkerBindings => ({
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'b128-release',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://production.example.supabase.co',
  PLATFORM_JOBS: { send: vi.fn() },
  ...overrides,
});

export type RpcCall = Readonly<{
  operation: string;
  body: Record<string, unknown>;
}>;
export type PlanScript = Partial<
  Record<
    SchemaMigrationRpcName,
    (request: Record<string, unknown>, world: World) => unknown
  >
>;
export type World = ReturnType<typeof createWorld>;

type PlanChanges = Parameters<typeof firstFixture>[0];

/** The plan record of the DEC-162 first-empty baseline (draft, zero rows), with overrides. */
export const planOf = (changes: PlanChanges = {}) => firstFixture(changes).plan;

/** The claimed read's answer for `request`: the original event bound to the claim receipt, plus the plan. */
export const claimedResponse = (
  request: Record<string, unknown>,
  plan: PlanChanges = {},
) => {
  const claimedJob = request.claimedJob as Record<string, unknown>;
  const base = firstFixture(plan);
  return {
    ...base,
    job: { ...base.job, version: claimedJob.version },
    requestedEvent: { ...base.requestedEvent, ...ENVELOPE },
  };
};

export const createWorld = (
  script: PlanScript,
  options: Readonly<{
    jobType?: string;
    leaseMs?: number;
    heartbeat?: boolean;
    /** RPC operations whose HTTP call never answers until the request is aborted. */
    hang?: readonly string[];
  }> = {},
) => {
  const calls: RpcCall[] = [];
  const job = {
    type: options.jobType ?? 'cms.schema.dry_run',
    state: 'queued',
    version: PRECLAIM_VERSION,
    leaseUntil: null as string | null,
    leaseToken: null as string | null,
    claims: 0,
  };
  const outcomes: Record<string, unknown>[] = [];
  const processed: Record<string, unknown>[] = [];
  const respond = (operation: string, body: Record<string, unknown>) => {
    switch (operation) {
      case 'read_restore_fence':
        return {
          expected_epoch: '1',
          consumer_epoch: '1',
          integrity_verified: true,
          reconciliation_complete: true,
        };
      case 'read_canonical_job':
        return {
          id: IDS.job,
          type: job.type,
          state: job.state,
          version: job.version,
          leaseUntilMs: job.leaseUntil,
        };
      case 'claim_job': {
        job.state = 'running';
        job.version = CLAIM_VERSION;
        job.claims += 1;
        job.leaseToken = String(body.p_lease_token);
        job.leaseUntil = new Date(
          Date.now() + (options.leaseMs ?? 300_000),
        ).toISOString();
        return {
          job_id: IDS.job,
          lease_until: job.leaseUntil,
          state: 'running',
          version: job.version,
          attempt_count: job.claims,
        };
      }
      case 'apply_job_outcome':
        outcomes.push(body);
        job.state = String(body.p_next_state);
        job.version = String(BigInt(job.version) + 1n);
        return true;
      case 'record_processed_event':
        processed.push(body);
        return 'recorded';
      case 'heartbeat_job_lease':
        if (options.heartbeat === false) return false;
        // A renewal moves the expiry and bumps the version, as the SQL does.
        job.version = String(BigInt(job.version) + 1n);
        job.leaseUntil = new Date(Date.now() + 300_000).toISOString();
        return true;
      default: {
        const handler = script[operation as SchemaMigrationRpcName];
        const request = (body.p_request ?? {}) as Record<string, unknown>;
        if (operation === RPC.readPlan && 'originEvent' in request) return true;
        if (handler === undefined)
          throw new Error(`Unscripted RPC ${operation}`);
        return handler(request, world);
      }
    }
  };
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const operation = new URL(String(input)).pathname.split('/').at(-1)!;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ operation, body });
      if (options.hang?.includes(operation) === true)
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      try {
        return Response.json(respond(operation, body));
      } catch (error) {
        if (error instanceof Response) return error;
        return new Response('{}', { status: 503 });
      }
    },
  );
  const world = { calls, job, outcomes, processed, fetchImpl };
  return world;
};

export const deliver = async (
  world: World,
  attempts = 1,
  migrationOptions?: ProductionSchemaMigrationWorkerOptions,
  env: AsyncWorkerBindings = bindings(),
) => {
  const ack = vi.fn();
  const retry = vi.fn();
  const entrypoint = createProductionAsyncEntrypoint(
    world.fetchImpl as unknown as typeof fetch,
    undefined,
    migrationOptions,
  );
  await entrypoint.queue(
    {
      queue: 'platform-jobs',
      messages: [{ ack, retry, attempts, body: ENVELOPE, id: 'm-1' }],
    },
    env,
    { waitUntil: vi.fn() },
  );
  return { ack, retry };
};

export const operations = (world: World): string[] =>
  world.calls.map(({ operation }) => operation);

/** The scripted worker RPCs of the first-empty baseline (draft plan, zero rows) up to the sealed READY plan. */
export const firstEmptyScript = (): PlanScript => {
  return {
    [RPC.readPlan]: (request) => claimedResponse(request),
    [RPC.claimLease]: (request) => ({
      acquired: true,
      leaseToken: SCAN_TOKEN,
      plan: planOf({
        state: 'dry_running',
        version: '8',
        leaseOwner: String(request.workerId),
        leaseToken: SCAN_TOKEN,
        leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
      }),
    }),
    [RPC.heartbeatLease]: () => ({ renewed: true }),
    [RPC.readSourceRows]: () => ({
      rows: [],
      nextCursor: '0',
      done: true,
      targetFields: [],
      retiredFields: [],
    }),
    [RPC.processDryRunBatch]: () => ({
      done: true,
      cursor: '0',
      progress: 1,
      sourceCount: '0',
      targetCount: '0',
      rowErrorCount: '0',
      migratedCount: '0',
      failedCount: '0',
    }),
    [RPC.finalizeDryRun]: () =>
      planOf({ state: 'ready', version: '9', progress: 1 }),
  };
};
