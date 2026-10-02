import { describe, expect, it } from 'vitest';

import { ApiErrorSchema } from '../api-error.ts';
import {
  CmsStepUpRequiredDetailsSchema,
  CmsStepUpRequiredErrorSchema,
} from './step-up-required.ts';
import {
  FieldSchemaChangeRequestSchema,
  SchemaActivationRequestSchema,
  SchemaDryRunRequestSchema,
  SchemaReviewAssignmentRequestSchema,
  SchemaReviewDecisionRequestSchema,
  SchemaReviewDetailParamsSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaSuccessorRequestSchema,
} from './requests.ts';
import { instant, uuid, uuid2, uuid3 } from './review-fixtures.test-support.ts';

const ok = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown,
) => schema.safeParse(v).success;

describe('DEC-108 producer request contracts', () => {
  it('accepts strict successor and submission bodies only', () => {
    const clone = {
      supportedLocales: null,
      fallbackChains: null,
    };
    expect(
      ok(SchemaSuccessorRequestSchema, { expectedVersion: '3', ...clone }),
    ).toBe(true);
    expect(
      ok(SchemaSuccessorRequestSchema, {
        expectedVersion: '3',
        ...clone,
        extra: 1,
      }),
    ).toBe(false);
    expect(
      ok(SchemaSuccessorRequestSchema, { expectedVersion: '0', ...clone }),
    ).toBe(false);
    expect(
      ok(SchemaReviewSubmissionRequestSchema, {
        expectedVersion: '3',
        dryRunId: uuid,
      }),
    ).toBe(true);
    expect(
      ok(SchemaReviewSubmissionRequestSchema, { expectedVersion: '3' }),
    ).toBe(false);
  });

  it('requires the transform key and version as a both-or-neither pair', () => {
    const base = {
      expectedVersion: '3',
      transformKey: null,
      transformVersion: null,
    };
    expect(ok(SchemaDryRunRequestSchema, base)).toBe(true);
    expect(
      ok(SchemaDryRunRequestSchema, {
        ...base,
        transformKey: 'cms.rename',
        transformVersion: '1',
      }),
    ).toBe(true);
    const half = SchemaDryRunRequestSchema.safeParse({
      ...base,
      transformKey: 'cms.rename',
    });
    expect(half.success).toBe(false);
    expect(half.error?.issues[0]?.message).toBe(
      'transform_pair_must_be_both_present_or_both_absent',
    );
    expect(
      ok(SchemaDryRunRequestSchema, { ...base, transformVersion: '1' }),
    ).toBe(false);
  });

  it('refuses caller-supplied counts, hashes, classification, and report', () => {
    for (const key of ['sourceCount', 'targetHash', 'classification', 'report'])
      expect(
        ok(SchemaDryRunRequestSchema, {
          expectedVersion: '3',
          transformKey: null,
          transformVersion: null,
          [key]: 1,
        }),
      ).toBe(false);
  });

  it('accepts approve and reject decisions and no reviewer field', () => {
    for (const decision of ['approve', 'reject'])
      expect(
        ok(SchemaReviewDecisionRequestSchema, {
          expectedVersion: '2',
          decision,
        }),
      ).toBe(true);
    expect(
      ok(SchemaReviewDecisionRequestSchema, {
        expectedVersion: '2',
        decision: 'abstain',
      }),
    ).toBe(false);
    expect(
      ok(SchemaReviewDecisionRequestSchema, {
        expectedVersion: '2',
        decision: 'approve',
        reviewerPersonId: uuid,
      }),
    ).toBe(false);
  });

  it('discriminates assignment create from revoke with bounded reasons', () => {
    const create = {
      action: 'create',
      expectedVersion: '2',
      reviewerPersonId: uuid,
      expiresAt: instant,
    };
    const revoke = {
      action: 'revoke',
      expectedVersion: '2',
      assignmentId: uuid2,
    };
    expect(ok(SchemaReviewAssignmentRequestSchema, create)).toBe(true);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, { ...create, reason: 'x' }),
    ).toBe(true);
    expect(ok(SchemaReviewAssignmentRequestSchema, revoke)).toBe(true);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, { ...revoke, reason: '' }),
    ).toBe(false);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, {
        ...revoke,
        reason: 'x'.repeat(257),
      }),
    ).toBe(false);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, {
        ...create,
        assignmentId: uuid2,
      }),
    ).toBe(false);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, {
        ...revoke,
        reviewerPersonId: uuid,
      }),
    ).toBe(false);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, {
        ...create,
        expiresAt: 'tomorrow',
      }),
    ).toBe(false);
    expect(
      ok(SchemaReviewAssignmentRequestSchema, { ...create, scope: 'registry' }),
    ).toBe(false);
  });

  it('keeps activation approval IDs distinct and bounded at eight', () => {
    const base = {
      expectedVersion: '2',
      dryRunId: uuid,
      migrationPlanId: null,
    };
    expect(
      ok(SchemaActivationRequestSchema, {
        ...base,
        approvalIds: [uuid, uuid2],
      }),
    ).toBe(true);
    const repeated = SchemaActivationRequestSchema.safeParse({
      ...base,
      approvalIds: [uuid, uuid],
    });
    expect(repeated.error?.issues[0]?.message).toBe(
      'approval_ids_must_be_distinct',
    );
  });
});

describe('field change request without a stable field identity', () => {
  it('validates a new field against a placeholder identity', () => {
    const field = {
      key: 'display_name',
      kind: 'short_text',
      constraints: {},
      required: true,
      validatorKey: null,
      validatorVersion: null,
      defaultMode: 'none',
      localizationMode: 'none',
      editorConfig: { label: 'Display name', order: 0 },
      lifecycle: 'active',
      migrationPlanId: null,
    };
    expect(ok(FieldSchemaChangeRequestSchema, field)).toBe(true);
    expect(
      ok(FieldSchemaChangeRequestSchema, { ...field, key: 'Bad Key' }),
    ).toBe(false);
  });
});

describe('SchemaReviewDetailParams', () => {
  it('accepts exactly one review UUID path parameter', () => {
    expect(SchemaReviewDetailParamsSchema.parse({ reviewId: uuid })).toEqual({
      reviewId: uuid,
    });
    expect(ok(SchemaReviewDetailParamsSchema, { reviewId: 'not-a-uuid' })).toBe(
      false,
    );
    expect(ok(SchemaReviewDetailParamsSchema, {})).toBe(false);
    expect(
      ok(SchemaReviewDetailParamsSchema, { reviewId: uuid, versionId: uuid2 }),
    ).toBe(false);
  });
});

describe('401 STEP_UP_REQUIRED recovery', () => {
  const details = { recoveryAction: 'step_up' as const, allowedMethods: [] };

  it('accepts the exact step_up recovery with configured method identifiers', () => {
    expect(CmsStepUpRequiredDetailsSchema.parse(details)).toEqual(details);
    expect(
      CmsStepUpRequiredDetailsSchema.parse({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }).allowedMethods,
    ).toEqual(['totp']);
  });

  it('never substitutes reauthenticate or adds keys', () => {
    expect(
      ok(CmsStepUpRequiredDetailsSchema, {
        ...details,
        recoveryAction: 'reauthenticate',
      }),
    ).toBe(false);
    expect(
      ok(CmsStepUpRequiredDetailsSchema, { ...details, extra: true }),
    ).toBe(false);
    expect(
      ok(CmsStepUpRequiredDetailsSchema, { recoveryAction: 'step_up' }),
    ).toBe(false);
    expect(
      ok(CmsStepUpRequiredDetailsSchema, { ...details, allowedMethods: [''] }),
    ).toBe(false);
    expect(
      ok(CmsStepUpRequiredDetailsSchema, {
        ...details,
        allowedMethods: Array.from({ length: 9 }, () => 'totp'),
      }),
    ).toBe(false);
  });

  it('is the BE00 ApiError envelope with the fixed code and details', () => {
    const error = {
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      requestId: uuid3,
      details,
    };
    expect(ApiErrorSchema.safeParse(error).success).toBe(true);
    expect(CmsStepUpRequiredErrorSchema.safeParse(error).success).toBe(true);
    expect(
      CmsStepUpRequiredErrorSchema.safeParse({
        ...error,
        code: 'UNAUTHENTICATED',
      }).success,
    ).toBe(false);
  });
});
