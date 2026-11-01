import type {
  AuthoringContextQuery,
  ConflictResolutionRequest,
  EditorialDecisionRequest,
  EditorialReviewAssignmentRequest,
  EntryCreateRequest,
  EntryDraftDetailQuery,
  EntryListQuery,
  EntryRevisionRequest,
  EntryWorkflowQuery,
  PreflightEvidence,
  PreviewRequest,
  PublicationRequest,
  PublicationScheduleRequest,
  ReviewQueueQuery,
  ReviewSubmissionRequest,
  RevisionHistoryQuery,
  RevisionRestoreRequest,
} from '@wejammin/contracts';

/**
 * Trusted session facts and the per-operation port inputs of the CMS editorial
 * workbench (BE03b 03b-01). Every input carries the server-derived session,
 * the validated path/query/body for exactly one operation, and never a
 * browser-supplied actor, owner, assignee, capability, or version.
 */

/** Trusted, server-derived session facts. Never read from browser input. */
export type CmsEditorialSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

/**
 * Canonical port input. `entryId` is bound from the path, so `body` stays the
 * exact validated `EntryRevisionRequest` (including its `entryId`) and `ifMatch`
 * carries the bare decimal version with the strong-ETag quotes already stripped.
 */
export type CmsEditorialPortInput = Readonly<{
  operationId: 'CMS-03B-01';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  body: EntryRevisionRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

export type CmsEditorialHistoryPortInput = Readonly<{
  operationId: 'CMS-03B-03';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  query: RevisionHistoryQuery;
}>;

export type CmsEditorialConflictPortInput = Readonly<{
  operationId: 'CMS-03B-02';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string; conflictId: string }>;
  body: ConflictResolutionRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

export type CmsEditorialDraftPortInput = Readonly<{
  operationId: 'CMS-03B-11';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  query: EntryDraftDetailQuery;
}>;

export type CmsEditorialCreatePortInput = Readonly<{
  operationId: 'CMS-03B-10';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  body: EntryCreateRequest;
  idempotencyKey: string;
}>;

export type CmsEditorialRestorePortInput = Readonly<{
  operationId: 'CMS-03B-04';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string; revisionId: string }>;
  body: RevisionRestoreRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

export type CmsEditorialConflictDetailPortInput = Readonly<{
  operationId: 'CMS-03B-12';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string; conflictId: string }>;
}>;

export type CmsEditorialEntryListPortInput = Readonly<{
  operationId: 'CMS-03B-13';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  query: EntryListQuery;
}>;

export type CmsEditorialAuthoringContextPortInput = Readonly<{
  operationId: 'CMS-03B-14';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  query: AuthoringContextQuery;
}>;

/**
 * Slice 11 review, schedule, preview, publication and workflow-read inputs.
 * `evidence` is the server-built accessibility `PreflightEvidence` (or null when
 * the in-process checker could not produce any): never a browser member, and the
 * database reports an absent proof as an unavailable `accessibility` provider.
 */
export type CmsEditorialSubmitReviewPortInput = Readonly<{
  operationId: 'CMS-03B-05';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  body: ReviewSubmissionRequest;
  idempotencyKey: string;
  ifMatch: string;
  evidence: PreflightEvidence | null;
}>;

export type CmsEditorialDecisionPortInput = Readonly<{
  operationId: 'CMS-03B-06';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ reviewId: string }>;
  body: EditorialDecisionRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

export type CmsEditorialSchedulePortInput = Readonly<{
  operationId: 'CMS-03B-07';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  body: PublicationScheduleRequest;
  idempotencyKey: string;
  ifMatch: string;
  evidence: PreflightEvidence | null;
}>;

export type CmsEditorialPreviewPortInput = Readonly<{
  operationId: 'CMS-03B-08';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  body: PreviewRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

export type CmsEditorialPublishPortInput = Readonly<{
  operationId: 'CMS-03B-09';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  body: PublicationRequest;
  idempotencyKey: string;
  ifMatch: string;
  evidence: PreflightEvidence | null;
}>;

export type CmsEditorialWorkflowPortInput = Readonly<{
  operationId: 'CMS-03B-15';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  query: EntryWorkflowQuery;
  evidence: PreflightEvidence | null;
}>;

export type CmsEditorialReviewDetailPortInput = Readonly<{
  operationId: 'CMS-03B-16';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ reviewId: string }>;
}>;

export type CmsEditorialReviewQueuePortInput = Readonly<{
  operationId: 'CMS-03B-17';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  query: ReviewQueueQuery;
}>;

export type CmsEditorialAssignmentPortInput = Readonly<{
  operationId: 'CMS-03B-18';
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  path: Readonly<{ reviewId: string }>;
  body: EditorialReviewAssignmentRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;
