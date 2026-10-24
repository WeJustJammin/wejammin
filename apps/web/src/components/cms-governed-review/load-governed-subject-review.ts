import {
  GovernedReviewQueuePageSchema,
  type GovernedReviewState,
  type GovernedSubjectKind,
} from '@wejammin/contracts';

import type { CmsGovernedPageReads } from './governed-review-page-reads';

/** The few facts of a subject version's review the definition panel shows (FE03 :877). */
export interface GovernedPanelReview {
  readonly reviewId: string;
  readonly state: GovernedReviewState;
  readonly requiredDecisionCount: number;
  readonly recordedDecisionCount: number;
}

export interface GovernedSubjectRef {
  readonly kind: GovernedSubjectKind;
  readonly key: string;
  readonly version: number;
}

/** 50 rows a page, so the panel looks through at most the 200 newest owned reviews. */
export const GOVERNED_SUBJECT_REVIEW_MAX_PAGES = 4;
const PAGE_SIZE = 50;
const QUEUE_PATH = '/api/v1/cms/governed-reviews';

const queueRequest = (
  request: Request,
  kind: GovernedSubjectKind,
  cursor: string | null,
): Request => {
  const query = new URLSearchParams({
    scope: 'owned',
    subjectKind: kind,
    limit: String(PAGE_SIZE),
  });
  if (cursor !== null) query.set('cursor', cursor);
  // Only the session headers of the page request: its URL-owned state never leaks into this read.
  return new Request(new URL(`${QUEUE_PATH}?${query}`, request.url), {
    method: 'GET',
    headers: request.headers,
  });
};

/**
 * Resolves the review of one subject version for a definition page (FE03 :877,
 * :1066: the panel shows its review summary and links to the review itself, also
 * after a reload). The owned queue (CMS-03C-11, newest first) is searched for the
 * row naming exactly this kind, key and version. It is a best-effort enrichment:
 * a refused, expired, malformed, unreachable or exhausted read yields null and
 * the panel falls back to its link to the owned queue, never to a guess.
 */
export const loadGovernedSubjectReview = async (input: {
  readonly request: Request;
  readonly reads: CmsGovernedPageReads;
  readonly subject: GovernedSubjectRef;
}): Promise<GovernedPanelReview | null> => {
  const { request, reads, subject } = input;
  let cursor: string | null = null;
  try {
    for (let pages = 0; pages < GOVERNED_SUBJECT_REVIEW_MAX_PAGES; pages += 1) {
      const response = await reads.reviewQueue(
        queueRequest(request, subject.kind, cursor),
      );
      if (response.status !== 200) return null;
      const parsed = GovernedReviewQueuePageSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) return null;
      const match = parsed.data.items.find(
        (item) =>
          item.subjectKind === subject.kind &&
          item.subjectKey === subject.key &&
          item.subjectVersion === subject.version,
      );
      if (match !== undefined)
        return {
          reviewId: match.reviewId,
          state: match.state,
          requiredDecisionCount: match.requiredDecisionCount,
          recordedDecisionCount: match.recordedDecisionCount,
        };
      if (parsed.data.nextCursor === null) return null;
      cursor = parsed.data.nextCursor;
    }
  } catch {
    return null;
  }
  return null;
};
