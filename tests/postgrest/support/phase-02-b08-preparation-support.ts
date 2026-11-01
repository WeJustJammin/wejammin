/**
 * Real-stack support for the tracked boundary #128 suites (B-08): deliveries go through the PRODUCTION async
 * entrypoint (queue handler, orchestration, consumer, dispatcher, claimed preparation, stages) over real
 * `fetch` to Kong and PostgREST. The transport wrapper only records; it never rewrites an answer. SQL here
 * reads evidence, except the one declared Job-lease expiry control in `expireJobLease`.
 */
import { randomUUID } from 'node:crypto';

import {
  ContentSchemaRegistryDetailSchema,
  SchemaDryRunResourceSchema,
} from '@wejammin/contracts';
import { expect, vi } from 'vitest';

import type { AsyncWorkerBindings } from '../../../apps/worker/src/async-entrypoint';
import { parseProjection } from '../../../apps/worker/src/jobs/job-status-production-parsers';
import { createProductionAsyncEntrypoint } from '../../../apps/worker/src/production-async-entrypoint';
import type { ProductionSchemaMigrationWorkerOptions } from '../../../apps/worker/src/production-worker-runtime-cms';
import {
  originalEvent,
  selectJson,
  selectText,
} from './phase-02-slice-11-claimed-dry-run-fixture';
import {
  createS11Session,
  s11Environment,
  s11String,
  type S11BoundSession,
} from './phase-02-slice-11-session';
import { createS11Stack } from './phase-02-slice-11-stack';
import { prepareS11World, seedDraft } from './phase-02-slice-11-world';
import { callRpc, ensureCmsOwner, tokenFor } from './stack';

export const versionPath = (typeId: string, versionId: string): string =>
  `/api/v1/cms/content-types/${typeId}/versions/${versionId}`;

export type Delivered = Readonly<{
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  /** Every RPC the delivery sent over the wire, in order. */
  rpcs: readonly string[];
}>;

/** One queue delivery of the verified original `job.requested` envelope through the production entrypoint. */
export const deliver = async (
  event: unknown,
  options: Readonly<{
    attempts?: number;
    migration?: ProductionSchemaMigrationWorkerOptions;
    /** Called after each RPC answered, with a clone of the response; may run controlled SQL. */
    afterRpc?: (rpc: string, response: Response) => void | Promise<void>;
  }> = {},
): Promise<Delivered> => {
  const rpcs: string[] = [];
  const recording: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = String(input instanceof Request ? input.url : input);
    const rpc = /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1];
    if (rpc !== undefined) {
      rpcs.push(rpc);
      await options.afterRpc?.(rpc, response.clone());
    }
    return response;
  };
  const env: AsyncWorkerBindings = {
    ...s11Environment(),
    PLATFORM_JOBS: { send: vi.fn() },
  };
  const ack = vi.fn();
  const retry = vi.fn();
  await createProductionAsyncEntrypoint(
    recording,
    undefined,
    options.migration,
  ).queue(
    {
      queue: 'platform-jobs',
      messages: [
        {
          ack,
          retry,
          attempts: options.attempts ?? 1,
          body: event,
          id: randomUUID(),
        },
      ],
    },
    env,
    { waitUntil: vi.fn() },
  );
  return { ack, retry, rpcs };
};

export const jobRow = (jobId: string) =>
  selectJson(`select jsonb_build_object('state', j.state, 'resultRef', j.result_ref,
    'errorCode', j.error_code, 'attemptCount', j.attempt_count, 'actorId', j.actor_id,
    'leaseUntil', j.lease_until, 'version', j.version::text)::text
    from platform_private.jobs j where j.id = '${jobId}'`);

export const reportRow = (reportId: string) =>
  selectJson(`select jsonb_build_object('state', r.state, 'result', r.result,
    'failureCode', r.failure_code, 'sealed', r.sealed_at is not null,
    'sourceCount', r.source_count::text, 'rowErrorCount', r.row_error_count::text)::text
    from platform_private.cms_schema_dry_run_reports r where r.id = '${reportId}'`);

export const planRow = (planId: string) =>
  selectJson(`select jsonb_build_object('state', p.state, 'cursor', p.cursor::text,
    'version', p.version::text, 'sourceCount', p.source_count::text)::text
    from platform_private.cms_schema_migration_plans p where p.id = '${planId}'`);

/** Per-row scan evidence of one report: rows recorded and distinct source rows (they must be equal). */
export const evidenceCount = (reportId: string) =>
  selectJson(`select jsonb_build_object('rows', count(*), 'distinct', count(distinct source_row_id))::text
    from platform_private.cms_schema_dry_run_row_evidence where report_id = '${reportId}'`);

export const processedCount = (eventId: string): number =>
  Number(
    selectText(
      `select count(*) from platform_private.processed_events where event_id = '${eventId}'`,
    ),
  );

/** Declared control: the Job lease lapses in SQL, as a crashed or stalled delivery's would. */
export const expireJobLease = (jobId: string): void => {
  selectText(`update platform_private.jobs set lease_until = clock_timestamp() - interval '1 second'
    where id = '${jobId}' and state = 'running'`);
};

/** The projection the Job status route reads, parsed by the production parser into a `JobStatus`. */
export const polledStatus = async (jobId: string) => {
  const actorId = s11String(jobRow(jobId), 'actorId');
  const response = await callRpc(
    'read_authorized_job',
    tokenFor('service_role'),
    {
      p_acting_party_id: null,
      p_actor_id: actorId,
      p_capability: null,
      p_job_id: jobId,
      p_reason: null,
      p_step_up_verified: false,
    },
  );
  expect(response.status, 'read_authorized_job status').toBe(200);
  const body: unknown = Array.isArray(response.body)
    ? response.body[0]
    : response.body;
  const parsed = parseProjection(body, jobId, {
    actorId,
    actingPartyId: null,
    capabilities: [],
    capability: null,
    kind: 'user',
    stepUpVerified: false,
    reason: null,
  });
  if (parsed === null)
    throw new Error('The production status parser refused the stored Job');
  return parsed.data;
};

export type B08World = Readonly<{
  designer: S11BoundSession;
  contentTypeId: string;
  /** The one live successor draft of the populated type. */
  draftId: string;
  path: string;
  rows: number;
}>;

const detailVersion = async (
  designer: S11BoundSession,
  path: string,
): Promise<string> => {
  const response = await designer.app.send('GET', path);
  expect(response.status, 'candidate GET').toBe(200);
  return ContentSchemaRegistryDetailSchema.parse(response.body).resource
    .version;
};

/** Edits the successor draft through CMS-03A-02: appends a new field (an existing field cannot be tightened without a ready plan). */
export const changeDraft = async (
  world: B08World,
  field: Readonly<{
    key: string;
    constraints: Record<string, unknown>;
    required: boolean;
    order: number;
  }>,
): Promise<void> => {
  const version = await detailVersion(world.designer, world.path);
  const response = await world.designer.app.send(
    'POST',
    `${world.path}/fields`,
    {
      ifMatch: version,
      idempotencyKey: randomUUID(),
      body: {
        key: field.key,
        kind: 'short_text',
        constraints: field.constraints,
        required: field.required,
        validatorKey: null,
        validatorVersion: null,
        defaultMode: 'none',
        localizationMode: 'none',
        editorConfig: { label: field.key, order: field.order },
        lifecycle: 'active',
        migrationPlanId: null,
      },
    },
  );
  expect(
    response.status,
    `field change ${field.key}: ${JSON.stringify(response.body)}`,
  ).toBe(201);
};

/**
 * A completed preparation closes the candidate's dry run (a new attempt is 409 INVALID_TRANSITION), so the
 * next attempt edits the draft first with one more optional field: an additive change, so the scan seals clean.
 */
export const editDraftForNextAttempt = (world: B08World): Promise<void> =>
  changeDraft(world, {
    key: `extra_${randomUUID().replaceAll('-', '')}`,
    constraints: {},
    required: false,
    order: 2,
  });

/** A populated active type (`rows` draft entries) with one live successor draft. */
export const prepareB08World = async (rows: number): Promise<B08World> => {
  const owner = ensureCmsOwner();
  const world = await prepareS11World({ fresh: true });
  const stack = createS11Stack(world.owner);
  for (let index = 1; index <= rows; index += 1)
    await seedDraft(stack, world, `B08 populated entry number ${index}`);
  const designer = await createS11Session({
    ...owner,
    actingPartyId: owner.organizationId,
  });
  const sourcePath = versionPath(
    world.editorial.contentTypeId,
    world.editorial.contentTypeVersionId,
  );
  const source = await designer.app.send('GET', sourcePath);
  expect(source.status, 'source GET').toBe(200);
  const successor = await designer.app.send(
    'POST',
    `${sourcePath}/successors`,
    {
      ifMatch: ContentSchemaRegistryDetailSchema.parse(source.body).resource
        .version,
      idempotencyKey: randomUUID(),
      body: {
        expectedVersion: ContentSchemaRegistryDetailSchema.parse(source.body)
          .resource.version,
        supportedLocales: null,
        fallbackChains: null,
        defaultTemplateVersionId: null,
        templateBindings: null,
      },
    },
  );
  expect(successor.status, `successor: ${JSON.stringify(successor.body)}`).toBe(
    201,
  );
  const draftId = s11String(successor.body, 'id');
  return {
    designer,
    contentTypeId: world.editorial.contentTypeId,
    draftId,
    path: versionPath(world.editorial.contentTypeId, draftId),
    rows,
  };
};

export type Attempt = Readonly<{
  reportId: string;
  jobId: string;
  planId: string;
  event: ReturnType<typeof originalEvent>;
}>;

/** CMS-03A-10: starts one dry-run attempt of the successor draft; the Job is `queued` with its original event. */
export const startAttempt = async (
  world: B08World,
  transform: Readonly<{ key: string; version: string }> | null = null,
): Promise<Attempt> => {
  const version = await detailVersion(world.designer, world.path);
  const response = await world.designer.app.send(
    'POST',
    `${world.path}/dry-runs`,
    {
      ifMatch: version,
      idempotencyKey: randomUUID(),
      body: {
        expectedVersion: version,
        transformKey: transform?.key ?? null,
        transformVersion: transform?.version ?? null,
      },
    },
  );
  expect(
    response.status,
    `dry-run start: ${JSON.stringify(response.body)}`,
  ).toBe(202);
  const report = SchemaDryRunResourceSchema.parse(response.body);
  expect(jobRow(report.jobId).state).toBe('queued');
  return {
    reportId: report.id,
    jobId: report.jobId,
    planId: report.migrationPlanId,
    event: originalEvent(report.jobId),
  };
};
