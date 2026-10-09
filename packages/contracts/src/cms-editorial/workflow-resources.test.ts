import { describe, expect, it } from 'vitest';

import {
  EditorialReviewResourceSchema,
  EditorialReviewStateSchema,
  PreviewTokenResourceSchema,
  PublicationActionSchema,
  PublicationProjectionStateSchema,
  PublicationResourceSchema,
  PublicationScheduleResourceSchema,
  PublicationScheduleStateSchema,
  PublicationStateSchema,
  ReviewInvalidatedReasonSchema,
  ScheduleReasonCodeSchema,
} from './index';
import {
  hash,
  validApprovedReview,
  validProtectedPolicy,
  validPreviewTokenResource,
  validPublicationResource,
  validReview,
  validScheduleResource,
  without,
} from './workflow-fixtures.test-support';

const uuidLike = '123e4567-e89b-42d3-a456-426614174000';

const refused = (
  schema: { safeParse: (value: unknown) => { success: boolean } },
  value: unknown,
): boolean => !schema.safeParse(value).success;

describe('[P2-S11-AC-005][P2-S11-AC-011] closed Slice 11 state vocabularies', () => {
  it('pins each browser-visible state enum to its exact BE03b members', () => {
    expect(EditorialReviewStateSchema.options).toEqual([
      'open',
      'approved',
      'rejected',
      'invalidated',
    ]);
    expect(PublicationScheduleStateSchema.options).toEqual([
      'pending',
      'executing',
      'completed',
      'failed_retryable',
      'blocked',
      'cancelled',
    ]);
    expect(PublicationStateSchema.options).toEqual([
      'active',
      'superseded',
      'revoked',
    ]);
    expect(PublicationActionSchema.options).toEqual([
      'publish',
      'unpublish',
      'expire',
      'archive',
    ]);
    expect(PublicationProjectionStateSchema.options).toEqual([
      'pending',
      'converged',
      'degraded',
    ]);
    expect(ReviewInvalidatedReasonSchema.options).toEqual([
      'revision_superseded',
      'dependency_changed',
      'reviewer_authority_changed',
      'entry_unavailable',
    ]);
    expect(ScheduleReasonCodeSchema.options).toEqual([
      'approval_invalidated',
      'preflight_failed',
      'publisher_authority_ended',
      'publication_not_active',
      'retries_exhausted',
      'entry_unavailable',
    ]);
  });

  it('keeps `pending` out of the publication state (E3)', () => {
    expect(refused(PublicationStateSchema, 'pending')).toBe(true);
  });
});

describe('[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06)', () => {
  it('accepts an open, an approved and a protected review', () => {
    expect(EditorialReviewResourceSchema.parse(validReview)).toEqual(
      validReview,
    );
    expect(EditorialReviewResourceSchema.parse(validApprovedReview)).toEqual(
      validApprovedReview,
    );
    const protectedReview = {
      ...validReview,
      riskClass: 'protected',
      workflowPolicy: validProtectedPolicy,
      requiredDecisionCount: 2,
      recordedDecisionCount: 1,
    };
    expect(EditorialReviewResourceSchema.parse(protectedReview)).toEqual(
      protectedReview,
    );
  });

  it('rejects unknown keys, including any ownership or authority identifier', () => {
    for (const key of [
      'ownerId',
      'submittedBy',
      'submitterPersonId',
      'reviewerPersonId',
      'actingPartyId',
      'capability',
      'stepUpAt',
      'extra',
    ])
      expect(
        refused(EditorialReviewResourceSchema, {
          ...validReview,
          [key]: uuidLike,
        }),
      ).toBe(true);
  });

  it('requires every member and the exact closed state', () => {
    for (const key of Object.keys(validReview)) {
      const rest = without(validReview, key as keyof typeof validReview);
      expect(refused(EditorialReviewResourceSchema, rest), key).toBe(true);
    }
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        state: 'pending',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        state: 'submitted',
      }),
    ).toBe(true);
  });

  it('ties invalidatedReason to the invalidated state in both directions', () => {
    const invalidated = {
      ...validReview,
      state: 'invalidated',
      invalidatedReason: 'dependency_changed',
    };
    expect(EditorialReviewResourceSchema.safeParse(invalidated).success).toBe(
      true,
    );
    expect(
      refused(EditorialReviewResourceSchema, {
        ...invalidated,
        invalidatedReason: null,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        invalidatedReason: 'dependency_changed',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...invalidated,
        invalidatedReason: 'other',
      }),
    ).toBe(true);
  });

  it('ties decidedAt to the approved and rejected states in both directions', () => {
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validApprovedReview,
        decidedAt: null,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        decidedAt: '2026-10-09T12:00:00Z',
      }),
    ).toBe(true);
    const rejected = {
      ...validReview,
      state: 'rejected',
      recordedDecisionCount: 1,
      decidedAt: '2026-10-09T12:00:00Z',
    };
    expect(EditorialReviewResourceSchema.safeParse(rejected).success).toBe(
      true,
    );
    expect(
      refused(EditorialReviewResourceSchema, { ...rejected, decidedAt: null }),
    ).toBe(true);
    // An invalidated review has no decision instant of its own.
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        state: 'invalidated',
        invalidatedReason: 'revision_superseded',
        decidedAt: '2026-10-09T12:00:00Z',
      }),
    ).toBe(true);
  });

  it('bounds the required (1-8) and recorded (0-8) counts and keeps recorded within required', () => {
    const wide = (required: number, recorded: number) => ({
      ...validReview,
      workflowPolicy: {
        ...validReview.workflowPolicy,
        requiredDecisionCount: required,
      },
      requiredDecisionCount: required,
      recordedDecisionCount: recorded,
    });
    expect(EditorialReviewResourceSchema.safeParse(wide(1, 0)).success).toBe(
      true,
    );
    expect(EditorialReviewResourceSchema.safeParse(wide(8, 8)).success).toBe(
      true,
    );
    expect(refused(EditorialReviewResourceSchema, wide(0, 0))).toBe(true);
    expect(refused(EditorialReviewResourceSchema, wide(9, 0))).toBe(true);
    expect(refused(EditorialReviewResourceSchema, wide(8, 9))).toBe(true);
    expect(refused(EditorialReviewResourceSchema, wide(2, 3))).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        recordedDecisionCount: -1,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        recordedDecisionCount: 0.5,
      }),
    ).toBe(true);
  });

  it('requires a protected review to carry at least two decisions', () => {
    const protectedOne = {
      ...validReview,
      riskClass: 'protected',
      workflowPolicy: { ...validProtectedPolicy, requiredDecisionCount: 2 },
      requiredDecisionCount: 1,
    };
    expect(refused(EditorialReviewResourceSchema, protectedOne)).toBe(true);
    // The frozen policy itself must also be a valid protected policy.
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        riskClass: 'protected',
        workflowPolicy: { ...validProtectedPolicy, requiredCapabilities: [] },
        requiredDecisionCount: 2,
      }),
    ).toBe(true);
  });

  it('binds the review count and risk class to the frozen workflow policy', () => {
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        requiredDecisionCount: 2,
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        riskClass: 'protected',
      }),
    ).toBe(true);
  });

  it('keeps the policy evidence exact (a malformed hash or capability is refused)', () => {
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        workflowPolicy: { ...validReview.workflowPolicy, policyHash: 'x' },
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        frozenHash: hash.toUpperCase(),
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        dependencyHash: 'short',
      }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, { ...validReview, version: '0' }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, { ...validReview, version: 2 }),
    ).toBe(true);
    expect(
      refused(EditorialReviewResourceSchema, {
        ...validReview,
        submittedAt: '2026-10-08',
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-017] PublicationScheduleResource (CMS-03B-07)', () => {
  it('accepts a pending schedule, a completed late run and a blocked schedule', () => {
    expect(
      PublicationScheduleResourceSchema.parse(validScheduleResource),
    ).toEqual(validScheduleResource);
    const completed = {
      ...validScheduleResource,
      state: 'completed',
      jobId: '123e4567-e89b-42d3-a456-426614174009',
      actualUtc: '2026-11-01T14:30:07Z',
      deviationSeconds: 7,
    };
    expect(PublicationScheduleResourceSchema.parse(completed)).toEqual(
      completed,
    );
    const blocked = {
      ...validScheduleResource,
      state: 'blocked',
      reasonCode: 'retries_exhausted',
      attemptCount: 3,
    };
    expect(PublicationScheduleResourceSchema.parse(blocked)).toEqual(blocked);
  });

  it('rejects unknown keys and every missing member', () => {
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        ownerId: validScheduleResource.id,
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        createdBy: validScheduleResource.id,
      }),
    ).toBe(true);
    for (const key of Object.keys(validScheduleResource)) {
      const rest = without(
        validScheduleResource,
        key as keyof typeof validScheduleResource,
      );
      expect(refused(PublicationScheduleResourceSchema, rest), key).toBe(true);
    }
  });

  it('keeps the closed state, action, disambiguation and reason vocabularies', () => {
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        state: 'queued',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        action: 'delete',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        disambiguation: 'auto',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        state: 'blocked',
        reasonCode: 'something_else',
      }),
    ).toBe(true);
  });

  it('carries a reasonCode exactly when the schedule is blocked or cancelled', () => {
    for (const state of ['blocked', 'cancelled'] as const) {
      const base = { ...validScheduleResource, state };
      expect(
        refused(PublicationScheduleResourceSchema, {
          ...base,
          reasonCode: null,
        }),
      ).toBe(true);
      expect(
        PublicationScheduleResourceSchema.safeParse({
          ...base,
          reasonCode: 'approval_invalidated',
        }).success,
      ).toBe(true);
    }
    for (const state of [
      'pending',
      'executing',
      'completed',
      'failed_retryable',
    ] as const) {
      const actual =
        state === 'completed'
          ? { actualUtc: '2026-11-01T14:30:00Z', deviationSeconds: 0 }
          : {};
      expect(
        refused(PublicationScheduleResourceSchema, {
          ...validScheduleResource,
          state,
          ...actual,
          reasonCode: 'preflight_failed',
        }),
        state,
      ).toBe(true);
    }
  });

  it('records the actual instant and deviation together and only on completion', () => {
    const done = { ...validScheduleResource, state: 'completed' };
    expect(refused(PublicationScheduleResourceSchema, done)).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...done,
        actualUtc: '2026-11-01T14:30:00Z',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...done,
        deviationSeconds: 0,
      }),
    ).toBe(true);
    expect(
      PublicationScheduleResourceSchema.safeParse({
        ...done,
        actualUtc: '2026-11-01T14:29:58Z',
        deviationSeconds: -2,
      }).success,
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        actualUtc: '2026-11-01T14:30:00Z',
        deviationSeconds: 0,
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...done,
        actualUtc: '2026-11-01T14:30:00Z',
        deviationSeconds: 1.5,
      }),
    ).toBe(true);
  });

  it('bounds attemptCount to 0-3 and applies the shared time, audience and tzdb grammars', () => {
    expect(
      PublicationScheduleResourceSchema.safeParse({
        ...validScheduleResource,
        attemptCount: 3,
      }).success,
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        attemptCount: 4,
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        attemptCount: -1,
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        audience: 'Members',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        localDateTime: '2026-11-01T09:30:00Z',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        localDateTime: '2026-02-30T09:30:00',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        timezone: '../etc',
      }),
    ).toBe(true);
    expect(
      PublicationScheduleResourceSchema.safeParse({
        ...validScheduleResource,
        timezone: 'America/Argentina/Buenos_Aires',
      }).success,
    ).toBe(true);
    expect(
      PublicationScheduleResourceSchema.safeParse({
        ...validScheduleResource,
        timezone: 'UTC',
      }).success,
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        tzdbVersion: '',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        tzdbVersion: 'x'.repeat(33),
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        tzdbVersion: '2026 e',
      }),
    ).toBe(true);
    expect(
      refused(PublicationScheduleResourceSchema, {
        ...validScheduleResource,
        resolvedUtc: '2026-11-01T14:30:00',
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-023] PreviewTokenResource (CMS-03B-08)', () => {
  it('accepts the exact derived token and rejects unknown keys', () => {
    expect(PreviewTokenResourceSchema.parse(validPreviewTokenResource)).toEqual(
      validPreviewTokenResource,
    );
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        tokenHash: hash,
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        personId: validPreviewTokenResource.entryId,
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        nonce: 'abc',
      }),
    ).toBe(true);
  });

  it('allows only a 43-character unpadded base64url token', () => {
    expect(
      PreviewTokenResourceSchema.safeParse({
        ...validPreviewTokenResource,
        token: 'a-_Z0'.repeat(8) + 'abc',
      }).success,
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        token: 'A'.repeat(42),
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        token: 'A'.repeat(44),
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        token: `${'A'.repeat(42)}=`,
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        token: `${'A'.repeat(42)}+`,
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        token: `${'A'.repeat(42)}/`,
      }),
    ).toBe(true);
  });

  it('echoes the exact binding: locale, audience, normalized route and full version set', () => {
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        audience: 'Members',
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        route: '//evil.example/x',
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        route: '/a?b=1',
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        locale: 'x',
      }),
    ).toBe(true);
    const incomplete = without(
      validPreviewTokenResource.versionSet,
      'settingsVersion',
    );
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        versionSet: incomplete,
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        revoked: 'false',
      }),
    ).toBe(true);
    expect(
      refused(PreviewTokenResourceSchema, {
        ...validPreviewTokenResource,
        expiresAt: '2026-10-08T12:15:00',
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-029] PublicationResource (CMS-03B-09)', () => {
  it('accepts a publish head, a derived superseded row and a revoked tombstone', () => {
    expect(PublicationResourceSchema.parse(validPublicationResource)).toEqual(
      validPublicationResource,
    );
    const superseded = {
      ...validPublicationResource,
      state: 'superseded',
      projectionState: 'converged',
    };
    expect(PublicationResourceSchema.parse(superseded)).toEqual(superseded);
    const tombstone = {
      ...validPublicationResource,
      state: 'revoked',
      action: 'unpublish',
      version: '2',
    };
    expect(PublicationResourceSchema.parse(tombstone)).toEqual(tombstone);
  });

  it('rejects unknown keys and a wrong event type', () => {
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        ownerId: validPublicationResource.id,
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        versionSet: {},
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        eventType: 'cms.publication.changed.v2',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        eventType: 'cms.entry.review-changed.v1',
      }),
    ).toBe(true);
    for (const key of Object.keys(validPublicationResource)) {
      const rest = without(
        validPublicationResource,
        key as keyof typeof validPublicationResource,
      );
      expect(refused(PublicationResourceSchema, rest), key).toBe(true);
    }
  });

  it('keeps the closed state and projection vocabularies', () => {
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        state: 'pending',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        projectionState: 'failed',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        action: 'retire',
      }),
    ).toBe(true);
  });

  it('derives the state from the action: only a publish row is active or superseded (E3)', () => {
    for (const action of ['unpublish', 'expire', 'archive'] as const) {
      expect(
        refused(PublicationResourceSchema, {
          ...validPublicationResource,
          action,
          state: 'active',
        }),
        action,
      ).toBe(true);
      expect(
        refused(PublicationResourceSchema, {
          ...validPublicationResource,
          action,
          state: 'superseded',
        }),
        action,
      ).toBe(true);
      expect(
        PublicationResourceSchema.safeParse({
          ...validPublicationResource,
          action,
          state: 'revoked',
        }).success,
        action,
      ).toBe(true);
    }
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        action: 'publish',
        state: 'revoked',
      }),
    ).toBe(true);
  });

  it('distinguishes the lineage id from the appended row id and keeps the grammars', () => {
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        publicationVersionId: 'x',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        publicationHash: 'x',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        audience: 'a b',
      }),
    ).toBe(true);
    expect(
      refused(PublicationResourceSchema, {
        ...validPublicationResource,
        version: '0',
      }),
    ).toBe(true);
  });
});
