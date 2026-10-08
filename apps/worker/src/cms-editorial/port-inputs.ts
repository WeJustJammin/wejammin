import type {
  AuthoringContextQuery,
  ConflictResolutionRequest,
  EntryCreateRequest,
  EntryDraftDetailQuery,
  EntryListQuery,
  EntryRevisionRequest,
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
