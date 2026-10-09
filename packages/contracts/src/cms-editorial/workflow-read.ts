import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { WorkflowPolicyEvidenceSchema } from '../content-schema-registry/models-workflow.ts';
import {
  EntryRevisionStateSchema,
  EntryValidationStateSchema,
  entryRevisionResourceMetaSchema,
} from './models.ts';
import { Bcp47Schema } from './primitives.ts';
import { PreflightReportSchema } from './preflight.ts';
import {
  DependencyManifestSchema,
  VersionSetSchema,
} from './publication-contracts.ts';
import { CmsPublicationAudienceSchema } from './publication-schedule-contracts.ts';
import {
  FrozenCandidateSchema,
  checkEditorialReviewFrozen,
  editorialReviewBaseShape,
} from './review-resources.ts';
import { cmsJsonEqual, versionSetMatchesManifest } from './version-set.ts';
import {
  PublicationActionSchema,
  PublicationProjectionStateSchema,
  PublicationScheduleStateSchema,
  PublicationStateSchema,
  ScheduleReasonCodeSchema,
  WorkflowNextActionSchema,
  WorkflowRiskClassSchema,
} from './workflow-models.ts';

/*
 * BE03b CMS-03B-15 workflow and submission-preparation read. The preparation is
 * recomputed on every read and never stored; it grants no authority, so every
 * command re-runs its own checks. Ownership and authority identifiers are
 * absent from every member.
 */

/** BE03b CMS-03B-15 addressing: exactly one UUID path parameter. */
export const EntryWorkflowPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema })
  .readonly();

/**
 * BE03b `EntryWorkflowQuery`: the bound entry id plus an optional revision id
 * (default: the entry's current draft revision). A `revisionId` of another entry
 * is the same 404 as an absent one.
 */
export const EntryWorkflowQuerySchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema.optional(),
  })
  .readonly();

/** OpenAPI transport view for CMS-03B-15: the path and the one query member. */
export const EntryWorkflowApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  query: z.strictObject({ revisionId: CmsUuidSchema.optional() }),
});

/** BE03b `EntryWorkflowRevision`: the revision with its derived state (E2). */
export const EntryWorkflowRevisionSchema = z
  .strictObject({
    id: CmsUuidSchema,
    revisionNumber: CmsVersionSchema,
    locale: Bcp47Schema,
    schemaVersionId: CmsUuidSchema,
    state: EntryRevisionStateSchema,
    contentHash: CmsHashSchema,
    validationState: EntryValidationStateSchema,
    isCurrentDraft: z.boolean(),
  })
  .readonly();

/**
 * BE03b `EntryWorkflowPreparation`: what the submit form echoes unmodified into
 * CMS-03B-05 (and, via `versionSet`, CMS-03B-08). `preflight` is a read-only,
 * non-authoritative evaluation of the submit phase.
 */
export const EntryWorkflowPreparationSchema = z
  .strictObject({
    frozenHash: CmsHashSchema,
    dependencyManifest: DependencyManifestSchema,
    dependencyHash: CmsHashSchema,
    versionSet: VersionSetSchema,
    riskClass: WorkflowRiskClassSchema,
    workflowPolicy: WorkflowPolicyEvidenceSchema,
    preflight: PreflightReportSchema,
  })
  .superRefine((value, context) => {
    if (value.riskClass !== value.workflowPolicy.riskClass)
      context.addIssue({
        code: 'custom',
        path: ['riskClass'],
        message: 'riskClass equals the frozen workflow policy class',
      });
    if (
      !cmsJsonEqual(
        value.workflowPolicy,
        value.dependencyManifest.schema.workflowPolicy,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['workflowPolicy'],
        message: 'workflowPolicy equals the manifest schema workflow policy',
      });
    if (!versionSetMatchesManifest(value.versionSet, value.dependencyManifest))
      context.addIssue({
        code: 'custom',
        path: ['versionSet'],
        message: 'versionSet is the projection of the dependency manifest',
      });
  })
  .readonly();

/** BE03b `EntryWorkflowSchedule`: a schedule summary for the revision. */
export const EntryWorkflowScheduleSchema = z
  .strictObject({
    id: CmsUuidSchema,
    version: CmsVersionSchema,
    state: PublicationScheduleStateSchema,
    action: PublicationActionSchema,
    audience: CmsPublicationAudienceSchema,
    resolvedUtc: CmsInstantSchema,
    reasonCode: ScheduleReasonCodeSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (
      (value.state === 'blocked' || value.state === 'cancelled') !==
      (value.reasonCode !== null)
    )
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message:
          'reasonCode exists exactly when the schedule is blocked or cancelled',
      });
  })
  .readonly();

/** BE03b `EntryWorkflowPublication`: one lineage row of the entry. */
export const EntryWorkflowPublicationSchema = z
  .strictObject({
    publicationId: CmsUuidSchema,
    publicationVersionId: CmsUuidSchema,
    version: CmsVersionSchema,
    state: PublicationStateSchema,
    action: PublicationActionSchema,
    revisionId: CmsUuidSchema,
    locale: Bcp47Schema,
    audience: CmsPublicationAudienceSchema,
    publicationHash: CmsHashSchema,
    projectionState: PublicationProjectionStateSchema,
    createdAt: CmsInstantSchema,
  })
  .superRefine((value, context) => {
    if ((value.action === 'publish') !== (value.state !== 'revoked'))
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message:
          'a publish row is active or superseded and every other action is a revoked tombstone',
      });
  })
  .readonly();

/** The latest review of the revision with its frozen candidate. */
const WorkflowReviewSchema = z
  .strictObject({
    ...editorialReviewBaseShape,
    frozen: FrozenCandidateSchema,
  })
  .superRefine(checkEditorialReviewFrozen);

/**
 * BE03b `EntryWorkflowResource` (CMS-03B-15). `entry.version` is the If-Match
 * operand of CMS-03B-05 and CMS-03B-08; `review.version` the one of
 * CMS-03B-06, -07, -09 and -18.
 */
export const EntryWorkflowResourceSchema = z
  .strictObject({
    entry: entryRevisionResourceMetaSchema,
    revision: EntryWorkflowRevisionSchema,
    preparation: EntryWorkflowPreparationSchema.nullable(),
    review: WorkflowReviewSchema.nullable(),
    schedules: z.array(EntryWorkflowScheduleSchema).max(16).readonly(),
    publications: z.array(EntryWorkflowPublicationSchema).max(64).readonly(),
    permittedNextActions: z
      .array(WorkflowNextActionSchema)
      .max(6)
      .refine(
        (actions) => new Set(actions).size === actions.length,
        'actions_must_be_unique',
      )
      .readonly(),
  })
  .superRefine((value, context) => {
    if (value.preparation !== null) {
      if (value.revision.state !== 'draft' || !value.revision.isCurrentDraft)
        context.addIssue({
          code: 'custom',
          path: ['preparation'],
          message: 'preparation exists only for a submittable current draft',
        });
      if (value.preparation.frozenHash !== value.revision.contentHash)
        context.addIssue({
          code: 'custom',
          path: ['preparation', 'frozenHash'],
          message: 'frozenHash equals the served revision content hash',
        });
    }
    if (
      value.review !== null &&
      (value.review.revisionId !== value.revision.id ||
        value.review.entryId !== value.entry.id)
    )
      context.addIssue({
        code: 'custom',
        path: ['review'],
        message: 'the latest review belongs to the served entry and revision',
      });
  })
  .readonly();

export type EntryWorkflowQuery = z.infer<typeof EntryWorkflowQuerySchema>;
export type EntryWorkflowRevision = z.infer<typeof EntryWorkflowRevisionSchema>;
export type EntryWorkflowPreparation = z.infer<
  typeof EntryWorkflowPreparationSchema
>;
export type EntryWorkflowSchedule = z.infer<typeof EntryWorkflowScheduleSchema>;
export type EntryWorkflowPublication = z.infer<
  typeof EntryWorkflowPublicationSchema
>;
export type EntryWorkflowResource = z.infer<typeof EntryWorkflowResourceSchema>;
