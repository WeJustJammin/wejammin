import { describe, expect, it } from 'vitest';

import {
  instant,
  isRefused,
  issuePaths,
  laterInstant,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  GovernedReviewQueueApiRequestSchema,
  GovernedReviewQueueItemSchema,
  GovernedReviewQueuePageSchema,
  GovernedReviewQueueQuerySchema,
} from './governed-review-read';

const item = {
  reviewId: uid(70),
  subjectKind: 'pattern_version',
  subjectKey: 'hero-banner',
  subjectVersion: 4,
  state: 'open',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  myDecision: 'none',
  assignmentEndsAt: null,
  submittedAt: instant,
  updatedAt: laterInstant,
} as const;

describe('CMS-03C-11 governed review queue contract', () => {
  it('[P2-S12-AC-095] defaults scope to assigned and limit to 25 and accepts only the allowlisted query keys', () => {
    expect(GovernedReviewQueueQuerySchema.parse({})).toEqual({
      limit: 25,
      scope: 'assigned',
    });
    const full = {
      cursor: 'opaque',
      limit: 50,
      scope: 'owned',
      state: 'approved',
      subjectKind: 'taxonomy_version',
    };
    expect(GovernedReviewQueueQuerySchema.parse(full)).toEqual(full);
    expect(
      GovernedReviewQueueQuerySchema.safeParse({ cursor: null }).success,
    ).toBe(true);
    for (const scope of ['assigned', 'submitted', 'owned'])
      expect(GovernedReviewQueueQuerySchema.safeParse({ scope }).success).toBe(
        true,
      );
  });

  it('[P2-S12-AC-095] bounds limit 1 to 50 and the cursor at 512 and closes scope, state and subject kind', () => {
    for (const limit of [1, 50])
      expect(GovernedReviewQueueQuerySchema.safeParse({ limit }).success).toBe(
        true,
      );
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { limit: '25' },
      { cursor: 'c'.repeat(513) },
      { scope: 'all' },
      { state: 'pending' },
      { subjectKind: 'navigation_version' },
      { actorId: uid(1) },
      { party: uid(1) },
      { filter: 'x' },
    ])
      expect(isRefused(GovernedReviewQueueQuerySchema, query)).toBe(true);
    expect(
      GovernedReviewQueueQuerySchema.safeParse({ cursor: 'c'.repeat(512) })
        .success,
    ).toBe(true);
  });

  it('[P2-S12-AC-094] exposes the query as the sole member of the OpenAPI transport view', () => {
    expect(GovernedReviewQueueApiRequestSchema.parse({ query: {} })).toEqual({
      query: { limit: 25, scope: 'assigned' },
    });
    for (const candidate of [
      {},
      { query: { limit: 0 } },
      { query: {}, body: {} },
      { query: {}, reviewId: uid(1) },
    ])
      expect(isRefused(GovernedReviewQueueApiRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-094] accepts the identifier-free queue item and refuses an inconsistent or extended one', () => {
    expect(GovernedReviewQueueItemSchema.parse(item)).toEqual(item);
    for (const myDecision of ['none', 'approve', 'reject'])
      expect(
        GovernedReviewQueueItemSchema.safeParse({ ...item, myDecision })
          .success,
      ).toBe(true);
    for (const candidate of [
      { ...item, myDecision: 'abstain' },
      { ...item, recordedDecisionCount: 2 },
      { ...item, riskClass: 'protected' },
      { ...item, requiredDecisionCount: 0 },
      { ...item, requiredDecisionCount: 9, recordedDecisionCount: 0 },
      { ...item, subjectKey: 'Bad_Key' },
      { ...item, subjectVersion: 0 },
      { ...item, state: 'pending' },
      { ...item, ownerId: uid(1) },
      { ...item, submitterId: uid(1) },
      { ...item, updatedAt: 'today' },
      without(item, 'assignmentEndsAt'),
      without(item, 'myDecision'),
    ])
      expect(isRefused(GovernedReviewQueueItemSchema, candidate)).toBe(true);
    expect(
      GovernedReviewQueueItemSchema.safeParse({
        ...item,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        recordedDecisionCount: 2,
        assignmentEndsAt: laterInstant,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-094] bounds a page at 50 rows in (updatedAt DESC, reviewId DESC) keyset order with one opaque cursor', () => {
    const page = (
      items: readonly object[],
      nextCursor: string | null = null,
    ) => ({
      items,
      nextCursor,
      pageVersion: '5',
    });
    expect(GovernedReviewQueuePageSchema.parse(page([]))).toEqual(page([]));
    const ordered = Array.from({ length: 50 }, (_, index) => ({
      ...item,
      reviewId: uid(400 + index),
      updatedAt: new Date(
        Date.UTC(2026, 9, 14, 12, 0, 50 - index),
      ).toISOString(),
    }));
    expect(
      GovernedReviewQueuePageSchema.safeParse(page(ordered, 'cursor')).success,
    ).toBe(true);
    expect(
      isRefused(
        GovernedReviewQueuePageSchema,
        page([
          ...ordered,
          { ...item, reviewId: uid(999), updatedAt: '2026-10-13T00:00:00Z' },
        ]),
      ),
    ).toBe(true);
    // Equal instants tie-break on reviewId descending.
    const sameInstant = (reviewId: string) => ({
      ...item,
      reviewId,
      updatedAt: laterInstant,
    });
    expect(
      GovernedReviewQueuePageSchema.safeParse(
        page([sameInstant(uid(12)), sameInstant(uid(11))]),
      ).success,
    ).toBe(true);
    expect(
      issuePaths(
        GovernedReviewQueuePageSchema,
        page([sameInstant(uid(11)), sameInstant(uid(12))]),
      ),
    ).toEqual(['items.1']);
    expect(
      issuePaths(
        GovernedReviewQueuePageSchema,
        page([
          { ...item, updatedAt: instant },
          { ...item, reviewId: uid(71), updatedAt: laterInstant },
        ]),
      ),
    ).toEqual(['items.1']);
    for (const candidate of [
      page([], 'c'.repeat(513)),
      { ...page([]), pageVersion: '0' },
      { items: [], nextCursor: null },
      { ...page([]), total: 0 },
    ])
      expect(isRefused(GovernedReviewQueuePageSchema, candidate)).toBe(true);
    expect(
      GovernedReviewQueuePageSchema.safeParse(page([], 'c'.repeat(512)))
        .success,
    ).toBe(true);
  });
});
