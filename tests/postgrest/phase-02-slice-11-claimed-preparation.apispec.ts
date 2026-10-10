/** Genuine private preparation; no receiving, ACK, or activation acceptance. */
import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from '../../apps/worker/src/content-schema-registry/migration-worker-constants';
import { MigrationPlanRecordSchema as PlanSchema } from '../../apps/worker/src/content-schema-registry/migration-worker-plan-schemas';
import { CmsSchemaDryRunClaimResponseSchema as ResponseSchema } from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-response';
import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  observeRead,
  originalEvent,
  record,
  selectJson,
  selectText,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import { storedProjection } from './support/phase-02-slice-11-claimed-dry-run-oracles';
import {
  prepareClaimedPreparationFixture,
  type PreparationCall,
  type PreparationWire,
} from './support/phase-02-slice-11-claimed-preparation-fixture';

type Fixture = Awaited<ReturnType<typeof prepareClaimedPreparationFixture>>;
const WORKER = 's11-claimed-preparation';
const equal = (actual: unknown, expected: unknown) =>
  expectSafeEqual(actual, expected, 'claimed preparation invariant');
const durable = (a: ClaimAttempt) =>
  selectJson(`with versions as (
    select id from platform_private.cms_content_type_versions
      where content_type_id = '${a.contentTypeId}'
  ), entries as (
    select id from platform_private.cms_content_entries
      where content_type_id = '${a.contentTypeId}'
  ), revisions as (
    select id from platform_private.cms_entry_revisions
      where entry_id in (select id from entries)
         or schema_version_id in (select id from versions)
  ) select jsonb_build_object(
    'first', jsonb_build_array(c.version_no, c.supersedes_id,
      (select count(*) from versions),
      (select count(*) from platform_private.cms_content_type_versions
        where content_type_id = c.content_type_id and state = 'active')),
    'empty', jsonb_build_array((select count(*) from entries),
      (select count(*) from revisions),
      (select count(*) from platform_private.cms_publication_versions
        where entry_id in (select id from entries)
           or revision_id in (select id from revisions)
           or schema_version_id in (select id from versions)),
      (select count(*) from platform_private.cms_locale_variants
        where entry_id in (select id from entries)
           or revision_id in (select id from revisions)
           or source_revision_id in (select id from revisions))),
    'candidateState', c.state, 'reportState', r.state, 'result', r.result,
    'sealedAt', r.sealed_at, 'reportDocument', r.report,
    'fingerprint', p.dry_run_report,
    'reportCounts', jsonb_build_array(r.source_count::text, r.target_count::text,
      r.row_error_count::text, r.migrated_count::text, r.failed_count::text),
    'reportHashes', jsonb_build_array(r.source_hash, r.target_hash, r.compiler_hash),
    'job', to_jsonb(j), 'event', to_jsonb(e),
    'jobVersion', j.version::text, 'jobLeaseToken', j.lease_token,
    'jobLeaseUntil', j.lease_until)::text
    from platform_private.cms_schema_dry_run_reports r
    join platform_private.cms_schema_migration_plans p on p.id = r.plan_id
    join platform_private.cms_content_type_versions c on c.id = r.target_version_id
    join platform_private.jobs j on j.id = r.job_id
    join platform_private.outbox_events e on e.id = j.originating_event_id
    where r.id = '${a.report.id}'`);

const projection = (f: Fixture) => ({
  ...storedProjection(f.attempt),
  requestedEvent: originalEvent(f.attempt.report.jobId),
});
const claimRequest = (f: Fixture) => ({
  claimedJob: {
    jobId: f.input.claimedLease.jobId,
    version: f.input.claimedLease.version,
    leaseToken: f.input.claimedLease.leaseToken,
  },
  requestedEvent: f.input.envelope,
});
const transport = (
  calls: PreparationCall[],
  wire: PreparationWire[],
  expected: ReadonlyArray<readonly [string, unknown]>,
  signal: AbortSignal,
) => {
  equal(
    calls.map(({ operation, request }) => [operation, request]),
    expected,
  );
  for (const call of calls) expect(call.signal).toBe(signal);
  equal(
    wire,
    expected.map(([operation, request]) => ({
      operation,
      body: { p_request: request },
      status: 200,
      profile: 'platform_api',
      acceptProfile: 'platform_api',
    })),
  );
};
const expectedResult = (f: Fixture) => ({
  outcome: 'completed',
  migrationPlanId: f.attempt.report.migrationPlanId,
  schemaVersionId: f.attempt.versionId,
  eventId: null,
  state: 'ready',
  cursor: '0',
  progress: 1,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched: false,
});

const seal = async (f: Fixture) => {
  const before = projection(f);
  const persistedBefore = durable(f.attempt);
  const inputBefore = structuredClone(f.input);
  const initial = ResponseSchema.parse(before);
  equal(persistedBefore.first, [1, null, 1, 0]);
  equal(persistedBefore.empty, [0, 0, 0, 0]);
  equal(
    [
      initial.plan.state,
      persistedBefore.reportState,
      persistedBefore.sealedAt,
      persistedBefore.candidateState,
    ],
    ['draft', 'queued', null, 'draft'],
  );
  expect(
    f.input.claimedLease.version !== f.input.job.version &&
      f.input.claimedLease.version !== initial.plan.version,
  ).toBe(true);
  equal(
    [persistedBefore.jobVersion, persistedBefore.jobLeaseToken],
    [f.input.claimedLease.version, f.input.claimedLease.leaseToken],
  );
  if (typeof persistedBefore.jobLeaseUntil !== 'string')
    throw new Error('Stored BE00 expiry is missing');
  equal(
    Date.parse(persistedBefore.jobLeaseUntil),
    f.input.claimedLease.leaseUntilMs,
  );
  const startedAt = Date.now();
  // Preparation mutates plan/report. Only the helper's resolver is observeRead.
  const output = await f.worker.process(f.input, {
    signal: f.signal,
    attempt: 1,
  });
  const finishedAt = Date.now();
  expect(output.kind).toBe('processed');
  if (output.kind !== 'processed')
    throw new Error('Expected processed preparation');
  equal(output.result, expectedResult(f));
  equal(output.reportId, f.attempt.report.id);
  const [read, claim, heartbeat, source, batch, finalize] = f.calls;
  if (!read || !claim || !heartbeat || !source || !batch || !finalize)
    throw new Error('Expected complete genuine preparation history');
  expect(output.claimRequest).toBe(read.request);
  equal(output.claimRequest, claimRequest(f));
  expect(Object.isFrozen(output.claimRequest)).toBe(true);
  expect(Object.isFrozen(output.claimRequest.requestedEvent)).toBe(true);
  const resolved = ResponseSchema.parse(read.response);
  equal(resolved, before);
  const acquired = record(claim.response);
  equal(acquired.acquired, true);
  const held = PlanSchema.parse(acquired.plan);
  const token = acquired.leaseToken;
  expect(typeof token === 'string' && token !== f.input.leaseToken).toBe(true);
  equal(
    [held.leaseToken, held.leaseOwner, held.state],
    [token, WORKER, 'dry_running'],
  );
  expect(BigInt(held.version) > BigInt(initial.plan.version)).toBe(true);
  const claimBody = record(claim.request);
  const heartbeatBody = record(heartbeat.request);
  for (const body of [claimBody, heartbeatBody]) {
    const instant = typeof body.now === 'string' ? Date.parse(body.now) : NaN;
    expect(
      Number.isFinite(instant) && instant >= startedAt && instant <= finishedAt,
    ).toBe(true);
  }
  const fingerprints = {
    transformKey: null,
    transformVersion: null,
    compilerHash: initial.plan.compilerHash,
    sourceHash: '0'.repeat(64),
    targetHash: initial.plan.targetHash,
  };
  const position = {
    migrationPlanId: initial.plan.id,
    expectedVersion: held.version,
    cursor: '0',
    leaseToken: token,
  };
  transport(
    f.calls,
    f.wire,
    [
      [RPC.readPlan, claimRequest(f)],
      [
        RPC.claimLease,
        {
          migrationPlanId: initial.plan.id,
          schemaVersionId: f.attempt.versionId,
          expectedVersion: initial.plan.version,
          cursor: '0',
          leaseOwner: WORKER,
          workerId: WORKER,
          leaseDurationMs: 30_000,
          now: claimBody.now,
          ...fingerprints,
        },
      ],
      [
        RPC.heartbeatLease,
        {
          ...position,
          workerId: WORKER,
          now: heartbeatBody.now,
          leaseDurationMs: 30_000,
        },
      ],
      [RPC.readSourceRows, { ...position, limit: 128 }],
      [
        RPC.processDryRunBatch,
        {
          ...position,
          schemaVersionId: f.attempt.versionId,
          limit: 128,
          rowEvidence: [],
          ...fingerprints,
          correlationId: f.input.envelope.correlationId,
          causationId: f.input.envelope.causationId,
        },
      ],
      [
        RPC.finalizeDryRun,
        {
          migrationPlanId: initial.plan.id,
          expectedVersion: held.version,
          cursor: '0',
          sourceCount: '0',
          targetCount: '0',
          rowErrorCount: '0',
          ...fingerprints,
        },
      ],
    ],
    f.signal,
  );
  equal(source.response, {
    rows: [],
    nextCursor: '0',
    done: true,
    targetFields: [],
    retiredFields: [],
  });
  equal(batch.response, {
    done: true,
    cursor: '0',
    progress: 1,
    sourceCount: '0',
    targetCount: '0',
    rowErrorCount: '0',
    migratedCount: '0',
    failedCount: '0',
  });
  const after = projection(f);
  const current = ResponseSchema.parse(after);
  equal(PlanSchema.parse(finalize.response), current.plan);
  equal(
    { ...current.plan, version: held.version, leaseExpiresAt: null },
    {
      ...initial.plan,
      state: 'ready',
      version: held.version,
      progress: 1,
      leaseExpiresAt: null,
    },
  );
  expect(BigInt(current.plan.version) > BigInt(held.version)).toBe(true);
  const persistedAfter = durable(f.attempt);
  equal(
    [persistedAfter.first, persistedAfter.empty, persistedAfter.candidateState],
    [
      persistedBefore.first,
      persistedBefore.empty,
      persistedBefore.candidateState,
    ],
  );
  equal(
    [
      persistedAfter.reportState,
      persistedAfter.result,
      persistedAfter.reportCounts,
    ],
    ['completed', 'pass', Array(5).fill('0')],
  );
  equal(persistedAfter.reportHashes, [
    fingerprints.sourceHash,
    fingerprints.targetHash,
    fingerprints.compilerHash,
  ]);
  equal(persistedAfter.reportDocument, persistedAfter.fingerprint);
  expect(
    typeof persistedAfter.sealedAt === 'string' &&
      Number.isFinite(Date.parse(persistedAfter.sealedAt)),
  ).toBe(true);
  if (
    typeof persistedAfter.sealedAt !== 'string' ||
    current.plan.leaseExpiresAt === null
  )
    throw new Error('Sealed timestamps are missing');
  equal(
    Date.parse(current.plan.leaseExpiresAt),
    Date.parse(persistedAfter.sealedAt),
  );
  equal(
    [persistedAfter.job, persistedAfter.event],
    [persistedBefore.job, persistedBefore.event],
  );
  equal(f.input, inputBefore);
  return { after, persistedAfter };
};

describe('S11 genuine private claimed preparation', () => {
  it('seals a public first-empty attempt through the actual claimed entry without activation', async () => {
    await seal(await prepareClaimedPreparationFixture());
  }, 120_000);

  it('replays the sealed READY preparation with the same live receipt using only one observed resolver', async () => {
    const f = await prepareClaimedPreparationFixture();
    const { after, persistedAfter } = await seal(f);
    expect(
      selectText(`select lease_until > clock_timestamp()
      from platform_private.jobs where id = '${f.attempt.report.jobId}'`) ===
        't',
    ).toBe(true);
    const count = f.calls.length;
    const wireCount = f.wire.length;
    const output = await observeRead(() =>
      f.worker.process(f.input, { signal: f.signal, attempt: 2 }),
    );
    expect(output.kind).toBe('processed');
    if (output.kind !== 'processed')
      throw new Error('Expected processed READY replay');
    const replay = f.calls.slice(count);
    transport(
      replay,
      f.wire.slice(wireCount),
      [[RPC.readPlan, claimRequest(f)]],
      f.signal,
    );
    expect(output.claimRequest).toBe(replay[0]?.request);
    equal(output, {
      kind: 'processed',
      claimRequest: claimRequest(f),
      reportId: f.attempt.report.id,
      result: expectedResult(f),
    });
    equal(ResponseSchema.parse(replay[0]?.response), after);
    equal(projection(f), after);
    equal(durable(f.attempt), persistedAfter);
  }, 120_000);
});
