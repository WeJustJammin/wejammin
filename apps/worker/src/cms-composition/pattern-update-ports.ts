import type {
  CompositionInstancePage,
  CompositionUpdateDiffResource,
  CompositionUpdateRequest,
  CompositionUpdateResource,
  PatternSelectorPage,
  PatternSelectorQuery,
} from '@wejammin/contracts';

import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  failure,
  statusOf,
  validEnvelope,
  type CmsPatternInstanceError,
  type CmsPatternInstanceResult,
} from './pattern-instance-contracts';
import {
  PATTERN_UPDATE_OPERATIONS,
  type PatternUpdateOperation,
} from './pattern-update-operations';
import type { CompositionObservation } from './observability-observation';
import { validRateDecision } from './template-shared';

export { failure, statusOf, validEnvelope } from './pattern-instance-contracts';

/**
 * Ports of the linked-update Worker transport: the author-facing pattern selector (CMS-03C-13), the three-way diff of
 * one instance (CMS-03C-14) and the accept/detach command (CMS-03C-15). A port receives only what the route already
 * admitted (verified session, original Request, strict input); the actor, party and capability the database trusts are
 * rebuilt by the production adapter, never read from the browser.
 */
export type PatternUpdateError = CmsPatternInstanceError;
export type PatternUpdateResult<T> = CmsPatternInstanceResult<T>;

export type PatternUpdateContext = Readonly<{
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;
export type PatternSelectorInput = PatternUpdateContext &
  Readonly<{ operationId: 'CMS-03C-13'; query: PatternSelectorQuery }>;
export type PatternUpdateDiffInput = PatternUpdateContext &
  Readonly<{ operationId: 'CMS-03C-14'; instanceId: string }>;
/**
 * DEC-206: the entry whose current draft revision is listed, the opaque signed cursor of a later page (absent on the
 * first) and the page size (1-50, the default 25 already applied).
 */
export type CompositionInstancesInput = PatternUpdateContext &
  Readonly<{
    operationId: 'cmsCompositionInstancesRead';
    entryId: string;
    cursor?: string;
    limit: number;
  }>;
export type PatternUpdateInput = PatternUpdateContext &
  Readonly<{
    operationId: 'CMS-03C-15';
    body: CompositionUpdateRequest;
    idempotencyKey: string;
    /** The unquoted entry aggregate version of the strong `If-Match`; equals `body.expectedVersion`. */
    ifMatch: string;
  }>;
/** CMS-03C-15 answers the appended rows and forwards the committed entry aggregate strong ETag beside them. */
export type PatternUpdateOutcome =
  | Readonly<{ ok: true; value: CompositionUpdateResource; etag: string }>
  | PatternUpdateError;

export type PatternUpdateRateInput = Readonly<{
  operationId: PatternUpdateOperation;
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: (typeof PATTERN_UPDATE_OPERATIONS)[PatternUpdateOperation]['rateClass'];
  rateScope: 'user' | 'party';
  limit: number;
  windowSeconds: 60;
}>;
export type PatternUpdateRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type PatternUpdateTelemetry = Readonly<{
  operationId: PatternUpdateOperation;
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;

export type CmsPatternUpdateDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<CmsEditorialSession>>;
  rateLimit: (
    input: PatternUpdateRateInput,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<PatternUpdateRateDecision>>;
  readSelector: (
    input: PatternSelectorInput,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<PatternSelectorPage>>;
  readUpdateDiff: (
    input: PatternUpdateDiffInput,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<CompositionUpdateDiffResource>>;
  readInstances: (
    input: CompositionInstancesInput,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<CompositionInstancePage>>;
  applyUpdate: (
    input: PatternUpdateInput,
    signal: AbortSignal,
  ) => Promise<PatternUpdateOutcome>;
  telemetry: (event: PatternUpdateTelemetry) => void | Promise<void>;
}>;

/** A command outcome is an envelope whose success also carries the forwarded ETag text. */
export const validUpdateOutcome = (
  value: unknown,
): value is PatternUpdateOutcome =>
  validEnvelope<unknown>(value) &&
  (!value.ok || typeof (value as { etag?: unknown }).etag === 'string');

/** The verified human session of the original Request, or the refusal to answer with. */
export const patternUpdateSession = async (
  dependencies: CmsPatternUpdateDependencies,
  request: Request,
  signal: AbortSignal,
): Promise<PatternUpdateResult<CmsEditorialSession>> => {
  let session: PatternUpdateResult<CmsEditorialSession>;
  try {
    session = await dependencies.resolveSession(request, signal);
  } catch {
    return failure(503, {}, 15);
  }
  if (!validEnvelope<CmsEditorialSession>(session)) return failure(502);
  if (!session.ok) return session;
  if (session.value === null || typeof session.value !== 'object')
    return failure(401);
  const invalid = validHumanSession(session.value);
  return invalid === null ? session : failure(statusOf(invalid.status));
};

/**
 * BE00 step 7 after strict input parsing: the route capability (an author or editor in an acting party; the designer
 * capability alone is not enough), then both quota buckets, user before party, each keyed by its own identity. A caller
 * without the capability consumes no quota.
 */
export const patternUpdateAdmission = async (
  dependencies: CmsPatternUpdateDependencies,
  operationId: PatternUpdateOperation,
  request: Request,
  session: CmsEditorialSession,
  signal: AbortSignal,
): Promise<PatternUpdateError | null> => {
  if (
    session.actingPartyId === null ||
    !session.capabilities.some(
      (capability) =>
        capability === 'cms.author' || capability === 'cms.editor',
    )
  )
    return failure(403, { reasonCode: 'capability_missing' });
  const spec = PATTERN_UPDATE_OPERATIONS[operationId];
  for (const rateScope of ['user', 'party'] as const) {
    if (signal.aborted) return failure(504, {}, 15);
    const limit = rateScope === 'user' ? spec.user : spec.party;
    let rate: PatternUpdateResult<PatternUpdateRateDecision>;
    try {
      rate = await dependencies.rateLimit(
        {
          operationId,
          request,
          actorId:
            rateScope === 'user' ? session.userId : session.actingPartyId,
          actingPartyId: session.actingPartyId,
          principalClass: 'human',
          rateClass: spec.rateClass,
          rateScope,
          limit,
          windowSeconds: 60,
        },
        signal,
      );
    } catch {
      return failure(503, {}, 15);
    }
    if (!validEnvelope<PatternUpdateRateDecision>(rate)) return failure(502);
    if (!rate.ok) return rate;
    if (!validRateDecision(rate.value, limit)) return failure(502);
    if (!rate.value.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(rate.value.resetAt - dependencies.now() / 1000),
      );
      return failure(
        429,
        { retryAfterSeconds, limit, resetAt: String(rate.value.resetAt) },
        retryAfterSeconds,
      );
    }
  }
  return signal.aborted ? failure(504, {}, 15) : null;
};
