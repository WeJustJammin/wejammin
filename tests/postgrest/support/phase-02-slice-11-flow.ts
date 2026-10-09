/**
 * Slice 11 command flows over the production Worker routes (lane S11-4R): the same
 * browser steps a console performs (workflow read -> submit -> assign -> decide), so
 * suites that start from "an approved review" never repeat the chain assertions of
 * `phase-02-slice-11-review-chain.apispec.ts`. Each step asserts only its success status.
 */
import { expect } from 'vitest';

import { expectStatus } from './phase-02-slice-11-assert';

import {
  EditorialReviewDetailResourceSchema,
  EditorialReviewResourceSchema,
  EntryWorkflowResourceSchema,
  ReviewQueuePageSchema,
} from '@wejammin/contracts';

import {
  type S11World,
  type SeededDraft,
  seedDraft,
} from './phase-02-slice-11-world';
import type { S11Actor, S11Stack } from './phase-02-slice-11-stack';

export type ReviewedDraft = Readonly<{
  entryId: string;
  revisionId: string;
  reviewId: string;
  /** The review version after the last step (the operand of 06/07/09/18). */
  reviewVersion: string;
  frozenHash: string;
  versionSet: Readonly<Record<string, unknown>>;
}>;

export const workflowPath = (entryId: string): string =>
  `/api/v1/cms/entries/${entryId}/workflow`;

/** CMS-03B-15 as the owner, parsed through the strict resource schema. */
export const readWorkflow = async (stack: S11Stack, entryId: string) => {
  const response = await stack.get(workflowPath(entryId));
  expectStatus(response, 200);
  return EntryWorkflowResourceSchema.parse(response.body);
};

/** CMS-03B-05 as the owner: freezes the preparation into an open review. */
export const submitForReview = async (
  stack: S11Stack,
  world: S11World,
  draft: SeededDraft,
  idempotencyKey?: string,
) => {
  stack.as(world.owner);
  const { preparation } = await readWorkflow(stack, draft.entryId);
  expect(preparation).not.toBeNull();
  const response = await stack.post(
    `/api/v1/cms/entries/${draft.entryId}/reviews`,
    {
      body: {
        entryId: draft.entryId,
        revisionId: draft.revisionId,
        frozenHash: preparation?.frozenHash,
        dependencyManifest: preparation?.dependencyManifest,
      },
      ifMatch: draft.entryVersion,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
  );
  expectStatus(response, 201);
  return EditorialReviewResourceSchema.parse(response.body);
};

/** CMS-03B-18 create as the owner. */
export const assignReviewer = async (
  stack: S11Stack,
  world: S11World,
  reviewId: string,
  reviewVersion: string,
  reviewer: S11Actor = world.reviewer,
) => {
  stack.as(world.owner, 'fresh');
  const response = await stack.post(
    `/api/v1/cms/reviews/${reviewId}/assignments`,
    {
      body: {
        action: 'create',
        expectedVersion: reviewVersion,
        reviewerPersonId: reviewer.personId,
        expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      },
      ifMatch: reviewVersion,
    },
  );
  expectStatus(response, 201);
  return response;
};

/** CMS-03B-06 as the assigned reviewer. */
export const decide = async (
  stack: S11Stack,
  world: S11World,
  reviewId: string,
  reviewVersion: string,
  decision: 'approve' | 'reject' = 'approve',
  reviewer: S11Actor = world.reviewer,
) => {
  stack.as(reviewer, 'fresh');
  const response = await stack.post(
    `/api/v1/cms/reviews/${reviewId}/decision`,
    {
      body: {
        reviewId,
        decision,
        reason: 'Reviewed against the policy.',
        expectedVersion: reviewVersion,
      },
      ifMatch: reviewVersion,
    },
  );
  expectStatus(response, 200);
  return EditorialReviewResourceSchema.parse(response.body);
};

/** Draft -> submitted -> assigned -> approved, entirely through the production routes. */
export const approvedDraft = async (
  stack: S11Stack,
  world: S11World,
  title: string,
  reviewer: S11Actor = world.reviewer,
): Promise<ReviewedDraft> => {
  const draft = await seedDraft(stack, world, title);
  const submitted = await submitForReview(stack, world, draft);
  await assignReviewer(
    stack,
    world,
    submitted.id,
    String(submitted.version),
    reviewer,
  );
  const approved = await decide(
    stack,
    world,
    submitted.id,
    String(submitted.version),
    'approve',
    reviewer,
  );
  stack.as(reviewer);
  const detail = await stack.get(`/api/v1/cms/reviews/${approved.id}`);
  expectStatus(detail, 200);
  const parsed = EditorialReviewDetailResourceSchema.parse(detail.body);
  return {
    entryId: draft.entryId,
    revisionId: draft.revisionId,
    reviewId: approved.id,
    reviewVersion: String(approved.version),
    frozenHash: parsed.frozen.frozenHash,
    versionSet: parsed.frozen.versionSet as Record<string, unknown>,
  };
};

/** Every CMS-03B-17 item of a scope, following the signed cursor page by page (limit 50). */
export const collectQueue = async (stack: S11Stack, query: string) => {
  const seen: ReturnType<
    typeof ReviewQueuePageSchema.parse
  >['items'][number][] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page += 1) {
    const suffix: string =
      cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
    const response = await stack.get(
      `/api/v1/cms/reviews?${query}&limit=50${suffix}`,
    );
    expectStatus(response, 200);
    const parsed = ReviewQueuePageSchema.parse(response.body);
    seen.push(...parsed.items);
    cursor = parsed.nextCursor;
    if (cursor === null) return seen;
  }
  throw new Error('the review queue did not end within 40 pages');
};
