import type {
  CmsEditorialErrorStatus,
  CmsEditorialOperationId,
  CmsEditorialRoutePolicy,
  ConflictResolutionRequest,
  EntryCreateRequest,
  EntryCreateResource,
  EntryDraftDetailQuery,
  EntryDraftDetailResource,
  EntryRevisionRequest,
  EntryRevisionResource,
  RevisionHistoryPage,
  RevisionHistoryQuery,
  RevisionRestoreRequest,
  RevisionRestoreVerification,
} from '@wejammin/contracts';

/**
 * CMS editorial workbench dependency surface (BE03b 03b-01).
 *
 * The feature owns no I/O of its own: every trust decision arrives through an
 * injected seam so the route can fail closed when production wiring is absent
 * and so route tests never need a database or a real Supabase session.
 */

/** Stable scrubbed identifier for the operational runbook. */
export const CMS_EDITORIAL_RUNBOOK = 'cms-editorial' as const;

/** The single protected command this slice implements. */
export const CMS_EDITORIAL_REVISION_OPERATION_ID =
  'CMS-03B-01' as const satisfies CmsEditorialOperationId;

export const CMS_EDITORIAL_HISTORY_OPERATION_ID =
  'CMS-03B-03' as const satisfies CmsEditorialOperationId;

export const CMS_EDITORIAL_CONFLICT_OPERATION_ID =
  'CMS-03B-02' as const satisfies CmsEditorialOperationId;

export const CMS_EDITORIAL_CREATE_OPERATION_ID =
  'CMS-03B-10' as const satisfies CmsEditorialOperationId;

export const CMS_EDITORIAL_RESTORE_OPERATION_ID =
  'CMS-03B-04' as const satisfies CmsEditorialOperationId;

export const CMS_EDITORIAL_DRAFT_DETAIL_OPERATION_ID =
  'CMS-03B-11' as const satisfies CmsEditorialOperationId;

/** Trusted, server-derived session facts. Never read from browser input. */
export type CmsEditorialSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

/** Canonical dependency failure shape consumed by the route error mapper. */
export type CmsEditorialError = Readonly<{
  ok: false;
  status: CmsEditorialErrorStatus;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

export type CmsEditorialResult<T> =
  Readonly<{ ok: true; value: T }> | CmsEditorialError;

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

/**
 * Internal-only restore result. The restored EntryRevisionResource stays the
 * public response body; the trusted restore evidence rides beside it on this
 * private port until the owner-backed restore RPC exists. The port must prove
 * the evidence, so the field is required.
 */
export type CmsEditorialRestorePortResult = Readonly<{
  resource: EntryRevisionResource;
  restoreVerification: RevisionRestoreVerification;
}>;

/**
 * Persistence ports. Members are named for the RPC they bind
 * (`appendRevision` -> `cms_create_revision`); the create and draft-detail
 * lanes add `createEntry` -> `cms_create_entry` and `getEntryDraft` ->
 * `cms_get_entry_draft` without changing this shape.
 */
export type CmsEditorialPorts = Readonly<{
  appendRevision: (
    input: CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<EntryRevisionResource>>;
  resolveConflict?: (
    input: CmsEditorialConflictPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<EntryRevisionResource>>;
  createEntry?: (
    input: CmsEditorialCreatePortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<EntryCreateResource>>;
  restoreRevision?: (
    input: CmsEditorialRestorePortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<CmsEditorialRestorePortResult>>;
  listRevisions?: (
    input: CmsEditorialHistoryPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<RevisionHistoryPage>>;
  getEntryDraft?: (
    input: CmsEditorialDraftPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialResult<EntryDraftDetailResource>>;
}>;

export type CmsEditorialRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type CmsEditorialRateLimitInput = Readonly<{
  operationId:
    | 'CMS-03B-01'
    | 'CMS-03B-02'
    | 'CMS-03B-03'
    | 'CMS-03B-04'
    | 'CMS-03B-10'
    | 'CMS-03B-11';
  request: Request;
  /**
   * The bucket identity. For `rateScope: 'user'` this is the acting user; for
   * `rateScope: 'party'` it is the acting party id (BE03b line 925 keys rate
   * buckets by actor AND acting party, so the party is the party-bucket key).
   */
  actorId: string;
  actingPartyId: string | null;
  principalClass: 'human';
  rateClass: string;
  /** The limit for THIS scope: 120 for `user`, 240 for `party` in BE03b. */
  limit: number;
  windowSeconds: number;
  /**
   * Required. BE03b CMS-03B-01 enforces two independent buckets
   * (120/min/user and 240/min/party), so a single user-keyed call can never
   * stand in for the party quota. The route calls the seam once per scope and
   * the limiter enforces exactly the named scope.
   */
  rateScope: 'user' | 'party';
}>;

export type CmsEditorialRateLimit = (
  input: CmsEditorialRateLimitInput,
  signal: AbortSignal,
) => Promise<CmsEditorialResult<CmsEditorialRateLimitDecision>>;

export type CmsEditorialResolveSession = (
  request: Request,
  signal: AbortSignal,
) => Promise<CmsEditorialResult<CmsEditorialSession>>;

/**
 * Redacted operational event. The shape carries no entry, actor, party, field,
 * or field-value identifiers, so a telemetry sink can never become the leak.
 */
export type CmsEditorialTelemetryEvent = Readonly<{
  operationId: CmsEditorialOperationId;
  requestId: string;
  correlationId?: string;
  outcome: 'success' | 'rejected' | 'failure';
  status: number;
  errorCode?: string;
  durationMs: number;
  actorClass: 'human';
  rateClass?: string;
  rateLimit?: number;
  rateWindowSeconds?: number;
  deadlineMs?: number;
  eventType?: string;
  slo?: CmsEditorialRoutePolicy['slo'];
  runbook: string;
  traceSteps?: readonly string[];
  metrics?: Readonly<Record<string, number>>;
}>;

export type CmsEditorialTelemetry = (
  event: CmsEditorialTelemetryEvent,
) => void | Promise<void>;

/**
 * The complete injected surface. Only `humanOrigins` is trusted for CORS:
 * these routes are browser-only and carry no release envelope, so no
 * `verifyRelease` seam exists.
 */
export type CmsEditorialDependencies = Readonly<{
  ports: CmsEditorialPorts;
  resolveSession: CmsEditorialResolveSession;
  rateLimit: CmsEditorialRateLimit;
  humanOrigins: readonly string[];
  now?: () => number;
  deadlineMs?: number;
  telemetry?: CmsEditorialTelemetry;
}>;
