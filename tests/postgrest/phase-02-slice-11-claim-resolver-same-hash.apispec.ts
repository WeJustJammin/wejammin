/** Same-graph public attempts: supersession must not rely on changed hashes. */
import { describe, expect, it } from 'vitest';

import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  candidateVersion,
  claimAttempt,
  originalEvent,
  prepareClaimAttempt,
  record,
  resolveClaim,
  selectJson,
  selectText,
  startAttempt,
  storedVersion,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  accepted,
  attemptState,
  refusal,
} from './support/phase-02-slice-11-claimed-dry-run-oracles';

const schemaState = (attempt: ClaimAttempt) =>
  selectJson(`select jsonb_build_object(
    'candidateVersion', c.version::text, 'reportVersion', r.version::text,
    'supersededAt', p.superseded_at,
    'unchanged', jsonb_build_object(
      'candidate', to_jsonb(c) - 'version' - 'updated_at' - 'dry_run_id',
      'contentType', to_jsonb(t), 'source', to_jsonb(s), 'artifact', to_jsonb(a),
      'sourceVersionId', p.from_version_id, 'targetVersionId', p.to_version_id,
      'classification', p.classification, 'transformKey', p.transform_key,
      'transformVersion', p.transform_version::text,
      'reportClassification', r.classification, 'reportTransformKey', r.transform_key,
      'reportTransformVersion', r.transform_version::text,
      'reportCompilerVersion', r.compiler_version),
    'compilerVersion', a.compiler_version,
    'transformHash', platform_private.cms_migration_transform_hash(
      p.classification, p.transform_key, p.transform_version,
      coalesce(s.definition_hash, repeat('0', 64)), c.definition_hash,
      a.artifact_hash, a.compiler_version))::text
    from platform_private.cms_schema_dry_run_reports r
    join platform_private.cms_schema_migration_plans p on p.id = r.plan_id
    join platform_private.cms_content_type_versions c on c.id = p.to_version_id
    join platform_private.cms_content_types t on t.id = c.content_type_id
    join platform_private.cms_schema_artifacts a on a.id = c.schema_artifact_id
    left join platform_private.cms_content_type_versions s on s.id = p.from_version_id
    where r.id = '${attempt.report.id}'`);

describe('S11 claimed resolver same-hash current attempt', () => {
  it('refuses the unchanged live old claim after a same-hash public repeat and accepts the new actual claim', async () => {
    const old = await prepareClaimAttempt();
    const oldRequest = await claimAttempt(old);
    const baseline = await accepted(old, oldRequest);
    const before = attemptState(old);
    const schemaBefore = schemaState(old);
    const oldEvent = originalEvent(old.report.jobId);
    const unchanged = record(schemaBefore.unchanged);
    expectSafeEqual(
      [
        before.planState,
        before.superseded,
        before.reportState,
        schemaBefore.supersededAt,
      ],
      ['draft', false, 'queued', null],
      'original plan is a current unsealed draft',
    );
    expectSafeEqual(
      [
        baseline.plan.classification,
        baseline.plan.transformKey,
        baseline.plan.transformVersion,
      ],
      ['additive', null, null],
      'same-hash fixture has the actual additive null transform pair',
    );
    expectSafeEqual(
      [
        unchanged.classification,
        unchanged.transformKey,
        unchanged.transformVersion,
        unchanged.reportClassification,
        unchanged.reportTransformKey,
        unchanged.reportTransformVersion,
        unchanged.reportCompilerVersion,
      ],
      [
        'additive',
        null,
        null,
        'additive',
        null,
        null,
        schemaBefore.compilerVersion,
      ],
      'stored plan report classification transform and compiler bindings',
    );
    expectSafeEqual(
      before.fingerprint,
      {
        dryRunId: old.report.id,
        result: 'pass',
        sourceHash: baseline.plan.sourceHash,
        targetHash: baseline.plan.targetHash,
        compilerHash: baseline.plan.compilerHash,
        compilerVersion: schemaBefore.compilerVersion,
        transformHash: schemaBefore.transformHash,
        sourceCount: baseline.plan.sourceCount,
        targetCount: baseline.plan.targetCount,
        rowErrorCount: baseline.plan.rowErrorCount,
        migratedCount: baseline.plan.migratedCount,
        failedCount: baseline.plan.failedCount,
      },
      'whole original provisional fingerprint matches canonical bindings',
    );
    expectSafeEqual(
      [
        baseline.plan.cursor,
        baseline.plan.sourceCount,
        baseline.plan.targetCount,
        baseline.plan.rowErrorCount,
        baseline.plan.migratedCount,
        baseline.plan.failedCount,
      ],
      Array(6).fill('0'),
      'genuine first-empty provisional counters',
    );
    expectSafeEqual(
      oldEvent,
      oldRequest.requestedEvent,
      'original event baseline',
    );

    const version = await candidateVersion(old.designer, old.path);
    expectSafeEqual(
      version,
      storedVersion(schemaBefore, 'candidateVersion'),
      'repeat uses the actual current candidate CAS version',
    );
    // startAttempt supplies a fresh idempotency key and the same expectedVersion
    // in If-Match/body. No field edit or separate compile command intervenes.
    const newer: ClaimAttempt = {
      ...old,
      ...(await startAttempt(old.designer, old.path, version)),
    };
    const after = attemptState(old);
    const fresh = attemptState(newer);
    const schemaAfter = schemaState(old);
    const schemaFresh = schemaState(newer);
    expectSafeEqual(
      [schemaAfter.unchanged, schemaFresh.unchanged],
      [schemaBefore.unchanged, schemaBefore.unchanged],
      'same candidate type source target and whole artifact identity/content',
    );
    expectSafeEqual(
      [
        before.definitionHash,
        after.definitionHash,
        fresh.definitionHash,
        before.artifactHash,
        after.artifactHash,
        fresh.artifactHash,
      ],
      Array(6).fill(baseline.plan.compilerHash),
      'all cached candidate and artifact hashes equal and unchanged',
    );
    expectSafeEqual(
      after.fingerprint,
      before.fingerprint,
      'whole old fingerprint unchanged',
    );
    expectSafeEqual(
      fresh.fingerprint,
      { ...record(before.fingerprint), dryRunId: newer.report.id },
      'new fingerprint differs only in dryRunId',
    );
    expectSafeEqual(
      [schemaFresh.compilerVersion, schemaFresh.transformHash],
      [schemaBefore.compilerVersion, schemaBefore.transformHash],
      'same compiler version and recomputed transform fingerprint',
    );
    expectSafeEqual(
      [
        after.planState,
        after.superseded,
        after.reportState,
        after.failureCode,
        after.jobId,
        after.planId,
      ],
      [
        'draft',
        true,
        'failed',
        'ATTEMPT_SUPERSEDED',
        old.report.jobId,
        old.report.migrationPlanId,
      ],
      'old draft is superseded and failed report retains its links',
    );
    expect(
      typeof schemaAfter.supersededAt === 'string' &&
        BigInt(storedVersion(after, 'planVersion')) >
          BigInt(storedVersion(before, 'planVersion')) &&
        BigInt(storedVersion(schemaAfter, 'reportVersion')) >
          BigInt(storedVersion(schemaBefore, 'reportVersion')) &&
        BigInt(storedVersion(schemaAfter, 'candidateVersion')) >
          BigInt(version),
      'real supersession timestamp and plan report candidate version advances',
    ).toBe(true);
    expectSafeEqual(
      after.finalEvidence,
      Array(11).fill(null),
      'old failed report remains unsealed',
    );
    expectSafeEqual(
      fresh.finalEvidence,
      Array(11).fill(null),
      'new queued report remains unsealed',
    );
    expect(
      newer.report.id !== old.report.id &&
        newer.report.migrationPlanId !== old.report.migrationPlanId &&
        newer.report.jobId !== old.report.jobId,
      'public repeat creates distinct report plan and job identities',
    ).toBe(true);
    expectSafeEqual(
      [
        after.candidateDryRunId,
        fresh.candidateDryRunId,
        fresh.reportState,
        fresh.planState,
        fresh.superseded,
        schemaFresh.supersededAt,
        after.livePairCount,
        fresh.livePairCount,
      ],
      [newer.report.id, newer.report.id, 'queued', 'draft', false, null, 1, 1],
      'candidate points to exactly one current same-pair replacement',
    );
    expectSafeEqual(
      after.job,
      before.job,
      'old whole BE00 job remains unchanged',
    );
    expectSafeEqual(
      originalEvent(old.report.jobId),
      oldEvent,
      'old original eight-field event remains unchanged',
    );
    expect(
      selectText(`select state = 'running'
        and version::text = '${oldRequest.claimedJob.version}'
        and lease_token = '${oldRequest.claimedJob.leaseToken}'::uuid
        and lease_until > clock_timestamp()
        from platform_private.jobs where id = '${oldRequest.claimedJob.jobId}'`) ===
        't',
      'old actual receipt version and UUID token still hold an unexpired lease',
    ).toBe(true);
    // Both old/new resolver reads retain the existing fourteen/thirteen-table
    // observers. Only current-attempt identity changed; hashes and claim did not.
    refusal(await resolveClaim(oldRequest), 'CONFLICT', 400, 'P0001');
    const newRequest = await claimAttempt(newer);
    await accepted(newer, newRequest);
  }, 120_000);
});
