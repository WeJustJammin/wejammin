import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { entryRevisionResourceMetaShape } from './models.ts';
import { VersionSetSchema } from './publication-contracts.ts';
import {
  EditorialReviewStateSchema,
  ReviewInvalidatedReasonSchema,
  WorkflowRiskClassSchema,
} from './workflow-models.ts';
import { WorkflowPolicyEvidenceSchema } from '../content-schema-registry/models-workflow.ts';

/*
 * BE03b `EditorialReview` browser resources (CMS-03B-05, CMS-03B-06 and, with
 * the frozen candidate, CMS-03B-15 and CMS-03B-16). Ownership, the submitter
 * and the reviewer stay server-side: the envelope is `ResourceMeta` only.
 */

/**
 * BE03b `FrozenCandidate`: what a review freezes and what CMS-03B-07, -08 and
 * -09 must echo. `versionSet` is the pure projection of the frozen manifest.
 */
export const FrozenCandidateSchema = z
  .strictObject({
    frozenHash: CmsHashSchema,
    dependencyHash: CmsHashSchema,
    versionSet: VersionSetSchema,
  })
  .readonly();

/** BE03b `EditorialReviewBase`: the members every review resource carries. */
export const editorialReviewBaseShape = {
  ...entryRevisionResourceMetaShape,
  state: EditorialReviewStateSchema,
  entryId: CmsUuidSchema,
  revisionId: CmsUuidSchema,
  riskClass: WorkflowRiskClassSchema,
  workflowPolicy: WorkflowPolicyEvidenceSchema,
  activationEvidence: WorkflowPolicyEvidenceSchema,
  frozenHash: CmsHashSchema,
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  dependencyHash: CmsHashSchema,
  /** Closed token set (Review invalidation); non-null exactly when invalidated. */
  invalidatedReason: ReviewInvalidatedReasonSchema.nullable(),
  submittedAt: CmsInstantSchema,
  /** Non-null exactly for approved and rejected reviews. */
  decidedAt: CmsInstantSchema.nullable(),
} as const;

const EditorialReviewBaseSchema = z.strictObject(editorialReviewBaseShape);

type EditorialReviewBase = z.infer<typeof EditorialReviewBaseSchema>;

/**
 * BE03b `checkEditorialReview`: the review invariants every review-bearing
 * resource enforces (a response that breaks one is a 422 response-contract
 * failure, never rendered).
 */
export const checkEditorialReview = (
  value: EditorialReviewBase,
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
  if (
    value.requiredDecisionCount !== value.workflowPolicy.requiredDecisionCount
  )
    context.addIssue({
      code: 'custom',
      path: ['requiredDecisionCount'],
      message: 'Review count must equal the frozen workflow policy count',
    });
  if (value.riskClass !== value.workflowPolicy.riskClass)
    context.addIssue({
      code: 'custom',
      path: ['riskClass'],
      message: 'Review risk class must equal the frozen workflow policy class',
    });
};

/**
 * A review-bearing resource that embeds the `frozen` candidate restates the
 * review's own hashes there, so the two must agree.
 */
export const checkEditorialReviewFrozen = (
  value: EditorialReviewBase & { readonly frozen: FrozenCandidate },
  context: z.RefinementCtx,
): void => {
  checkEditorialReview(value, context);
  if (value.frozen.frozenHash !== value.frozenHash)
    context.addIssue({
      code: 'custom',
      path: ['frozen', 'frozenHash'],
      message: 'the frozen candidate restates the review frozen hash',
    });
  if (value.frozen.dependencyHash !== value.dependencyHash)
    context.addIssue({
      code: 'custom',
      path: ['frozen', 'dependencyHash'],
      message: 'the frozen candidate restates the review dependency hash',
    });
};

/** BE03b `EditorialReviewResource`: the CMS-03B-05 (201) and CMS-03B-06 (200) body. */
export const EditorialReviewResourceSchema =
  EditorialReviewBaseSchema.superRefine(checkEditorialReview).readonly();

export type FrozenCandidate = z.infer<typeof FrozenCandidateSchema>;
export type EditorialReviewResource = z.infer<
  typeof EditorialReviewResourceSchema
>;
