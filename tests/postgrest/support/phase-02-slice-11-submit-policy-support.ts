/** Frozen-policy persistence assertions; shared fixture authority remains outside this proof. */
import { expect } from 'vitest';
import { EditorialReviewResourceSchema } from '@wejammin/contracts';
import { expectSafeEqual } from './phase-02-slice-11-assert';
import type { submitFixture } from './phase-02-slice-11-submit-support';
import type { S11World } from './phase-02-slice-11-world';
import { psql } from './stack';

/** Canonical DB JSON is compared privately; assertion output contains only digests. */
export const expectFrozenSubmission = (
  fixture: Awaited<ReturnType<typeof submitFixture>>,
  review: ReturnType<typeof EditorialReviewResourceSchema.parse>,
): void => {
  const { draft, preparation } = fixture;
  expectSafeEqual(
    {
      entryId: review.entryId,
      revisionId: review.revisionId,
      frozenHash: review.frozenHash,
      dependencyHash: review.dependencyHash,
      workflowPolicy: review.workflowPolicy,
      activationEvidence: review.activationEvidence,
    },
    {
      entryId: draft.entryId,
      revisionId: draft.revisionId,
      frozenHash: preparation.frozenHash,
      dependencyHash: preparation.dependencyHash,
      workflowPolicy: preparation.dependencyManifest.schema.workflowPolicy,
      activationEvidence:
        preparation.dependencyManifest.schema.activationEvidence,
    },
    'frozen browser resource preserves all policy and hash evidence',
  );
  const persisted = JSON.parse(
    psql(`begin;
    select set_config('app.cms_rpc', 'true', true) \\gset
    select jsonb_build_object(
    'manifest', r.dependency_manifest, 'hash', r.frozen_hash,
    'dependencyHash', r.dependency_hash,
    'versionSet', platform_private.cms_revision_version_set(r.revision_id, r.dependency_manifest))
    from platform_private.cms_editorial_reviews r where r.id = '${review.id}'; rollback;`),
  ) as unknown;
  expectSafeEqual(
    persisted,
    {
      manifest: preparation.dependencyManifest,
      hash: preparation.frozenHash,
      dependencyHash: preparation.dependencyHash,
      versionSet: preparation.versionSet,
    },
    'persisted frozen manifest and rebuilt version set',
  );
  // Minimal shared fixture has exactly schema + settings; no helper-derived expected index.
  expectSafeEqual(
    preparation.dependencyManifest.blocks,
    [],
    'no block reference',
  );
  expectSafeEqual(
    preparation.dependencyManifest.patterns,
    [],
    'no pattern reference',
  );
  expectSafeEqual(
    preparation.dependencyManifest.terms,
    [],
    'no term reference',
  );
  const indexValid = psql(`select count(*) = 2 and bool_and(
    (d.kind = 'schema' and d.ref_id = '${preparation.dependencyManifest.schema.id}') or
    (d.kind = 'settings' and exists (select 1
      from platform_private.cms_publication_settings_snapshots s
      where s.id = d.ref_id and s.owner_id = r.owner_id
      and s.ordinal::text = r.dependency_manifest->'settings'->>'version'
      and s.snapshot_hash = r.dependency_manifest->'settings'->>'hash')))
    from platform_private.cms_editorial_review_dependencies d
    join platform_private.cms_editorial_reviews r on r.id = d.review_id
    where d.review_id = '${review.id}'`);
  expect(indexValid, 'exact nonempty dependency index').toBe('t');
};

export const expectSubmissionEvidence = (
  fixture: Awaited<ReturnType<typeof submitFixture>>,
  review: ReturnType<typeof EditorialReviewResourceSchema.parse>,
  world: S11World,
  correlationId: string,
  firstEvidence: unknown,
): void => {
  const summary = JSON.parse(
    psql(`select jsonb_build_object(
    'checkerKey', e.checker_key, 'checkerVersion', e.checker_version::text,
    'outcome', e.outcome, 'blockingCount', e.blocking_count, 'inputHash', e.input_hash)
    from platform_private.cms_command_accessibility_evidence e
    where e.operation_id = 'CMS-03B-05' and e.subject_id = '${review.id}'`),
  ) as unknown;
  const evidence = firstEvidence as Record<string, unknown>;
  expectSafeEqual(
    summary,
    {
      checkerKey: evidence.providerKey,
      checkerVersion: evidence.providerVersion,
      outcome: evidence.outcome,
      blockingCount: evidence.blockingCount,
      inputHash: evidence.inputHash,
    },
    'persisted accessibility summary exactly binds the real server evidence',
  );
  expect(
    psql(`select count(*) = 1 and bool_and(
    e.revision_id = '${fixture.draft.revisionId}' and e.correlation_id = '${correlationId}'
    and o.event_type = 'cms.entry.review-changed.v1' and o.aggregate_type = 'cms_editorial_review'
    and o.aggregate_id = '${review.id}' and o.aggregate_version = 1 and o.schema_version = 1
    and o.correlation_id = e.correlation_id
    and o.payload = jsonb_build_object('reviewId', '${review.id}'::text, 'revisionId', '${fixture.draft.revisionId}'::text)
    and a.action = 'cms.editorial.review.submit' and a.actor_id = '${world.owner.authUserId}'
    and a.acting_party_id = '${world.organizationId}' and a.target_id = '${review.id}'
    and a.target_type = 'cms_editorial_review' and a.decision = 'allowed'
    and a.reason_code = 'CMS_EDITORIAL_REVIEW_SUBMITTED')
    from platform_private.cms_command_accessibility_evidence e
    join platform_private.outbox_events o on o.id = e.outbox_event_id
    join audit_private.audit_events a on a.id = e.audit_event_id
    where e.subject_id = '${review.id}' and e.operation_id = 'CMS-03B-05'`),
    'one exact review event and audit joined to accessibility evidence',
  ).toBe('t');
};
