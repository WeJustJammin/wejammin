import { z } from 'zod';

import {
  CmsCapabilityKeySchema,
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import { IdempotencyKeySchema } from '../request-navigation-security.ts';
import { WorkflowRiskClassSchema } from '../cms-editorial/workflow-models.ts';

/*
 * BE03c governed reviews (DEC-137, DEC-113, OD-1): one subject-polymorphic
 * review set serves template, pattern and taxonomy versions through
 * CMS-03C-06 to CMS-03C-11. This module owns the vocabularies, the review base
 * resource and the CMS-03C-06 submission transport. Ownership, the submitter,
 * the reviewer and the MFA instant are server-derived, so none is a member.
 */

/** The closed, code-owned subject kinds; a later slice adds one by forward migration. */
export const CMS_GOVERNED_SUBJECT_KINDS = [
  'template_version',
  'pattern_version',
  'taxonomy_version',
] as const;
export const GovernedSubjectKindSchema = z.enum(CMS_GOVERNED_SUBJECT_KINDS);

/** `rejected` and `invalidated` are terminal. */
export const GovernedReviewStateSchema = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);

/** Review invalidation: exactly these two closed reasons (Governed review machinery). */
export const GovernedInvalidatedReasonSchema = z.enum([
  'dependency_changed',
  'reviewer_authority_changed',
]);

/** The DEC-110 risk class derived from the strictest bound workflow policy. */
export const GovernedRiskClassSchema = WorkflowRiskClassSchema;

/** The base reviewer slot every governed review starts its capability list with. */
export const CMS_GOVERNED_BASE_REVIEWER_CAPABILITY = 'cms.reviewer';

/**
 * CMS-03C-06 request. `subjectId` is the exact version row id in the caller's
 * owner scope and `subjectHash` an equality expectation on its stored content
 * hash; neither selects authority, and no `If-Match` applies.
 */
export const GovernedReviewSubmissionRequestSchema = z.strictObject({
  subjectKind: GovernedSubjectKindSchema,
  subjectId: CmsUuidSchema,
  subjectHash: CmsHashSchema,
});

/** CMS-03C-06 headers: key required, no If-Match. */
export const GovernedReviewSubmissionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
});

/** CMS-03C-06 OpenAPI transport view: the route has no path parameters. */
export const GovernedReviewSubmissionApiRequestSchema = z.strictObject({
  headers: GovernedReviewSubmissionHeadersSchema,
  body: GovernedReviewSubmissionRequestSchema,
});

/** The members every governed review resource carries. */
export const governedReviewBaseShape = {
  ...resourceMetaShape,
  state: GovernedReviewStateSchema,
  subjectKind: GovernedSubjectKindSchema,
  subjectId: CmsUuidSchema,
  /** The lineage id: templateId, patternId or taxonomyId. */
  lineageId: CmsUuidSchema,
  subjectKey: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'subject_key_invalid'),
  subjectVersion: z.number().int().positive(),
  subjectHash: CmsHashSchema,
  riskClass: GovernedRiskClassSchema,
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  requiredCapabilities: z.array(CmsCapabilityKeySchema).min(1).max(16),
  /** JCS SHA-256 of the sorted policy basis (`Governed policy basis`). */
  policyBasisHash: CmsHashSchema,
  submittedAt: CmsInstantSchema,
  /** Non-null exactly for approved and rejected reviews. */
  decidedAt: CmsInstantSchema.nullable(),
  /** Non-null once an activation, schedule or retirement committed. */
  activatedAt: CmsInstantSchema.nullable(),
  invalidatedReason: GovernedInvalidatedReasonSchema.nullable(),
} as const;

type GovernedReviewBase = z.infer<ReturnType<typeof governedReviewBase>>;
const governedReviewBase = () => z.strictObject(governedReviewBaseShape);

/**
 * The review invariants every review-bearing resource enforces (a response
 * that breaks one is a 502 response-contract failure, never rendered).
 */
export const checkGovernedReview = (
  value: GovernedReviewBase,
  context: z.RefinementCtx,
): void => {
  if ((value.state === 'invalidated') !== (value.invalidatedReason !== null))
    context.addIssue({
      code: 'custom',
      path: ['invalidatedReason'],
      message:
        'invalidatedReason exists exactly when the review is invalidated',
    });
  if (
    (value.state === 'approved' || value.state === 'rejected') !==
    (value.decidedAt !== null)
  )
    context.addIssue({
      code: 'custom',
      path: ['decidedAt'],
      message:
        'decidedAt exists exactly when the review is approved or rejected',
    });
  if (value.recordedDecisionCount > value.requiredDecisionCount)
    context.addIssue({
      code: 'custom',
      path: ['recordedDecisionCount'],
      message: 'Recorded decisions cannot exceed required decisions',
    });
  if (value.riskClass === 'protected' && value.requiredDecisionCount < 2)
    context.addIssue({
      code: 'custom',
      path: ['requiredDecisionCount'],
      message: 'Protected review requires at least two decisions',
    });
  if (value.requiredCapabilities[0] !== CMS_GOVERNED_BASE_REVIEWER_CAPABILITY)
    context.addIssue({
      code: 'custom',
      path: ['requiredCapabilities', 0],
      message: 'The base reviewer slot cms.reviewer comes first',
    });
  if (
    new Set(value.requiredCapabilities).size !==
    value.requiredCapabilities.length
  )
    context.addIssue({
      code: 'custom',
      path: ['requiredCapabilities'],
      message: 'Capability slots are unique',
    });
};

/**
 * `GovernedReviewResource`: the CMS-03C-06 (201) and CMS-03C-07 (200) body.
 * `contentHash` is the JCS SHA-256 of `{ subjectKind, subjectId, subjectHash,
 * policyBasisHash, requiredDecisionCount, requiredCapabilities }`.
 */
export const GovernedReviewResourceSchema = governedReviewBase()
  .superRefine(checkGovernedReview)
  .readonly();

export type GovernedSubjectKind = z.infer<typeof GovernedSubjectKindSchema>;
export type GovernedReviewState = z.infer<typeof GovernedReviewStateSchema>;
export type GovernedInvalidatedReason = z.infer<
  typeof GovernedInvalidatedReasonSchema
>;
export type GovernedReviewSubmissionRequest = z.infer<
  typeof GovernedReviewSubmissionRequestSchema
>;
export type GovernedReviewResource = z.infer<
  typeof GovernedReviewResourceSchema
>;
