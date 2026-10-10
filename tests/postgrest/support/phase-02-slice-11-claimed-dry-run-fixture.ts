/** Public draft/attempt producers and actual BE00 claims; SELECT-only oracles. */
import { randomUUID } from 'node:crypto';

import {
  CmsUuidSchema,
  CmsVersionSchema,
  ContentSchemaRegistryDetailSchema,
  QueueEnvelopeSchema,
  SchemaDryRunResourceSchema,
} from '@wejammin/contracts';
import { expect } from 'vitest';

import { CmsSchemaDryRunClaimRequestSchema } from '../../../apps/worker/src/content-schema-registry/schema-dry-run-claim-request';
import { draftTypeBody } from './cms-app';
import { expectSafeEqual, snapshotDigest } from './phase-02-slice-11-assert';
import { snapshotClaimResolver } from './phase-02-slice-11-claim-resolver-snapshot';
import {
  createS11Session,
  s11String,
  type S11BoundSession,
} from './phase-02-slice-11-session';
import {
  callRpc,
  ensureCmsOwner,
  psql,
  tokenFor,
  type CmsOwner,
} from './stack';

export const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Claim fixture expected an object');
  return Object.fromEntries(Object.entries(value));
};
export const selectText = (sql: string): string => {
  try {
    return psql(sql);
  } catch {
    throw new Error('Claim fixture SELECT failed');
  }
};
export const selectJson = (sql: string): Record<string, unknown> => {
  try {
    return record(JSON.parse(selectText(sql)));
  } catch {
    throw new Error('Claim fixture SELECT projection is invalid');
  }
};
const uuid = (value: unknown): string => {
  const parsed = CmsUuidSchema.safeParse(value);
  if (!parsed.success) throw new Error('Claim fixture UUID is invalid');
  return parsed.data;
};
const decimal = (value: unknown): string => {
  const text =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : value;
  const parsed = CmsVersionSchema.safeParse(text);
  if (!parsed.success) throw new Error('Claim fixture version is invalid');
  return parsed.data;
};
const singleton = (value: unknown): Record<string, unknown> => {
  if (!Array.isArray(value) || value.length !== 1)
    throw new Error('Claim fixture expected exactly one returned row');
  return record(value[0]);
};
export const observeRead = async <T>(read: () => Promise<T>): Promise<T> => {
  const old = snapshotDigest();
  const added = snapshotClaimResolver();
  try {
    return await read();
  } finally {
    expectSafeEqual(
      snapshotDigest(),
      old,
      'reader changed old fourteen tables',
    );
    expectSafeEqual(
      snapshotClaimResolver(),
      added,
      'reader changed new thirteen tables',
    );
  }
};
export const resolveClaim = (
  request: unknown,
  token: string | null = tokenFor('service_role'),
) =>
  observeRead(() =>
    callRpc('cms_get_schema_migration_plan', token, { p_request: request }),
  );

export const originalEvent = (jobId: string) => {
  const raw = selectJson(`select jsonb_build_object(
    'eventId', e.id, 'eventType', e.event_type, 'schemaVersion', e.schema_version,
    'aggregateType', e.aggregate_type, 'aggregateId', e.aggregate_id,
    'aggregateVersion', e.aggregate_version::text, 'correlationId', e.correlation_id,
    'causationId', e.causation_id)::text
    from platform_private.jobs j join platform_private.outbox_events e
      on e.id = j.originating_event_id where j.id = '${uuid(jobId)}'`);
  const parsed = QueueEnvelopeSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Stored original job event is invalid');
  return parsed.data;
};

export const candidateVersion = async (
  designer: S11BoundSession,
  path: string,
) => {
  const response = await observeRead(() => designer.app.send('GET', path));
  expect(response.status, 'public candidate GET status').toBe(200);
  const parsed = ContentSchemaRegistryDetailSchema.safeParse(response.body);
  if (!parsed.success) throw new Error('Public candidate detail is invalid');
  return parsed.data.resource.version;
};
export const startAttempt = async (
  designer: S11BoundSession,
  path: string,
  version: string,
) => {
  const response = await designer.app.send('POST', `${path}/dry-runs`, {
    ifMatch: version,
    idempotencyKey: randomUUID(),
    body: {
      expectedVersion: version,
      transformKey: null,
      transformVersion: null,
    },
  });
  expect(response.status, 'public dry-run POST status').toBe(202);
  const parsed = SchemaDryRunResourceSchema.safeParse(response.body);
  if (!parsed.success) throw new Error('Public dry-run resource is invalid');
  const report = parsed.data;
  expect(report.state, 'new attempt is queued').toBe('queued');
  expectSafeEqual(
    [
      report.result,
      report.failureCode,
      report.sourceCount,
      report.targetCount,
      report.rowErrorCount,
      report.sourceHash,
      report.targetHash,
      report.reportHash,
    ],
    Array(8).fill(null),
    'queued attempt has no sealed evidence',
  );
  const current = await observeRead(() =>
    callRpc('read_canonical_job', tokenFor('service_role'), {
      p_job_id: report.jobId,
    }),
  );
  expect(current.status, 'canonical preclaim read status').toBe(200);
  const job = singleton(current.body);
  expectSafeEqual(
    [job.id, job.type, job.state, job.lease_until],
    [report.jobId, 'cms.schema.dry_run', 'queued', null],
    'actual preclaim job',
  );
  return {
    report,
    preclaimVersion: decimal(job.version),
    event: originalEvent(report.jobId),
  };
};

export const prepareClaimAttempt = async (
  owner: CmsOwner = ensureCmsOwner(),
) => {
  const designer = await createS11Session({
    ...owner,
    actingPartyId: owner.organizationId,
  });
  const draft = await designer.app.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(`claim_${randomUUID().replaceAll('-', '')}`),
    idempotencyKey: randomUUID(),
  });
  expect(draft.status, 'public draft POST status').toBe(201);
  const versionId = uuid(draft.body.id);
  const contentTypeId = uuid(draft.body.contentTypeId);
  const path = `/api/v1/cms/content-types/${contentTypeId}/versions/${versionId}`;
  return {
    owner,
    designer,
    path,
    versionId,
    contentTypeId,
    ...(await startAttempt(designer, path, decimal(draft.body.version))),
  };
};
export type ClaimAttempt = Awaited<ReturnType<typeof prepareClaimAttempt>>;

export const claimAttempt = async (
  attempt: ClaimAttempt,
  leaseSeconds = 840,
) => {
  const leaseToken = randomUUID();
  const response = await callRpc('claim_job', tokenFor('service_role'), {
    p_job_id: attempt.report.jobId,
    p_expected_version: attempt.preclaimVersion,
    p_lease_token: leaseToken,
    p_lease_seconds: leaseSeconds,
  });
  expect(response.status, 'actual BE00 claim status').toBe(200);
  const receipt = singleton(response.body);
  expectSafeEqual(
    [receipt.job_id, receipt.state],
    [attempt.report.jobId, 'running'],
    'actual BE00 claim receipt',
  );
  const parsed = CmsSchemaDryRunClaimRequestSchema.safeParse({
    claimedJob: {
      jobId: receipt.job_id,
      version: decimal(receipt.version),
      leaseToken,
    },
    requestedEvent: attempt.event,
  });
  if (!parsed.success) throw new Error('Actual claim request is invalid');
  expectSafeEqual(
    originalEvent(attempt.report.jobId),
    attempt.event,
    'claim preserves original event',
  );
  return parsed.data;
};

export const legacyRequest = (attempt: ClaimAttempt) => ({
  migrationPlanId: attempt.report.migrationPlanId,
  schemaVersionId: attempt.versionId,
  expectedVersion:
    selectText(`select version::text from platform_private.cms_schema_migration_plans
    where id = '${attempt.report.migrationPlanId}'`),
});
export const supersedeAttempt = async (
  attempt: ClaimAttempt,
): Promise<ClaimAttempt> => {
  const version = await candidateVersion(attempt.designer, attempt.path);
  const key = `extra_${randomUUID().replaceAll('-', '')}`;
  const field = await attempt.designer.app.send(
    'POST',
    `${attempt.path}/fields`,
    {
      ifMatch: version,
      idempotencyKey: randomUUID(),
      body: {
        key,
        kind: 'short_text',
        constraints: {},
        required: false,
        validatorKey: null,
        validatorVersion: null,
        defaultMode: 'none',
        localizationMode: 'none',
        editorConfig: { label: key, order: 1 },
        lifecycle: 'active',
        migrationPlanId: null,
      },
    },
  );
  expect(field.status, 'public optional field POST status').toBe(201);
  expect(
    selectText(`select count(*) from platform_private.cms_field_definition_versions
    where content_type_version_id = '${attempt.versionId}' and field_key = '${key}'`) ===
      '1',
    'optional field persisted',
  ).toBe(true);
  const updated = await candidateVersion(attempt.designer, attempt.path);
  return {
    ...attempt,
    ...(await startAttempt(attempt.designer, attempt.path, updated)),
  };
};

export const storedVersion = (
  value: Record<string, unknown>,
  key: string,
): string => decimal(s11String(value, key));
