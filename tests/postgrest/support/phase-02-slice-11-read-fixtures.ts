/**
 * Shared refusal fixtures for the Slice 11 read/command-refusal suites (lane
 * S11-4R read families). Extracted from the inherited `review-refusals` suite so
 * the feature-split files reuse one definition instead of duplicating it. Every
 * helper is parameterised on the caller's `stack`/`world` so each focused file
 * keeps its own isolated fixtures.
 */
import { EditorialReviewAssignmentResourceSchema } from '@wejammin/contracts';
import { expectStatus } from './phase-02-slice-11-assert';
import {
  approvedDraft,
  assignReviewer,
  readWorkflow,
  submitForReview,
} from './phase-02-slice-11-flow';
import type { S11Stack } from './phase-02-slice-11-stack';
import { addMember, seedDraft, type S11World } from './phase-02-slice-11-world';
import { psql } from './stack';

/**
 * The CMS-03B-05 submit body built from the live preparation read, as the owner.
 */
export const s11SubmitBody = async (
  stack: S11Stack,
  world: S11World,
  entryId: string,
  revisionId: string,
) => {
  stack.as(world.owner);
  const { preparation } = await readWorkflow(stack, entryId);
  return {
    entryId,
    revisionId,
    frozenHash: preparation?.frozenHash,
    dependencyManifest: preparation?.dependencyManifest,
  };
};

/** POST one CMS-03B-05 submission under the strong entry `If-Match`. */
export const s11Submit = (
  stack: S11Stack,
  entryId: string,
  body: unknown,
  ifMatch: string,
  idempotencyKey?: string,
) =>
  stack.post(`/api/v1/cms/entries/${entryId}/reviews`, {
    body,
    ifMatch,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });

/**
 * Fixture drift of a frozen manifest (what the real invalidation job detects):
 * the stored manifest no longer equals the rebuilt one, so a decision on it is
 * the COMMITTED `dependency_changed` refusal. Guarded rows are only touched
 * inside the CMS RPC context with the review triggers disabled, exactly as the
 * pgTAP fixtures do.
 */
export const s11DriftFrozenManifest = (reviewId: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table platform_private.cms_editorial_reviews disable trigger user;
    update platform_private.cms_editorial_reviews
       set dependency_manifest = jsonb_set(dependency_manifest, '{checker,version}', '"2"'),
           dependency_hash = platform_private.cms_jcs_sha256(
             jsonb_set(dependency_manifest, '{checker,version}', '"2"'))
     where id = '${reviewId}';
    alter table platform_private.cms_editorial_reviews enable trigger user;
    commit;`);
};

/** The owner party of one entry (derived from the actual row, not assumed). */
export const s11EntryOwnerPartyId = (entryId: string): string =>
  psql(
    `select owner_party_id from platform_private.cms_content_entries where id = '${entryId}'`,
  );

/**
 * The number of stored publication-settings snapshots for ONE owner party, via a
 * read-only count SELECT. Narrowed to the fresh entry's owner so a snapshot another
 * owner holds can never mask a per-owner read effect.
 */
export const s11OwnerSettingsSnapshotCount = (ownerPartyId: string): number =>
  Number(
    psql(
      `select count(*) from platform_private.cms_publication_settings_snapshots where owner_id = '${ownerPartyId}'`,
    ),
  );

/**
 * Fresh submitter and reviewer, canonical receipt owner for assignments. Expected
 * membership comes from commands this fixture issues, never a query of the queue
 * producer's tables. The author owns no receipt and gains only authoring scope.
 */
export const s11QueueFixture = async (stack: S11Stack, world: S11World) => {
  const submitter = addMember(world.organizationId, world.owner.personId, [
    'cms.author',
    'cms.editor',
  ]);
  const authoredWorld = { ...world, owner: submitter };
  const approved = [];
  for (const title of ['Queue one', 'Queue two']) {
    const draft = await seedDraft(stack, authoredWorld, title);
    const review = await submitForReview(stack, authoredWorld, draft);
    await assignReviewer(stack, world, review.id, String(review.version));
    stack.as(world.reviewer, 'fresh');
    const decided = await stack.post(
      `/api/v1/cms/reviews/${review.id}/decision`,
      {
        body: {
          reviewId: review.id,
          decision: 'approve',
          reason: 'Queue fixture approval.',
          expectedVersion: String(review.version),
        },
        ifMatch: String(review.version),
      },
    );
    expectStatus(decided, 200);
    approved.push({ reviewId: review.id, entryId: draft.entryId });
  }
  const unassignedDraft = await seedDraft(
    stack,
    authoredWorld,
    'Unassigned queue exclusion',
  );
  const unassigned = await submitForReview(
    stack,
    authoredWorld,
    unassignedDraft,
  );
  const revokedDraft = await seedDraft(
    stack,
    authoredWorld,
    'Revoked queue exclusion',
  );
  const revoked = await submitForReview(stack, authoredWorld, revokedDraft);
  const assigned = await assignReviewer(
    stack,
    world,
    revoked.id,
    String(revoked.version),
  );
  const assignment = EditorialReviewAssignmentResourceSchema.parse(
    assigned.body,
  );
  const revoke = await stack.post(
    `/api/v1/cms/reviews/${revoked.id}/assignments`,
    {
      body: {
        action: 'revoke',
        expectedVersion: String(revoked.version),
        assignmentId: assignment.id,
      },
      ifMatch: String(revoked.version),
    },
  );
  expectStatus(revoke, 200);
  const foreign = await approvedDraft(
    stack,
    world,
    'Other submitter exclusion',
    world.reviewer2,
  );
  return {
    submitter,
    approved,
    submittedIds: [
      ...approved.map((review) => review.reviewId),
      unassigned.id,
      revoked.id,
    ],
    assignedIds: approved.map((review) => review.reviewId),
    openIds: [unassigned.id, revoked.id],
    assignedExclusions: [unassigned.id, revoked.id, foreign.reviewId],
    submittedExclusions: [foreign.reviewId],
  };
};
