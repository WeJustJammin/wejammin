import { describe, expect, it } from 'vitest';

import {
  CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE,
  CMS_REVIEW_ASSIGNMENT_MAX_SECONDS,
  CmsEditorialReviewAssignmentHeadersSchema,
  EditorialReviewAssignmentApiRequestSchema,
  EditorialReviewAssignmentPathParamsSchema,
  EditorialReviewAssignmentRequestSchema,
  EditorialReviewAssignmentResourceSchema,
  cmsReviewAssignmentExpiryCeiling,
  reviewAssignmentSuccessStatus,
} from './index';
import {
  uid,
  uuid,
  uuid2,
  validAssignmentCreate,
  validAssignmentResource,
  validAssignmentRevoke,
  without,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

const headers = {
  contentType: 'application/json',
  idempotencyKey: 'idem-key-0001',
  ifMatch: '"3"',
} as const;

describe('[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest', () => {
  it('accepts the create and the revoke members of the discriminated union', () => {
    expect(
      EditorialReviewAssignmentRequestSchema.parse(validAssignmentCreate),
    ).toEqual(validAssignmentCreate);
    expect(
      EditorialReviewAssignmentRequestSchema.parse(validAssignmentRevoke),
    ).toEqual(validAssignmentRevoke);
    const withoutReason = without(validAssignmentCreate, 'reason');
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse(withoutReason).success,
    ).toBe(true);
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse({
        ...validAssignmentRevoke,
        reason: 'Left the team.',
      }).success,
    ).toBe(true);
  });

  it('requires a known action and refuses members of the other action', () => {
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        action: 'extend',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        action: undefined,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        assignmentId: uid(11),
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentRevoke,
        reviewerPersonId: uuid2,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentRevoke,
        expiresAt: validAssignmentCreate.expiresAt,
      }),
    ).toBe(true);
  });

  it('refuses every authority a caller might try to supply', () => {
    for (const key of [
      'capability',
      'actions',
      'stepUpAt',
      'ownerId',
      'grantorPersonId',
      'actingPartyId',
      'startsAt',
    ])
      for (const base of [validAssignmentCreate, validAssignmentRevoke])
        expect(
          refused(EditorialReviewAssignmentRequestSchema, {
            ...base,
            [key]: 'x',
          }),
          `${base.action} ${key}`,
        ).toBe(true);
  });

  it('validates the create members', () => {
    const noReviewer = without(validAssignmentCreate, 'reviewerPersonId');
    const noExpiry = without(validAssignmentCreate, 'expiresAt');
    const noVersion = without(validAssignmentCreate, 'expectedVersion');
    expect(refused(EditorialReviewAssignmentRequestSchema, noReviewer)).toBe(
      true,
    );
    expect(refused(EditorialReviewAssignmentRequestSchema, noExpiry)).toBe(
      true,
    );
    expect(refused(EditorialReviewAssignmentRequestSchema, noVersion)).toBe(
      true,
    );
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        reviewerPersonId: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        expectedVersion: '0',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        expectedVersion: 3,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        expiresAt: '2026-10-10T12:00:00',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentCreate,
        expiresAt: 'tomorrow',
      }),
    ).toBe(true);
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse({
        ...validAssignmentCreate,
        expiresAt: '2026-10-10T12:00:00+02:00',
      }).success,
    ).toBe(true);
  });

  it('validates the revoke members', () => {
    const noAssignment = without(validAssignmentRevoke, 'assignmentId');
    expect(refused(EditorialReviewAssignmentRequestSchema, noAssignment)).toBe(
      true,
    );
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentRevoke,
        assignmentId: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentRequestSchema, {
        ...validAssignmentRevoke,
        expectedVersion: '01',
      }),
    ).toBe(true);
  });

  it('bounds the optional reason at 1-256 Unicode characters, already NFC', () => {
    const create = (reason: unknown) => ({ ...validAssignmentCreate, reason });
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse(create('x')).success,
    ).toBe(true);
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse(create('a'.repeat(256)))
        .success,
    ).toBe(true);
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse(
        create('\u{1F600}'.repeat(256)),
      ).success,
    ).toBe(true);
    expect(refused(EditorialReviewAssignmentRequestSchema, create(''))).toBe(
      true,
    );
    expect(
      refused(EditorialReviewAssignmentRequestSchema, create('a'.repeat(257))),
    ).toBe(true);
    expect(
      refused(
        EditorialReviewAssignmentRequestSchema,
        create('\u{1F600}'.repeat(257)),
      ),
    ).toBe(true);
    expect(refused(EditorialReviewAssignmentRequestSchema, create('é'))).toBe(
      true,
    );
    expect(
      EditorialReviewAssignmentRequestSchema.safeParse(create('é')).success,
    ).toBe(true);
    expect(refused(EditorialReviewAssignmentRequestSchema, create(null))).toBe(
      true,
    );
    expect(refused(EditorialReviewAssignmentRequestSchema, create(7))).toBe(
      true,
    );
  });
});

describe('[P2-S11-AC-067] CMS-03B-18 transport contracts', () => {
  it('addresses the review by UUID and requires key plus a strong If-Match over JSON', () => {
    expect(
      EditorialReviewAssignmentPathParamsSchema.parse({ reviewId: uuid }),
    ).toEqual({ reviewId: uuid });
    expect(
      refused(EditorialReviewAssignmentPathParamsSchema, { reviewId: 'x' }),
    ).toBe(true);
    expect(CmsEditorialReviewAssignmentHeadersSchema.parse(headers)).toEqual(
      headers,
    );
    expect(
      refused(CmsEditorialReviewAssignmentHeadersSchema, {
        ...headers,
        ifMatch: '3',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialReviewAssignmentHeadersSchema, {
        ...headers,
        idempotencyKey: 'short',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialReviewAssignmentHeadersSchema, {
        ...headers,
        contentType: 'text/plain',
      }),
    ).toBe(true);
  });

  it('declares the OpenAPI transport view with path, headers and the discriminated body', () => {
    expect(
      EditorialReviewAssignmentApiRequestSchema.parse({
        reviewId: uuid,
        headers,
        body: validAssignmentCreate,
      }).body.action,
    ).toBe('create');
    expect(
      EditorialReviewAssignmentApiRequestSchema.parse({
        reviewId: uuid,
        headers,
        body: validAssignmentRevoke,
      }).body.action,
    ).toBe('revoke');
    expect(
      refused(EditorialReviewAssignmentApiRequestSchema, {
        headers,
        body: validAssignmentCreate,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentApiRequestSchema, {
        reviewId: uuid,
        body: validAssignmentCreate,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentApiRequestSchema, {
        reviewId: uuid,
        headers,
        body: { action: 'create' },
      }),
    ).toBe(true);
  });

  it('answers 201 for a created assignment and 200 for a revoke', () => {
    expect(reviewAssignmentSuccessStatus('create')).toBe(201);
    expect(reviewAssignmentSuccessStatus('revoke')).toBe(200);
  });
});

describe('[P2-S11-AC-067] EditorialReviewAssignmentResource', () => {
  it('accepts an active and a revoked assignment', () => {
    expect(
      EditorialReviewAssignmentResourceSchema.parse(validAssignmentResource),
    ).toEqual(validAssignmentResource);
    const revoked = {
      ...validAssignmentResource,
      state: 'revoked',
      version: '2',
      reason: 'Left the team.',
    };
    expect(EditorialReviewAssignmentResourceSchema.parse(revoked)).toEqual(
      revoked,
    );
  });

  it('confers exactly read and decide under cms.editorial_review and no identity', () => {
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        capability: 'cms.reviewer',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        actions: ['read'],
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        actions: ['decide', 'read'],
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        actions: ['read', 'decide', 'publish'],
      }),
    ).toBe(true);
    for (const key of [
      'reviewerPersonId',
      'grantorPersonId',
      'ownerId',
      'actingPartyId',
      'stepUpAt',
    ])
      expect(
        refused(EditorialReviewAssignmentResourceSchema, {
          ...validAssignmentResource,
          [key]: uuid,
        }),
        key,
      ).toBe(true);
    for (const key of Object.keys(validAssignmentResource)) {
      const rest = without(
        validAssignmentResource,
        key as keyof typeof validAssignmentResource,
      );
      expect(refused(EditorialReviewAssignmentResourceSchema, rest), key).toBe(
        true,
      );
    }
  });

  it('keeps the closed state, the 1-256 character reason and a window of at most seven days', () => {
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        state: 'expired',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        reason: '',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        reason: 'a'.repeat(257),
      }),
    ).toBe(true);
    expect(
      EditorialReviewAssignmentResourceSchema.safeParse({
        ...validAssignmentResource,
        expiresAt: '2026-10-15T12:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        expiresAt: '2026-10-15T12:00:01Z',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        expiresAt: validAssignmentResource.startsAt,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        expiresAt: '2026-10-07T12:00:00Z',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewAssignmentResourceSchema, {
        ...validAssignmentResource,
        reviewId: 'x',
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-068][P2-S11-AC-070] assignment bounds shared by SQL, Worker and the form', () => {
  it('fixes the seven-day window and the sixteen-active ceiling', () => {
    expect(CMS_REVIEW_ASSIGNMENT_MAX_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE).toBe(16);
  });

  it('caps expiry at the earliest of seven days, the reviewer grant end and the grantor authority end', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    expect(
      cmsReviewAssignmentExpiryCeiling(now, now + 30 * day, now + 30 * day),
    ).toBe(now + 7 * day);
    expect(
      cmsReviewAssignmentExpiryCeiling(now, now + 2 * day, now + 30 * day),
    ).toBe(now + 2 * day);
    expect(
      cmsReviewAssignmentExpiryCeiling(now, now + 30 * day, now + 1 * day),
    ).toBe(now + 1 * day);
    expect(
      cmsReviewAssignmentExpiryCeiling(now, now + 6 * day, now + 5 * day),
    ).toBe(now + 5 * day);
  });
});
