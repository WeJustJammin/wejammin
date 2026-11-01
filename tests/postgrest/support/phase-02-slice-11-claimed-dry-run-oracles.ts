import { expect } from 'vitest';

import type { CmsSchemaDryRunClaimRequest } from '../../../apps/worker/src/content-schema-registry/schema-dry-run-claim-request';
import { CmsSchemaDryRunClaimResponseSchema } from '../../../apps/worker/src/content-schema-registry/schema-dry-run-claim-response';
import { expectSafeEqual } from './phase-02-slice-11-assert';
import {
  originalEvent,
  resolveClaim,
  selectJson,
  selectText,
  storedVersion,
  type ClaimAttempt,
} from './phase-02-slice-11-claimed-dry-run-fixture';
import type { RpcOutcome } from './stack';

export const storedProjection = (attempt: ClaimAttempt) =>
  selectJson(`select jsonb_build_object(
  'job', jsonb_build_object('id', j.id, 'type', j.job_type, 'version', j.version::text,
    'actingPartyId', j.acting_party_id, 'originatingEventId', j.originating_event_id),
  'report', jsonb_build_object('id', r.id, 'jobId', r.job_id, 'planId', r.plan_id,
    'ownerId', r.owner_id, 'contentTypeId', r.content_type_id,
    'sourceVersionId', r.source_version_id, 'targetVersionId', r.target_version_id),
  'candidate', jsonb_build_object('id', c.id, 'ownerId', c.owner_id,
    'contentTypeId', c.content_type_id, 'supersedesId', c.supersedes_id, 'dryRunId', c.dry_run_id),
  'planScope', jsonb_build_object('ownerId', p.owner_id, 'dryRunId', p.dry_run_report->>'dryRunId'),
  'plan', jsonb_build_object('id', p.id, 'contentTypeId', p.content_type_id,
    'fromVersionId', p.from_version_id, 'toVersionId', p.to_version_id,
    'state', p.state, 'version', p.version::text, 'cursor', p.cursor::text,
    'progress', p.progress, 'sourceCount', p.source_count::text, 'targetCount', p.target_count::text,
    'rowErrorCount', p.row_error_count::text, 'migratedCount', p.migrated_count::text,
    'failedCount', p.failed_count::text, 'classification', p.classification,
    'transformKey', p.transform_key, 'transformVersion', p.transform_version::text,
    'compilerHash', a.artifact_hash, 'sourceHash', coalesce(s.definition_hash, repeat('0', 64)),
    'targetHash', c.definition_hash, 'activeVersionId', coalesce(active.id, s.id),
    'leaseOwner', nullif(p.dry_run_report->'lease'->>'owner', ''),
    'leaseToken', nullif(p.dry_run_report->'lease'->>'token', ''),
    'leaseExpiresAt', nullif(p.dry_run_report->'lease'->>'expiresAt', '')))::text
  from platform_private.cms_schema_dry_run_reports r
  join platform_private.jobs j on j.id = r.job_id
  join platform_private.cms_content_type_versions c on c.id = r.target_version_id
  join platform_private.cms_schema_migration_plans p on p.id = r.plan_id
  join platform_private.cms_schema_artifacts a on a.id = c.schema_artifact_id
  left join platform_private.cms_content_type_versions s on s.id = p.from_version_id
  left join platform_private.cms_content_type_versions active
    on active.content_type_id = p.content_type_id and active.owner_id = p.owner_id and active.state = 'active'
  where r.id = '${attempt.report.id}'`);

export const attemptState = (attempt: ClaimAttempt) =>
  selectJson(`select jsonb_build_object(
  'planVersion', p.version::text, 'superseded', p.superseded_at is not null,
  'planState', p.state, 'fingerprint', p.dry_run_report,
  'reportState', r.state, 'failureCode', r.failure_code, 'jobId', r.job_id, 'planId', r.plan_id,
  'finalEvidence', jsonb_build_array(r.result, r.report, r.source_hash, r.target_hash,
    r.compiler_hash, r.source_count, r.target_count, r.row_error_count,
    r.migrated_count, r.failed_count, r.sealed_at),
  'candidateDryRunId', c.dry_run_id, 'definitionHash', c.definition_hash,
  'artifactHash', a.artifact_hash, 'job', to_jsonb(j),
  'livePairCount', (select count(*) from platform_private.cms_schema_migration_plans lp
    where lp.to_version_id = p.to_version_id and lp.from_version_id is not distinct from p.from_version_id
      and lp.superseded_at is null))::text
  from platform_private.cms_schema_migration_plans p
  join platform_private.cms_schema_dry_run_reports r on r.plan_id = p.id
  join platform_private.cms_content_type_versions c on c.id = p.to_version_id
  join platform_private.cms_schema_artifacts a on a.id = c.schema_artifact_id
  join platform_private.jobs j on j.id = r.job_id where p.id = '${attempt.report.migrationPlanId}'`);

export const refusal = (
  response: RpcOutcome,
  message: string,
  status = 400,
  code = 'P0001',
) => {
  expectSafeEqual(
    [response.status, response.code, response.message],
    [status, code, message],
    'resolver refusal status/SQLSTATE/reason',
  );
};
export const accepted = async (
  attempt: ClaimAttempt,
  input: CmsSchemaDryRunClaimRequest,
) => {
  const expected = {
    ...storedProjection(attempt),
    requestedEvent: originalEvent(attempt.report.jobId),
  };
  const response = await resolveClaim(input);
  expect(response.status, 'new-branch resolver status').toBe(200);
  const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(response.body);
  expect(parsed.success, 'closed six-object resolver response').toBe(true);
  if (!parsed.success) throw new Error('Resolver response contract is invalid');
  expectSafeEqual(
    parsed.data,
    expected,
    'complete resolver projection matches stored rows',
  );
  expectSafeEqual(
    parsed.data.job,
    {
      id: input.claimedJob.jobId,
      type: 'cms.schema.dry_run',
      version: input.claimedJob.version,
      actingPartyId: attempt.owner.organizationId,
      originatingEventId: input.requestedEvent.eventId,
    },
    'actual claimed job identity and version',
  );
  expectSafeEqual(
    parsed.data.requestedEvent,
    input.requestedEvent,
    'all eight original event fields',
  );
  return parsed.data;
};
export const assertSupersession = ({
  old,
  oldRequest,
  before,
  newer,
  after,
  fresh,
}: Readonly<{
  old: ClaimAttempt;
  oldRequest: CmsSchemaDryRunClaimRequest;
  before: Record<string, unknown>;
  newer: ClaimAttempt;
  after: Record<string, unknown>;
  fresh: Record<string, unknown>;
}>): void => {
  expectSafeEqual(
    [before.superseded, after.superseded, after.planState],
    [false, true, before.planState],
    'old plan retained without invented state',
  );
  expect(
    BigInt(storedVersion(after, 'planVersion')) >
      BigInt(storedVersion(before, 'planVersion')),
    'old plan version advanced',
  ).toBe(true);
  expectSafeEqual(
    after.fingerprint,
    before.fingerprint,
    'old provisional fingerprint retained',
  );
  expectSafeEqual(
    [after.reportState, after.failureCode, after.jobId, after.planId],
    [
      'failed',
      'ATTEMPT_SUPERSEDED',
      old.report.jobId,
      old.report.migrationPlanId,
    ],
    'old report remains linked',
  );
  expectSafeEqual(
    after.finalEvidence,
    Array(11).fill(null),
    'old report remains unsealed',
  );
  expectSafeEqual(after.job, before.job, 'old BE00 claim unchanged');
  expectSafeEqual(
    originalEvent(old.report.jobId),
    oldRequest.requestedEvent,
    'old event unchanged',
  );
  expect(
    selectText(`select lease_until > clock_timestamp() from platform_private.jobs
    where id = '${old.report.jobId}'`) === 't',
    'old claim still live',
  ).toBe(true);
  expect(
    newer.report.id !== old.report.id &&
      newer.report.jobId !== old.report.jobId &&
      newer.report.migrationPlanId !== old.report.migrationPlanId,
    'new attempt IDs differ',
  ).toBe(true);
  expectSafeEqual(
    [fresh.reportState, fresh.candidateDryRunId, fresh.livePairCount],
    ['queued', newer.report.id, 1],
    'candidate points to one live replacement',
  );
  expect(
    after.definitionHash !== before.definitionHash &&
      after.artifactHash !== before.artifactHash,
    'public field edit changes both fingerprints',
  ).toBe(true);
  expectSafeEqual(
    after.definitionHash,
    after.artifactHash,
    'candidate and compiled artifact agree',
  );
};
