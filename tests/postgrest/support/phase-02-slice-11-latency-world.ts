/**
 * The bounded world of the composed Slice 11 read-latency measurement: the TypeScript twin of
 * `supabase/tests/phase_02_slice_11_reads_bench128/010-fixtures.sqlinc`, committed through the real stack.
 *
 *   CMS-03B-15  `draft`     an entry whose current draft carries 128 values: the full preparation and its 17-result preflight
 *               `bounds`    an entry with an open review, 20 schedules and 70 publication rows (16 and 64 are returned)
 *   CMS-03B-16  `detail`    a review of 8 required decisions, 7 recorded, 16 active and 20 revoked assignments (32 returned)
 *   CMS-03B-17  `queue`     501 reviews assigned to the reviewer among 503 in all; the page is the maximum 50 and has a cursor
 *
 * The open reviews are submitted and assigned through the production routes (so each carries the REAL manifest of its
 * revision); the bounded populations around them are row images, because no command reaches 20 schedules in a past
 * state or 500 invalidated reviews. Everything is written under the shared owner's organization with fresh people, so no
 * other Slice 11 suite sees it in a scope it reads. Commits fixtures; run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { assignReviewer, submitForReview } from './phase-02-slice-11-flow';
import {
  LATENCY_FIELD_COUNT,
  createLatencyEntry,
  ensureLatencyType,
  type LatencyEntry,
} from './phase-02-slice-11-latency-type';
import {
  assignmentImage,
  cloneRows,
  decisionImage,
  insertImages,
  publicationImage,
  rawUpdate,
  scheduleImage,
} from './phase-02-slice-11-latency-rows';
import type { S11Actor, S11Stack } from './phase-02-slice-11-stack';
import { addMember, seedDraft, type S11World } from './phase-02-slice-11-world';
import { psql } from './stack';

const REVIEWS = 'platform_private.cms_editorial_reviews';
const ASSIGNMENTS = 'platform_private.cms_editorial_review_assignments';
const DECISIONS = 'platform_private.cms_editorial_decisions';

export const LATENCY_BOUNDS = {
  schedules: 20,
  publications: 70,
  requiredDecisions: 8,
  recordedDecisions: 7,
  activeAssignments: 16,
  revokedAssignments: 20,
  assignedQueueReviews: 200,
  otherQueueReviews: 300,
} as const;

export type LatencyWorld = Readonly<{
  /** The shared owner reads the workflow and the review detail (it is the receipt-derived owner). */
  owner: S11Actor;
  /** The reviewer whose queue holds 201 assigned reviews. */
  queueReviewer: S11Actor;
  draft: LatencyEntry;
  bounds: LatencyEntry & { reviewId: string };
  detailReviewId: string;
}>;

const iso = (offsetMs: number): string =>
  new Date(Date.now() + offsetMs).toISOString();

/** The compiled artifact of the shared type: the publication rows reference it by id, hash and version. */
const sharedArtifact = (world: S11World) => {
  const [id = '', hash = ''] = psql(`
    select id || '|' || artifact_hash from platform_private.cms_schema_artifacts
     where content_type_version_id = '${world.editorial.contentTypeVersionId}'`).split(
    '|',
  );
  return { id, hash };
};

const frozenHash = (reviewId: string): string =>
  psql(`select frozen_hash from ${REVIEWS} where id = '${reviewId}'`);

/** The detail review: 8 required decisions, 7 recorded, 16 active assignments and 20 revoked cycles. */
const buildDetailReview = async (
  stack: S11Stack,
  world: S11World,
  entry: LatencyEntry,
  reviewers: readonly S11Actor[],
): Promise<string> => {
  const review = await submitForReview(stack, world, entry);
  rawUpdate(
    REVIEWS,
    `update ${REVIEWS} set required_decision_count = ${LATENCY_BOUNDS.requiredDecisions} where id = '${review.id}'`,
  );
  const org = world.organizationId;
  const grantor = world.owner.personId;
  const cycler = reviewers[LATENCY_BOUNDS.activeAssignments];
  if (cycler === undefined)
    throw new Error('the latency world needs 17 reviewers');
  insertImages(
    ASSIGNMENTS,
    Array.from({ length: LATENCY_BOUNDS.revokedAssignments }, (_, index) =>
      assignmentImage({
        organizationId: org,
        reviewId: review.id,
        reviewerPersonId: cycler.personId,
        grantorPersonId: grantor,
        state: 'revoked',
        createdAt: new Date(
          Date.parse('2026-10-02T11:00:00Z') + (index + 1) * 1000,
        ).toISOString(),
        startsAt: '2026-10-02T11:00:00Z',
        endsAt: '2026-10-03T11:00:00Z',
      }),
    ),
  );
  const active = reviewers
    .slice(0, LATENCY_BOUNDS.activeAssignments)
    .map((reviewer) => ({
      reviewer,
      image: assignmentImage({
        organizationId: org,
        reviewId: review.id,
        reviewerPersonId: reviewer.personId,
        grantorPersonId: grantor,
        createdAt: iso(-3_600_000),
        startsAt: iso(-3_600_000),
        endsAt: iso(23 * 3_600_000),
      }),
    }));
  insertImages(
    ASSIGNMENTS,
    active.map(({ image }) => image),
  );
  const reviewedHash = frozenHash(review.id);
  insertImages(
    DECISIONS,
    active
      .slice(0, LATENCY_BOUNDS.recordedDecisions)
      .map(({ reviewer, image }) =>
        decisionImage({
          organizationId: org,
          reviewId: review.id,
          reviewerPersonId: reviewer.personId,
          assignmentId: String(image.id),
          reviewedHash,
          decidedAt: iso(-1_800_000),
        }),
      ),
  );
  rawUpdate(
    REVIEWS,
    `update ${REVIEWS} set recorded_decision_count = ${LATENCY_BOUNDS.recordedDecisions} where id = '${review.id}'`,
  );
  return review.id;
};

/** 500 invalidated clones of the template review: 200 assigned to the queue reviewer, 300 submitted by someone else. */
const buildQueue = async (
  stack: S11Stack,
  world: S11World,
  entry: LatencyEntry,
  queueReviewer: S11Actor,
  otherSubmitter: S11Actor,
): Promise<void> => {
  const template = await submitForReview(stack, world, entry);
  const clones = (count: number, submittedBy: string, baseIso: string) =>
    Array.from({ length: count }, (_, index) => ({
      id: randomUUID(),
      state: 'invalidated',
      version: 2,
      recorded_decision_count: 0,
      invalidated_reason: 'dependency_changed',
      decided_at: null,
      submitted_by: submittedBy,
      updated_at: new Date(
        Date.parse(baseIso) + (index + 1) * 1000,
      ).toISOString(),
    }));
  const assigned = clones(
    LATENCY_BOUNDS.assignedQueueReviews,
    world.owner.personId,
    '2026-10-08T13:00:00Z',
  );
  cloneRows(REVIEWS, template.id, assigned);
  insertImages(
    ASSIGNMENTS,
    assigned.map((clone) =>
      assignmentImage({
        organizationId: world.organizationId,
        reviewId: clone.id,
        reviewerPersonId: queueReviewer.personId,
        grantorPersonId: world.owner.personId,
        createdAt: iso(-3_600_000),
        startsAt: iso(-3_600_000),
        endsAt: iso(23 * 3_600_000),
      }),
    ),
  );
  cloneRows(
    REVIEWS,
    template.id,
    clones(
      LATENCY_BOUNDS.otherQueueReviews,
      otherSubmitter.personId,
      '2026-10-08T12:30:00Z',
    ),
  );
};

export const buildLatencyWorld = async (
  stack: S11Stack,
  world: S11World,
): Promise<LatencyWorld> => {
  // The preparation needs the organization's stored publication-settings snapshot (DEC-163), which the first real entry
  // save writes: one production CMS-03B-10 create, as every Slice 11 world has before it reads a workflow.
  await seedDraft(stack, world, 'Latency world settings snapshot');
  const type = await ensureLatencyType(world);
  const org = world.organizationId;
  const queueReviewer = addMember(org, world.owner.personId, ['cms.reviewer']);
  const reviewers = Array.from(
    { length: LATENCY_BOUNDS.activeAssignments + 1 },
    () => addMember(org, world.owner.personId, ['cms.reviewer']),
  );
  const draft = createLatencyEntry(world, type);
  const boundsEntry = createLatencyEntry(world, type);
  const detailEntry = createLatencyEntry(world, type);
  const queueEntry = createLatencyEntry(world, type);

  stack.as(world.owner);
  const boundsReview = await submitForReview(stack, world, boundsEntry);
  await assignReviewer(
    stack,
    world,
    boundsReview.id,
    String(boundsReview.version),
    queueReviewer,
  );
  const artifact = sharedArtifact(world);
  insertImages(
    'platform_private.cms_publication_schedules',
    Array.from({ length: LATENCY_BOUNDS.schedules }, (_, index) =>
      scheduleImage({
        organizationId: org,
        entryId: boundsEntry.entryId,
        revisionId: boundsEntry.revisionId,
        reviewId: boundsReview.id,
        createdBy: world.owner.personId,
        n: index + 1,
      }),
    ),
  );
  insertImages(
    'platform_private.cms_publication_versions',
    Array.from({ length: LATENCY_BOUNDS.publications }, (_, index) =>
      publicationImage({
        organizationId: org,
        entryId: boundsEntry.entryId,
        revisionId: boundsEntry.revisionId,
        publisherPersonId: world.owner.personId,
        schemaVersionId: world.editorial.contentTypeVersionId,
        artifactId: artifact.id,
        artifactHash: artifact.hash,
        n: index + 1,
      }),
    ),
  );
  const detailReviewId = await buildDetailReview(
    stack,
    world,
    detailEntry,
    reviewers,
  );
  const otherSubmitter = reviewers[4];
  if (otherSubmitter === undefined)
    throw new Error('the latency world needs reviewers');
  await buildQueue(stack, world, queueEntry, queueReviewer, otherSubmitter);

  // The planner works from the statistics a database that has lived with these rows has: refresh them once.
  psql(`analyze platform_private.cms_content_entries, platform_private.cms_entry_revisions,
          platform_private.cms_entry_field_values, platform_private.cms_entry_assignments,
          ${REVIEWS}, ${ASSIGNMENTS}, ${DECISIONS},
          platform_private.cms_publication_schedules, platform_private.cms_publication_versions,
          platform_private.cms_editorial_review_dependencies`);
  return {
    owner: world.owner,
    queueReviewer,
    draft,
    bounds: { ...boundsEntry, reviewId: boundsReview.id },
    detailReviewId,
  };
};

export { LATENCY_FIELD_COUNT };
