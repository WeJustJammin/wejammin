import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  resourceMeta,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_GOVERNED_ASSIGNMENT_CAPABILITY,
  GovernedReviewAssignmentApiRequestSchema,
  GovernedReviewAssignmentHeadersSchema,
  GovernedReviewAssignmentRequestSchema,
  GovernedReviewAssignmentResourceSchema,
  governedAssignmentSuccessStatus,
} from './governed-assignment';

const reviewId = uid(40);
const create = {
  action: 'create',
  expectedVersion: '4',
  reviewerPersonId: uid(41),
  expiresAt: '2026-10-14T12:00:00Z',
  reason: 'Legal sign-off for the profile template.',
} as const;
const revoke = {
  action: 'revoke',
  expectedVersion: '4',
  assignmentId: uid(42),
} as const;
const headers = {
  contentType: 'application/json',
  idempotencyKey: 'governed-assign-0001',
  ifMatch: '"4"',
} as const;
const resource = {
  ...resourceMeta,
  reviewId,
  state: 'active',
  capability: 'cms.definition_review',
  actions: ['read', 'decide'],
  startsAt: '2026-10-13T12:00:00Z',
  expiresAt: '2026-10-14T12:00:00Z',
  reason: 'Legal sign-off for the profile template.',
} as const;

describe('CMS-03C-08 governed reviewer assignment contract', () => {
  it('[P2-S12-AC-076] accepts a create with a reviewer and expiry and a revoke with an assignment id', () => {
    expect(GovernedReviewAssignmentRequestSchema.parse(create)).toEqual(create);
    expect(GovernedReviewAssignmentRequestSchema.parse(revoke)).toEqual(revoke);
    expect(
      GovernedReviewAssignmentRequestSchema.safeParse(without(create, 'reason'))
        .success,
    ).toBe(true);
  });

  it('[P2-S12-AC-077] refuses an action outside create and revoke and a member the action does not name', () => {
    for (const candidate of [
      { ...create, action: 'extend' },
      { ...create, action: undefined },
      { ...create, assignmentId: uid(42) },
      { ...revoke, reviewerPersonId: uid(41) },
      { ...revoke, expiresAt: '2026-10-14T12:00:00Z' },
      { ...create, capability: 'cms.reviewer' },
      { ...create, startsAt: '2026-10-13T12:00:00Z' },
      without(create, 'reviewerPersonId'),
      without(create, 'expiresAt'),
      without(create, 'expectedVersion'),
      without(revoke, 'assignmentId'),
      without(revoke, 'expectedVersion'),
    ])
      expect(isRefused(GovernedReviewAssignmentRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-077] requires an offset-bearing ISO instant for expiresAt and a UUID reviewer', () => {
    for (const expiresAt of [
      '2026-10-14T12:00:00Z',
      '2026-10-14T12:00:00+02:00',
      '2026-10-14T12:00:00.123Z',
    ])
      expect(
        GovernedReviewAssignmentRequestSchema.safeParse({
          ...create,
          expiresAt,
        }).success,
      ).toBe(true);
    for (const expiresAt of [
      '2026-10-14T12:00:00',
      '2026-10-14',
      'tomorrow',
      '',
      1790000000,
    ])
      expect(
        isRefused(GovernedReviewAssignmentRequestSchema, {
          ...create,
          expiresAt,
        }),
      ).toBe(true);
    expect(
      isRefused(GovernedReviewAssignmentRequestSchema, {
        ...create,
        reviewerPersonId: 'someone@example.com',
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-077] bounds the optional reason at 1 to 256 NFC code points and refuses a non-NFC reason without normalizing it', () => {
    for (const reason of ['r', 'r'.repeat(256), '😀'.repeat(256)])
      expect(
        GovernedReviewAssignmentRequestSchema.safeParse({ ...create, reason })
          .success,
      ).toBe(true);
    for (const reason of ['', 'r'.repeat(257), '😀'.repeat(257), 'café'])
      expect(
        isRefused(GovernedReviewAssignmentRequestSchema, { ...create, reason }),
      ).toBe(true);
    expect(
      GovernedReviewAssignmentRequestSchema.safeParse({
        ...revoke,
        reason: 'x'.repeat(256),
      }).success,
    ).toBe(true);
    expect(
      isRefused(GovernedReviewAssignmentRequestSchema, {
        ...revoke,
        reason: 'x'.repeat(257),
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-079] requires a bounded idempotency key and a strong If-Match', () => {
    expect(GovernedReviewAssignmentHeadersSchema.parse(headers)).toEqual(
      headers,
    );
    for (const candidate of [
      without(headers, 'ifMatch'),
      { ...headers, ifMatch: 'W/"4"' },
      { ...headers, ifMatch: '"0"' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, contentType: 'text/plain' },
    ])
      expect(isRefused(GovernedReviewAssignmentHeadersSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-077] requires the strong If-Match to equal the body expectedVersion, reported at headers.ifMatch', () => {
    for (const body of [create, revoke])
      expect(
        GovernedReviewAssignmentApiRequestSchema.safeParse({
          reviewId,
          headers,
          body,
        }).success,
      ).toBe(true);
    expect(
      issuePaths(GovernedReviewAssignmentApiRequestSchema, {
        reviewId,
        headers: { ...headers, ifMatch: '"5"' },
        body: create,
      }),
    ).toEqual(['headers.ifMatch']);
    expect(
      isRefused(GovernedReviewAssignmentApiRequestSchema, {
        headers,
        body: create,
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-076] answers 201 for a create and 200 for a revoke', () => {
    expect(governedAssignmentSuccessStatus('create')).toBe(201);
    expect(governedAssignmentSuccessStatus('revoke')).toBe(200);
  });
});

describe('GovernedReviewAssignmentResource (CMS-03C-08 201/200)', () => {
  it('[P2-S12-AC-076] carries the review, state, definition-review capability, read+decide actions and a window of at most seven days', () => {
    expect(CMS_GOVERNED_ASSIGNMENT_CAPABILITY).toBe('cms.definition_review');
    expect(GovernedReviewAssignmentResourceSchema.parse(resource)).toEqual(
      resource,
    );
    expect(
      GovernedReviewAssignmentResourceSchema.safeParse({
        ...resource,
        state: 'revoked',
        reason: null,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-076] refuses another capability, a different action set or order, an unknown state and any identity of the reviewer or grantor', () => {
    for (const candidate of [
      { ...resource, capability: 'cms.editorial_review' },
      { ...resource, capability: 'cms.reviewer' },
      { ...resource, actions: ['decide', 'read'] },
      { ...resource, actions: ['read'] },
      { ...resource, actions: ['read', 'decide', 'assign'] },
      { ...resource, state: 'expired' },
      { ...resource, reviewerPersonId: uid(41) },
      { ...resource, grantorPersonId: uid(1) },
      { ...resource, ownerId: uid(1) },
      { ...resource, reviewId: 'x' },
      { ...resource, startsAt: '2026-10-13T12:00:00' },
      without(resource, 'reason'),
      without(resource, 'startsAt'),
    ])
      expect(isRefused(GovernedReviewAssignmentResourceSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-077] keeps the window positive and no longer than exactly seven days', () => {
    const window = (startsAt: string, expiresAt: string) => ({
      ...resource,
      startsAt,
      expiresAt,
    });
    expect(
      GovernedReviewAssignmentResourceSchema.safeParse(
        window('2026-10-13T12:00:00Z', '2026-10-20T12:00:00Z'),
      ).success,
    ).toBe(true);
    expect(
      GovernedReviewAssignmentResourceSchema.safeParse(
        window('2026-10-13T12:00:00Z', '2026-10-13T12:00:01Z'),
      ).success,
    ).toBe(true);
    for (const [startsAt, expiresAt] of [
      ['2026-10-13T12:00:00Z', '2026-10-20T12:00:01Z'],
      ['2026-10-13T12:00:00Z', '2026-10-13T12:00:00Z'],
      ['2026-10-13T12:00:00Z', '2026-10-13T11:59:59Z'],
    ] as const)
      expect(
        issuePaths(
          GovernedReviewAssignmentResourceSchema,
          window(startsAt, expiresAt),
        ),
      ).toEqual(['expiresAt']);
  });

  it('[P2-S12-AC-077] bounds the stored reason at 256 NFC code points or null', () => {
    expect(
      GovernedReviewAssignmentResourceSchema.safeParse({
        ...resource,
        reason: 'x'.repeat(256),
      }).success,
    ).toBe(true);
    for (const reason of ['', 'x'.repeat(257), 'café'])
      expect(
        isRefused(GovernedReviewAssignmentResourceSchema, {
          ...resource,
          reason,
        }),
      ).toBe(true);
  });
});
