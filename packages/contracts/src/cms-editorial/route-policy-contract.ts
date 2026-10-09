import { z } from 'zod';

import {
  type CmsEditorialCapability,
  type CmsEditorialCapabilityMode,
  type CmsEditorialOperationId,
  type CmsEditorialPath,
  type CmsEditorialPathParamsSchemaName,
  type CmsEditorialRequestSchemaName,
  type CmsEditorialSuccessSchemaName,
} from './route-policy-base.ts';
import type {
  EditorialAuthoringContextErrors,
  EditorialConflictDetailErrors,
  EditorialConflictResolutionErrors,
  EditorialDraftDetailErrors,
  EditorialEntryCreateErrors,
  EditorialEntryListErrors,
  EditorialRestoreErrors,
  EditorialReviewCommandErrors,
  EditorialReviewQueueErrors,
  EditorialRevisionErrors,
  EditorialRevisionHistoryErrors,
  EditorialStepUpCommandErrors,
  EditorialWorkflowReadErrors,
} from './route-policy-errors.ts';
import type { CmsSlice11ReasonCode } from './refusals.ts';

export type CmsEditorialRouteContract = {
  method: 'POST' | 'GET';
  path: CmsEditorialPath;
  requestSchema: CmsEditorialRequestSchemaName;
  /** Present only when the route actually binds path parameters. */
  pathParamsSchema?: CmsEditorialPathParamsSchemaName;
  /** Present only for JSON-body commands; safe reads declare querySchema. */
  headersSchema?:
    | 'EntryRevisionHeadersSchema'
    | 'ConflictResolutionHeadersSchema'
    | 'RevisionRestoreHeadersSchema'
    | 'EntryCreateHeadersSchema'
    | 'CmsEditorialReviewSubmissionHeadersSchema'
    | 'CmsEditorialDecisionHeadersSchema'
    | 'CmsPublicationScheduleHeadersSchema'
    | 'CmsPreviewRequestHeadersSchema'
    | 'CmsPublicationRequestHeadersSchema'
    | 'CmsEditorialReviewAssignmentHeadersSchema';
  /** Present only for safe reads whose input is a query string. */
  querySchema?:
    | 'EntryDraftDetailQuerySchema'
    | 'RevisionHistoryQuerySchema'
    | 'ConflictDetailQuerySchema'
    | 'EntryListQuerySchema'
    | 'AuthoringContextQuerySchema'
    | 'EntryWorkflowQuerySchema'
    | 'EditorialReviewDetailQuerySchema'
    | 'ReviewQueueQuerySchema';
  successSchema: CmsEditorialSuccessSchemaName;
  /** The primary success status; `additionalSuccessStatuses` names any other. */
  successStatus: 200 | 201 | 202;
  /** CMS-03B-18 answers 201 for a created assignment and 200 for a revoke. */
  additionalSuccessStatuses?: readonly (200 | 201 | 202)[];
  /**
   * created: 201 new resource; accepted: 202 (scheduled or committed, not
   * public visibility); updated: 200 on an existing resource; read: safe 200.
   */
  outcome: 'created' | 'accepted' | 'updated' | 'read';
  etag: 'strong' | 'none';
  /** `on_create` publishes a Location for the 201 only (CMS-03B-18). */
  location: 'required' | 'on_create' | 'none';
  auth:
    | 'editorial_author'
    | 'editorial_reader'
    | 'editorial_reviewer'
    | 'editorial_publisher'
    | 'editorial_preview'
    | 'editorial_workflow_reader'
    | 'editorial_review_reader'
    | 'editorial_review_queue'
    | 'editorial_owner';
  /**
   * The capabilities that establish the route scope. With `gate: 'capability'`
   * they are the Worker's coarse any-of/all-of gate; with `gate: 'rpc_scope'`
   * they only document what the RPC may derive scope from, because the RPC
   * resolves the full scope (assignment, reviewer assignee, submitter, receipt
   * owner) and answers 403 or 404 itself.
   */
  capabilities: readonly CmsEditorialCapability[];
  capabilityMode: CmsEditorialCapabilityMode;
  gate: 'capability' | 'rpc_scope';
  /** `required` is BE03b E6: missing or stale MFA is 401 `STEP_UP_REQUIRED`. */
  stepUp: 'required' | 'none';
  audience: 'browser';
  cors: 'cms-console';
  csrf: 'required' | 'forbidden' | 'none';
  rawBodySignature: 'required' | 'none';
  idempotency: 'required' | 'none';
  ifMatch: 'required' | 'none';
  maxBodyBytes: 262_144;
  rateClass:
    | 'cms-entry-write'
    | 'cms-entry-conflict'
    | 'cms-entry-read'
    | 'cms-review-write'
    | 'cms-review-assignment'
    | 'cms-schedule-write'
    | 'cms-preview-write'
    | 'cms-publish-write';
  rateLimit: number;
  partyRateLimit?: number;
  rateWindowSeconds: 60;
  rateScope: 'user' | 'party';
  timeoutMs: 15_000 | 8_000;
  responseTargetMs: number;
  cacheControl: 'no-store';
  slo: CmsEditorialSlo;
  /** The explicit none value is the no-event declaration for safe reads. */
  eventType:
    | 'cms.entry.revision-created.v1'
    | 'cms.entry.review-changed.v1'
    | 'cms.publication.changed.v1'
    | 'none';
  /** The closed Slice 11 typed refusal tokens this operation may publish. */
  reasonCodes?: readonly CmsSlice11ReasonCode[];
  errors:
    | EditorialRevisionErrors
    | EditorialConflictResolutionErrors
    | EditorialRevisionHistoryErrors
    | EditorialRestoreErrors
    | EditorialEntryCreateErrors
    | EditorialDraftDetailErrors
    | EditorialConflictDetailErrors
    | EditorialEntryListErrors
    | EditorialAuthoringContextErrors
    | EditorialReviewCommandErrors
    | EditorialStepUpCommandErrors
    | EditorialWorkflowReadErrors
    | EditorialReviewQueueErrors;
};

/**
 * Tier 1 is the read budget (p95 under 750ms) and Tier 2 the command budget
 * (p95 under 1,200ms); both share the protected-RPC and acceptance budgets.
 */
export type CmsEditorialSlo =
  | Readonly<{
      tier: 1;
      commandP95Ms: 750;
      protectedRpcP95Ms: 300;
      acceptanceP99Ms: 1_000;
    }>
  | Readonly<{
      tier: 2;
      commandP95Ms: 1_200;
      protectedRpcP95Ms: 300;
      acceptanceP99Ms: 1_000;
    }>;

export type CmsEditorialRoutePolicy = Readonly<{
  operationId: CmsEditorialOperationId;
}> &
  CmsEditorialRouteContract;

/** Slice 10 entry-authoring commands: 201 revision or entry, revision event. */
const entryCommandShapeSchema = z.object({
  operationId: z.literal([
    'CMS-03B-01',
    'CMS-03B-02',
    'CMS-03B-04',
    'CMS-03B-10',
  ]),
  method: z.literal('POST'),
  path: z.literal([
    '/api/v1/cms/entries/{entryId}/revisions',
    '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
    '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
    '/api/v1/cms/entries',
  ]),
  requestSchema: z.literal([
    'EntryRevisionRequestSchema',
    'ConflictResolutionRequestSchema',
    'RevisionRestoreRequestSchema',
    'EntryCreateRequestSchema',
  ]),
  successSchema: z.literal([
    'EntryRevisionResourceSchema',
    'EntryCreateResourceSchema',
  ]),
  successStatus: z.literal(201),
  outcome: z.literal('created'),
  rateClass: z.literal(['cms-entry-write', 'cms-entry-conflict']),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.entry.revision-created.v1'),
});

/** CMS-03B-05: 201 review, review event. */
const reviewSubmitShapeSchema = z.object({
  operationId: z.literal('CMS-03B-05'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/entries/{entryId}/reviews'),
  requestSchema: z.literal('ReviewSubmissionRequestSchema'),
  successSchema: z.literal('EditorialReviewResourceSchema'),
  successStatus: z.literal(201),
  outcome: z.literal('created'),
  rateClass: z.literal('cms-review-write'),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.entry.review-changed.v1'),
});

/** CMS-03B-06: 200 on the existing review, review event. */
const reviewDecisionShapeSchema = z.object({
  operationId: z.literal('CMS-03B-06'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/reviews/{reviewId}/decision'),
  requestSchema: z.literal('EditorialDecisionRequestSchema'),
  successSchema: z.literal('EditorialReviewResourceSchema'),
  successStatus: z.literal(200),
  outcome: z.literal('updated'),
  rateClass: z.literal('cms-review-write'),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.entry.review-changed.v1'),
});

/** CMS-03B-07: 202 scheduled, no event until execution. */
const scheduleAcceptShapeSchema = z.object({
  operationId: z.literal('CMS-03B-07'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/publication-schedules'),
  requestSchema: z.literal('PublicationScheduleRequestSchema'),
  successSchema: z.literal('PublicationScheduleResourceSchema'),
  successStatus: z.literal(202),
  outcome: z.literal('accepted'),
  rateClass: z.literal('cms-schedule-write'),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('none'),
});

/** CMS-03B-08: 201 token on the 8 s Tier 1 budget, no event. */
const previewMintShapeSchema = z.object({
  operationId: z.literal('CMS-03B-08'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/previews'),
  requestSchema: z.literal('PreviewRequestSchema'),
  successSchema: z.literal('PreviewTokenResourceSchema'),
  successStatus: z.literal(201),
  outcome: z.literal('created'),
  rateClass: z.literal('cms-preview-write'),
  timeoutMs: z.literal(8_000),
  eventType: z.literal('none'),
});

/** CMS-03B-09: 202 lineage row committed, publication event. */
const publishAcceptShapeSchema = z.object({
  operationId: z.literal('CMS-03B-09'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/publications'),
  requestSchema: z.literal('PublicationRequestSchema'),
  successSchema: z.literal('PublicationResourceSchema'),
  successStatus: z.literal(202),
  outcome: z.literal('accepted'),
  rateClass: z.literal('cms-publish-write'),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.publication.changed.v1'),
});

/** CMS-03B-18: 201 created assignment (200 revoke), review event. */
const assignmentShapeSchema = z.object({
  operationId: z.literal('CMS-03B-18'),
  method: z.literal('POST'),
  path: z.literal('/api/v1/cms/reviews/{reviewId}/assignments'),
  requestSchema: z.literal('EditorialReviewAssignmentRequestSchema'),
  successSchema: z.literal('EditorialReviewAssignmentResourceSchema'),
  successStatus: z.literal(201),
  outcome: z.literal('created'),
  rateClass: z.literal('cms-review-assignment'),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.entry.review-changed.v1'),
});

/** The read outcome set: every GET row and its read-only discriminants. */
const readShapeSchema = z.object({
  operationId: z.literal([
    'CMS-03B-03',
    'CMS-03B-11',
    'CMS-03B-12',
    'CMS-03B-13',
    'CMS-03B-14',
    'CMS-03B-15',
    'CMS-03B-16',
    'CMS-03B-17',
  ]),
  method: z.literal('GET'),
  path: z.literal([
    '/api/v1/cms/entries/{entryId}',
    '/api/v1/cms/entries/{entryId}/revisions',
    '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}',
    '/api/v1/cms/entries',
    '/api/v1/cms/entries/authoring-context',
    '/api/v1/cms/entries/{entryId}/workflow',
    '/api/v1/cms/reviews/{reviewId}',
    '/api/v1/cms/reviews',
  ]),
  requestSchema: z.literal([
    'EntryDraftDetailQuerySchema',
    'RevisionHistoryQuerySchema',
    'ConflictDetailQuerySchema',
    'EntryListQuerySchema',
    'AuthoringContextQuerySchema',
    'EntryWorkflowQuerySchema',
    'EditorialReviewDetailQuerySchema',
    'ReviewQueueQuerySchema',
  ]),
  successSchema: z.literal([
    'EntryDraftDetailResourceSchema',
    'RevisionHistoryPageSchema',
    'ConflictDetailResourceSchema',
    'EntryListPageSchema',
    'AuthoringContextResourceSchema',
    'EntryWorkflowResourceSchema',
    'EditorialReviewDetailResourceSchema',
    'ReviewQueuePageSchema',
  ]),
  successStatus: z.literal(200),
  outcome: z.literal('read'),
  rateClass: z.literal('cms-entry-read'),
  timeoutMs: z.literal(8_000),
  eventType: z.literal('none'),
});

/**
 * Runtime guard over the eighteen-operation discriminants. Each member keeps its
 * own exact literal set, so a row that reuses another outcome's value (a read
 * carrying a write rate class, a command on a read path, a 202 row answering
 * 201, or an omitted eventType) fails here as well as in the registry. The
 * object is not strict on purpose: it proves every listed discriminant and
 * tolerates the remaining row policy fields instead of duplicating the whole
 * contract.
 *
 * - requestSchema is required on every row because each route binds a request
 *   contract there, even the reads that also carry a pathParamsSchema.
 * - eventType keeps the explicit none member instead of allowing an absent key,
 *   so a safe read cannot silently inherit a command event type.
 * - Each Slice 11 command pins its own operation id, so the shape of CMS-03B-09
 *   (202, publish class, publication event) cannot be satisfied by a read id.
 */
export const policyShapeSchema = z.union([
  entryCommandShapeSchema,
  reviewSubmitShapeSchema,
  reviewDecisionShapeSchema,
  scheduleAcceptShapeSchema,
  previewMintShapeSchema,
  publishAcceptShapeSchema,
  assignmentShapeSchema,
  readShapeSchema,
]);
