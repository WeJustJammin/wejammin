import { describe, expect, it } from 'vitest';

import {
  hash,
  hash2,
  instant,
  isRefused,
  issuePaths,
  laterInstant,
  resourceMeta,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_GOVERNED_SUBJECT_KINDS,
  GovernedInvalidatedReasonSchema,
  GovernedReviewResourceSchema,
  GovernedReviewStateSchema,
  GovernedReviewSubmissionApiRequestSchema,
  GovernedReviewSubmissionHeadersSchema,
  GovernedReviewSubmissionRequestSchema,
  GovernedSubjectKindSchema,
} from './governed-review';

const submission = {
  subjectKind: 'template_version',
  subjectId: uid(20),
  subjectHash: hash,
} as const;

const headers = {
  contentType: 'application/json',
  idempotencyKey: 'governed-submit-0001',
} as const;

const review = {
  ...resourceMeta,
  state: 'open',
  subjectKind: 'template_version',
  subjectId: uid(20),
  lineageId: uid(21),
  subjectKey: 'profile-header',
  subjectVersion: 2,
  subjectHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  recordedDecisionCount: 0,
  requiredCapabilities: ['cms.reviewer'],
  policyBasisHash: hash2,
  submittedAt: instant,
  decidedAt: null,
  activatedAt: null,
  invalidatedReason: null,
} as const;

describe('CMS-03C-06 governed review submission contract (DEC-137)', () => {
  it('[P2-S12-AC-064] closes the subject kinds, review states and invalidation reasons', () => {
    expect([...CMS_GOVERNED_SUBJECT_KINDS]).toEqual([
      'template_version',
      'pattern_version',
      'taxonomy_version',
    ]);
    for (const kind of CMS_GOVERNED_SUBJECT_KINDS)
      expect(GovernedSubjectKindSchema.safeParse(kind).success).toBe(true);
    for (const kind of [
      'navigation_version',
      'template',
      '',
      'Template_Version',
    ])
      expect(GovernedSubjectKindSchema.safeParse(kind).success).toBe(false);
    expect(GovernedReviewStateSchema.options).toEqual([
      'open',
      'approved',
      'rejected',
      'invalidated',
    ]);
    expect(GovernedInvalidatedReasonSchema.options).toEqual([
      'dependency_changed',
      'reviewer_authority_changed',
    ]);
    // 03b's two other reasons do not exist for definitions.
    expect(
      GovernedInvalidatedReasonSchema.safeParse('revision_superseded').success,
    ).toBe(false);
    expect(
      GovernedInvalidatedReasonSchema.safeParse('entry_unavailable').success,
    ).toBe(false);
  });

  it('[P2-S12-AC-064] accepts the exact version row id and stored content hash for each kind', () => {
    for (const subjectKind of CMS_GOVERNED_SUBJECT_KINDS)
      expect(
        GovernedReviewSubmissionRequestSchema.parse({
          ...submission,
          subjectKind,
        }),
      ).toEqual({ ...submission, subjectKind });
  });

  it('[P2-S12-AC-065] refuses an off-grammar subject id, a subject hash that is not 64 lowercase hex and any other member', () => {
    for (const candidate of [
      { ...submission, subjectKind: 'nav_version' },
      { ...submission, subjectId: 'not-a-uuid' },
      { ...submission, subjectId: undefined },
      { ...submission, subjectHash: 'a'.repeat(63) },
      { ...submission, subjectHash: 'a'.repeat(65) },
      { ...submission, subjectHash: 'A'.repeat(64) },
      { ...submission, subjectHash: `${'a'.repeat(63)}g` },
      { ...submission, subjectHash: '' },
      { ...submission, expectedVersion: '1' },
      { ...submission, ownerId: uid(1) },
      { ...submission, actorId: uid(1) },
      without(submission, 'subjectHash'),
      without(submission, 'subjectKind'),
    ])
      expect(isRefused(GovernedReviewSubmissionRequestSchema, candidate)).toBe(
        true,
      );
    // The subject hash is reported at its own pointer so the 422 names /subjectHash.
    expect(
      issuePaths(GovernedReviewSubmissionRequestSchema, {
        ...submission,
        subjectHash: 'zz',
      }),
    ).toEqual(['subjectHash']);
  });

  it('[P2-S12-AC-067] requires JSON and a bounded idempotency key and refuses any If-Match', () => {
    expect(GovernedReviewSubmissionHeadersSchema.parse(headers)).toEqual(
      headers,
    );
    for (const candidate of [
      { ...headers, ifMatch: '"1"' },
      { ...headers, contentType: 'text/plain' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, idempotencyKey: 'k'.repeat(129) },
      { ...headers, idempotencyKey: ' leading-space-key' },
      without(headers, 'idempotencyKey'),
      without(headers, 'contentType'),
    ])
      expect(isRefused(GovernedReviewSubmissionHeadersSchema, candidate)).toBe(
        true,
      );
    expect(
      GovernedReviewSubmissionHeadersSchema.safeParse({
        ...headers,
        idempotencyKey: 'k'.repeat(128),
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-064] composes headers and body into the OpenAPI transport view', () => {
    const transport = { headers, body: submission };
    expect(GovernedReviewSubmissionApiRequestSchema.parse(transport)).toEqual(
      transport,
    );
    expect(
      isRefused(GovernedReviewSubmissionApiRequestSchema, {
        ...transport,
        reviewId: uid(1),
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewSubmissionApiRequestSchema, {
        headers,
      }),
    ).toBe(true);
  });
});

describe('GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200)', () => {
  it('[P2-S12-AC-064] accepts the exact open review and carries no ownership, submitter or reviewer identifier', () => {
    expect(GovernedReviewResourceSchema.parse(review)).toEqual(review);
    for (const extra of [
      { ownerId: uid(1) },
      { submitterId: uid(1) },
      { reviewerPersonId: uid(1) },
      { stepUpAt: instant },
      { capability: 'cms.reviewer' },
    ])
      expect(
        isRefused(GovernedReviewResourceSchema, { ...review, ...extra }),
      ).toBe(true);
  });

  it('[P2-S12-AC-064] bounds the decision counts 1-8 and 0-8, the capability slots 1-16 and the subject version', () => {
    const base = {
      ...review,
      riskClass: 'protected',
      requiredCapabilities: ['cms.reviewer'],
    } as const;
    for (const required of [1, 8]) {
      expect(
        GovernedReviewResourceSchema.safeParse({
          ...review,
          requiredDecisionCount: required,
        }).success,
      ).toBe(true);
    }
    for (const requiredDecisionCount of [0, 9, -1, 1.5])
      expect(
        isRefused(GovernedReviewResourceSchema, {
          ...review,
          requiredDecisionCount,
        }),
      ).toBe(true);
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...base,
        requiredDecisionCount: 8,
        recordedDecisionCount: 8,
        state: 'approved',
        decidedAt: laterInstant,
      }).success,
    ).toBe(true);
    for (const recordedDecisionCount of [-1, 9, 0.5])
      expect(
        isRefused(GovernedReviewResourceSchema, {
          ...review,
          requiredDecisionCount: 8,
          recordedDecisionCount,
        }),
      ).toBe(true);
    const slots = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        index === 0 ? 'cms.reviewer' : `cms.specialist_${index}`,
      );
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...review,
        requiredCapabilities: slots(16),
      }).success,
    ).toBe(true);
    for (const requiredCapabilities of [[], slots(17)])
      expect(
        isRefused(GovernedReviewResourceSchema, {
          ...review,
          requiredCapabilities,
        }),
      ).toBe(true);
    for (const subjectVersion of [0, -1, 1.5, '2'])
      expect(
        isRefused(GovernedReviewResourceSchema, { ...review, subjectVersion }),
      ).toBe(true);
  });

  it('[P2-S12-AC-064] makes the base slot cms.reviewer first and every capability slot unique', () => {
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        requiredCapabilities: ['cms.legal_reviewer'],
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        requiredCapabilities: ['cms.reviewer', 'cms.reviewer'],
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        requiredCapabilities: ['cms.reviewer', 'Not A Key'],
      }),
    ).toBe(true);
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...review,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: ['cms.reviewer', 'cms.legal_reviewer'],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-064] ties invalidatedReason to the invalidated state and decidedAt to the approved and rejected states', () => {
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        state: 'invalidated',
        invalidatedReason: null,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        invalidatedReason: 'dependency_changed',
      }),
    ).toBe(true);
    for (const invalidatedReason of [
      'dependency_changed',
      'reviewer_authority_changed',
    ])
      expect(
        GovernedReviewResourceSchema.safeParse({
          ...review,
          state: 'invalidated',
          invalidatedReason,
        }).success,
      ).toBe(true);
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        state: 'invalidated',
        invalidatedReason: 'revision_superseded',
      }),
    ).toBe(true);
    for (const state of ['approved', 'rejected']) {
      expect(
        isRefused(GovernedReviewResourceSchema, {
          ...review,
          state,
          decidedAt: null,
        }),
      ).toBe(true);
      expect(
        GovernedReviewResourceSchema.safeParse({
          ...review,
          state,
          decidedAt: laterInstant,
        }).success,
      ).toBe(true);
    }
    for (const state of ['open', 'invalidated'])
      expect(
        isRefused(GovernedReviewResourceSchema, {
          ...review,
          state,
          decidedAt: laterInstant,
          invalidatedReason:
            state === 'invalidated' ? 'dependency_changed' : null,
        }),
      ).toBe(true);
  });

  it('[P2-S12-AC-064] keeps recorded decisions within the required count and a protected review at two or more', () => {
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        requiredDecisionCount: 2,
        recordedDecisionCount: 3,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedReviewResourceSchema, {
        ...review,
        riskClass: 'protected',
        requiredDecisionCount: 1,
      }),
    ).toBe(true);
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...review,
        riskClass: 'protected',
        requiredDecisionCount: 2,
      }).success,
    ).toBe(true);
    // An ordinary review may still require several decisions.
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...review,
        requiredDecisionCount: 3,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-064] refuses an off-grammar subject key, hash, instant or id and an unknown kind or state', () => {
    for (const candidate of [
      { ...review, subjectKey: 'Bad_Key' },
      { ...review, subjectKey: 'a' },
      { ...review, subjectKey: `a${'b'.repeat(64)}` },
      { ...review, subjectHash: 'A'.repeat(64) },
      { ...review, policyBasisHash: 'f'.repeat(63) },
      { ...review, submittedAt: 'yesterday' },
      { ...review, submittedAt: '2026-10-13T12:00:00' },
      { ...review, lineageId: 'x' },
      { ...review, subjectId: 'x' },
      { ...review, subjectKind: 'navigation_version' },
      { ...review, state: 'pending' },
      { ...review, riskClass: 'critical' },
      { ...review, version: '0' },
      { ...review, contentHash: 'Z'.repeat(64) },
      without(review, 'policyBasisHash'),
      without(review, 'activatedAt'),
      without(review, 'invalidatedReason'),
    ])
      expect(isRefused(GovernedReviewResourceSchema, candidate)).toBe(true);
    expect(
      GovernedReviewResourceSchema.safeParse({
        ...review,
        activatedAt: laterInstant,
        state: 'approved',
        decidedAt: instant,
      }).success,
    ).toBe(true);
  });
});
