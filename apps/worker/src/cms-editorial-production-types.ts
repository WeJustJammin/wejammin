import type { ServerEnvironment } from '@wejammin/config/environment';

import type {
  CmsEditorialOperationId,
  CmsEditorialRoutePolicy,
} from '@wejammin/contracts';

import type { Logger } from '@wejammin/observability/logging';

import type { AuthenticationDependencies } from './authentication/types';

/** BE03b editorial operations reachable through the protected RPC transport. */
export const CMS_EDITORIAL_PRODUCTION_OPERATION_IDS = [
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-03',
  'CMS-03B-04',
  'CMS-03B-10',
  'CMS-03B-11',
  'CMS-03B-12',
  'CMS-03B-13',
  'CMS-03B-14',
] as const;

export type CmsEditorialProductionOperationId =
  (typeof CMS_EDITORIAL_PRODUCTION_OPERATION_IDS)[number];

/**
 * Named server-side RPCs from the BE03b persisted-model boundary. The browser
 * never selects one: the route handler binds each operation to its RPC.
 */
export const CMS_EDITORIAL_RPC = {
  'CMS-03B-01': 'cms_create_revision',
  'CMS-03B-02': 'cms_resolve_conflict',
  'CMS-03B-03': 'cms_list_revisions',
  'CMS-03B-04': 'cms_restore_revision',
  'CMS-03B-10': 'cms_create_entry',
  'CMS-03B-11': 'cms_get_entry_draft',
  'CMS-03B-12': 'cms_get_conflict_detail',
  'CMS-03B-13': 'cms_list_entries',
  'CMS-03B-14': 'cms_get_entry_authoring_context',
} as const satisfies Readonly<
  Record<CmsEditorialProductionOperationId, string>
>;

export const MAX_DEFAULT_RESPONSE_BYTES = 256 * 1024;
export const DEFAULT_DEADLINE_MS = 15_000;
export const MAX_ORIGIN_LENGTH = 2048;

/**
 * Declared per-operation budgets. A read is bounded far tighter than a write,
 * so the transport deadline is not a single global value.
 */
export const CMS_EDITORIAL_DEADLINE_MS = {
  'CMS-03B-01': 15_000,
  'CMS-03B-02': 15_000,
  'CMS-03B-03': 8_000,
  'CMS-03B-04': 15_000,
  'CMS-03B-10': 15_000,
  'CMS-03B-11': 8_000,
  'CMS-03B-12': 8_000,
  'CMS-03B-13': 8_000,
  'CMS-03B-14': 8_000,
} as const satisfies Readonly<
  Record<CmsEditorialProductionOperationId, number>
>;

export const CMS_EDITORIAL_RATE_LIMIT = {
  'CMS-03B-01': { limit: 120, partyLimit: 240, windowSeconds: 60 },
  'CMS-03B-02': { limit: 60, partyLimit: 120, windowSeconds: 60 },
  'CMS-03B-03': { limit: 300, partyLimit: 600, windowSeconds: 60 },
  'CMS-03B-04': { limit: 30, partyLimit: 60, windowSeconds: 60 },
  'CMS-03B-10': { limit: 120, partyLimit: 240, windowSeconds: 60 },
  'CMS-03B-11': { limit: 300, partyLimit: 600, windowSeconds: 60 },
  'CMS-03B-12': { limit: 300, partyLimit: 600, windowSeconds: 60 },
  'CMS-03B-13': { limit: 300, partyLimit: 600, windowSeconds: 60 },
  'CMS-03B-14': { limit: 300, partyLimit: 600, windowSeconds: 60 },
} as const;

/** BE03b abuse-control classes; a read shares no bucket with an entry write. */
export const CMS_EDITORIAL_RATE_CLASS = {
  'CMS-03B-01': 'cms-entry-write',
  'CMS-03B-02': 'cms-entry-conflict',
  'CMS-03B-03': 'cms-entry-read',
  'CMS-03B-04': 'cms-entry-write',
  'CMS-03B-10': 'cms-entry-write',
  'CMS-03B-11': 'cms-entry-read',
  'CMS-03B-12': 'cms-entry-read',
  'CMS-03B-13': 'cms-entry-read',
  'CMS-03B-14': 'cms-entry-read',
} as const satisfies Readonly<
  Record<CmsEditorialProductionOperationId, string>
>;

/** Stable scrubbed identifier for the editorial on-call runbook. */
export const CMS_EDITORIAL_RUNBOOK = 'cms-editorial' as const;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const HASH_PATTERN = /^[a-f0-9]{64}$/u;

/**
 * The exact strong bare-decimal version the RPC compares. BE03b (lines
 * 135/165/203) requires an exact strong If-Match validator, so a weak
 * (`W/"1"`), quoted, zero, or leading-zero value is rejected rather than
 * normalized into an equivalent.
 */
export const BARE_VERSION_PATTERN = /^[1-9]\d{0,18}$/u;

/**
 * Caller-supplied authority keys that BE03b forbids on the editorial routes.
 * Authority is always server-derived, so any of these keys makes the request a
 * 422 rejection instead of being stripped. `expectedVersion` is a legitimate
 * required body field and is forwarded, never listed here.
 */
export const CMS_EDITORIAL_FORBIDDEN_AUTHORITY_KEYS = [
  'owner',
  'ownerId',
  'owner_id',
  'assignee',
  'assigneePersonId',
  'assignee_person_id',
  'author',
  'authorId',
  'authorPersonId',
  'author_person_id',
  'actingPartyId',
  'acting_party_id',
  'capability',
  'capabilities',
  'authority',
  'ownerPartyId',
  'createdBy',
  'created_by',
  'baseVersion',
  'context',
  'stepUpAt',
  'step_up_at',
  'actingParty',
  'acting_party',
] as const;

/** Server-derived session and acting context; browsers never supply these. */
export type CmsEditorialSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

export type CmsEditorialServerSessionContext = Readonly<{
  authUserId: string;
  sessionId: string;
  actorPersonId: string | null;
  actingPartyId: string | null;
  stepUpAt: string | null;
}>;

/** BE00 rate-limit decision surface mirrored from the auth dependency. */
export type CmsEditorialRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

/**
 * Rate seam for the editorial lane. 03b is human-only, so `principalClass` is
 * pinned to `human` and there is no release-worker bucket to key against.
 */
export type CmsEditorialRateLimitInput = Readonly<{
  // Restore consumes a quota before its migration-chain RPC is wired.
  operationId:
    | CmsEditorialProductionOperationId
    | 'CMS-03C-01'
    | 'CMS-03C-02'
    | 'CMS-03C-03'
    | 'CMS-03C-04'
    | 'CMS-03C-05'
    | 'cmsTemplateContextRead'
    | 'cmsTemplateLatestRead';
  request: Request;
  /**
   * The bucket identity for THIS scope. For `user` it is the acting user id;
   * for `party` it is the acting party id, because BE03b keys the party quota
   * by acting party rather than by user.
   */
  actorId: string;
  actingPartyId: string | null;
  principalClass: 'human';
  rateClass: string;
  limit: number;
  windowSeconds: number;
  /**
   * Required. BE03b CMS-03B-01 enforces two independent buckets (120/min/user
   * and 240/min/party), so the limiter must enforce exactly the named scope and
   * key it by its own bucket identity. A single user-keyed call can never stand
   * in for the party quota.
   */
  rateScope: 'user' | 'party';
}>;

export type CmsEditorialProductionError = Readonly<{
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

/**
 * A success may carry `replayed`: the database answered an exact-key replay
 * with the original committed outcome (response header
 * `x-cms-idempotent-replay: true`). It never reaches a client; telemetry uses
 * it so a replay is not counted as a second creation.
 */
export type CmsEditorialProductionResult<T> =
  | Readonly<{ ok: true; value: T; replayed?: true }>
  | CmsEditorialProductionError;

export type CmsEditorialProductionConfiguration = Readonly<{
  baseUrl: string;
  secret: string;
  fetchImpl: typeof fetch;
  maxResponseBytes: number;
  now: () => number;
}>;

export type CmsEditorialProductionOptions = Readonly<{
  environment: ServerEnvironment;
  fetchImpl?: typeof fetch;
  auth?: Pick<AuthenticationDependencies, 'resolveSession'> &
    Partial<Pick<AuthenticationDependencies, 'rateLimit'>>;
  /** Direct server session seam for focused composition tests. */
  resolveSession?: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsEditorialProductionResult<CmsEditorialSession>>;
  resolveCapabilities?:
    | readonly string[]
    | ((
        session: import('./authentication/types').AuthenticationSession,
        request: Request,
        env: ServerEnvironment,
        signal: AbortSignal,
      ) => readonly string[] | Promise<readonly string[]>);
  /** Direct rate seam for focused composition tests. */
  rateLimit?: (
    input: CmsEditorialRateLimitInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialProductionResult<CmsEditorialRateLimitDecision>>;
  humanOrigins?: readonly string[];
  maxResponseBytes?: number;
  deadlineMs?: number;
  now?: () => number;
  telemetry?: (event: CmsEditorialTelemetryEvent) => void | Promise<void>;
  logger?: Logger;
}>;

export type CmsEditorialTelemetryEvent = Readonly<{
  /**
   * The full editorial operation union, not just the RPC-backed subset this
   * adapter serves. Telemetry is a sink: the route may emit for any editorial
   * operation, so narrowing the accepted event here would make the composed
   * dependency unassignable to `CmsEditorialDependencies` and silently leave
   * pages on the 503 fallback.
   */
  operationId: CmsEditorialOperationId;
  requestId: string;
  correlationId?: string;
  outcome: 'success' | 'rejected' | 'failure';
  status: number;
  errorCode?: string;
  durationMs: number;
  /**
   * 03b is browser/editor-only and human-only, so the route's frozen event type
   * admits only `human`. This event must stay assignable to
   * `CmsEditorialDependencies['telemetry']`; widening it past the route's own
   * union makes the composed bundle unassignable and leaves pages on 503.
   */
  actorClass: 'human';
  rateClass?: string;
  rateLimit?: number;
  rateWindowSeconds?: number;
  deadlineMs?: number;
  alertClass?: string;
  alertRoute?: string;
  /**
   * Required, matching the route's frozen event: the route always names the
   * on-call runbook, so the sink must accept it as present rather than optional.
   * `alertClass`/`alertRoute` stay adapter-local extras for the default sink.
   */
  runbook: string;
  traceSteps?: readonly string[];
  metrics?: Readonly<Record<string, number>>;
  /** Route-built context; optional so any sink stays assignable. */
  eventType?: string;
  slo?: CmsEditorialRoutePolicy['slo'];
  traceId?: string;
  actingContextClass?: 'none' | 'party';
  retryable?: boolean;
  dependency?: string;
  entityIdHash?: string;
  entityVersion?: string;
}>;

export class CmsEditorialProductionConfigurationError extends Error {
  constructor(message = 'Invalid cms editorial production configuration') {
    super(message);
    this.name = 'CmsEditorialProductionConfigurationError';
  }
}
