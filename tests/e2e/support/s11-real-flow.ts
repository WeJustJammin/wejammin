/**
 * Preconditions of the Slice 11 real-route specs, made through the same chain
 * the browser uses (web proxy -> private binding -> production Worker ->
 * production RPC adapter -> Kong -> PostgREST -> SQL). Nothing is seeded by a
 * direct write.
 */
import type { S10Client, SeededEntry } from './s10-real-api';

export type WorkflowView = Readonly<{
  status: number;
  etag: string;
  entryVersion: string;
  revisionId: string;
  reviewId: string | null;
  reviewVersion: string | null;
  reviewState: string | null;
  permitted: readonly string[];
  body: Record<string, unknown>;
  text: string;
}>;

export const workflowPath = (entryId: string): string =>
  `/api/v1/cms/entries/${entryId}/workflow`;

/** CMS-03B-15 as a caller: the canonical operands every command needs. */
export const readWorkflow = async (
  client: S10Client,
  entryId: string,
): Promise<WorkflowView> => {
  const result = await client.get(workflowPath(entryId));
  const entry = (result.body.entry ?? {}) as { version?: string };
  const revision = (result.body.revision ?? {}) as { id?: string };
  const review = (result.body.review ?? null) as {
    id: string;
    version: string;
    state: string;
  } | null;
  return {
    status: result.status,
    etag: result.headers.etag ?? '',
    entryVersion: String(entry.version ?? ''),
    revisionId: String(revision.id ?? ''),
    reviewId: review?.id ?? null,
    reviewVersion: review?.version ?? null,
    reviewState: review?.state ?? null,
    permitted: (result.body.permittedNextActions ?? []) as string[],
    body: result.body,
    text: result.text,
  };
};

/** CMS-03B-05 through the first-party route; returns the open review. */
export const submitReviewViaApi = async (
  client: S10Client,
  entry: SeededEntry,
): Promise<{ reviewId: string; reviewVersion: string }> => {
  const view = await readWorkflow(client, entry.entryId);
  if (view.status !== 200)
    throw new Error(`CMS-03B-15 refused: ${view.status} ${view.text}`);
  const preparation = view.body.preparation as {
    frozenHash: string;
    dependencyManifest: unknown;
  } | null;
  if (preparation === null)
    throw new Error('The workflow read offers no submit preparation.');
  const submitted = await client.post(
    `/api/v1/cms/entries/${entry.entryId}/reviews`,
    {
      entryId: entry.entryId,
      revisionId: view.revisionId,
      frozenHash: preparation.frozenHash,
      dependencyManifest: preparation.dependencyManifest,
    },
    { ifMatch: view.entryVersion },
  );
  if (submitted.status !== 201)
    throw new Error(
      `CMS-03B-05 refused: ${submitted.status} ${submitted.text}`,
    );
  return {
    reviewId: String(submitted.body.id),
    reviewVersion: String(submitted.body.version),
  };
};

/** CMS-03B-18 create (owner, fresh step-up). */
export const assignReviewerViaApi = async (
  owner: S10Client,
  review: { reviewId: string; reviewVersion: string },
  reviewerPersonId: string,
): Promise<{ status: number; text: string }> => {
  const expiresAt = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
  const assigned = await owner.post(
    `/api/v1/cms/reviews/${review.reviewId}/assignments`,
    {
      action: 'create',
      reviewerPersonId,
      expiresAt,
      expectedVersion: review.reviewVersion,
    },
    { ifMatch: review.reviewVersion },
  );
  return { status: assigned.status, text: assigned.text };
};

/** CMS-03B-06 approve (reviewer, fresh step-up). */
export const approveViaApi = async (
  reviewer: S10Client,
  review: { reviewId: string; reviewVersion: string },
): Promise<{ status: number; text: string; version: string }> => {
  const decided = await reviewer.post(
    `/api/v1/cms/reviews/${review.reviewId}/decision`,
    {
      reviewId: review.reviewId,
      decision: 'approve',
      reason: 'Approved for publication.',
      expectedVersion: review.reviewVersion,
    },
    { ifMatch: review.reviewVersion },
  );
  return {
    status: decided.status,
    text: decided.text,
    version: String(decided.body.version ?? ''),
  };
};
