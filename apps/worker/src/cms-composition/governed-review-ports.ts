import {
  CMS_03C_CATALOGS,
  cmsCompositionCatalogMessage,
  type GovernedActivationResource,
  type GovernedReviewAssignmentResource,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewResource,
} from '@wejammin/contracts';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import type { CmsEditorialSession } from '../cms-editorial/types';
import type { CompositionObservation } from './observability-observation';
import type {
  GovernedActivationInput,
  GovernedAssignmentInput,
  GovernedDecisionInput,
  GovernedDetailInput,
  GovernedQueueInput,
  GovernedSubmitInput,
} from './governed-review-inputs';
import { validHumanSession } from '../cms-editorial/admission-identity';
import {
  policyOf,
  type GovernedOperation,
  type GovernedRateClass,
} from './governed-review-policy';
import {
  validEnvelope,
  validRateDecision,
  type CmsTemplateError,
  type CmsTemplateResult,
  type CmsTemplateRateDecision,
} from './template-shared';

export { serializedBytesWithin } from './pattern-instance-contracts';
export { validEnvelope } from './template-shared';
export type { GovernedOperation } from './governed-review-policy';
export type {
  GovernedActivationInput,
  GovernedAssignmentInput,
  GovernedDecisionInput,
  GovernedDetailInput,
  GovernedPortContext,
  GovernedPortInput,
  GovernedQueueInput,
  GovernedSubmitInput,
} from './governed-review-inputs';

/** BE03b/BE00 request and response ceiling shared by every governed-review route. */
export const GOVERNED_MAX_BYTES = 262_144;
/** BE03c row 168: the route deadline is 15,000ms. */
export const GOVERNED_DEADLINE_MS = 15_000;

export type GovernedError = CmsTemplateError;
export type GovernedResult<T> = CmsTemplateResult<T>;
export type GovernedStatus = GovernedError['status'];

/** The 401 a missing or stale recent MFA answers on CMS-03C-07 and -08 (BE03c 216). */
export const stepUpRequired = (): GovernedError => ({
  ok: false,
  status: 401,
  code: 'STEP_UP_REQUIRED',
  message: cmsCompositionCatalogMessage('governedReview', 'STEP_UP_REQUIRED'),
  details: { recoveryAction: 'step_up' },
});

const catalogCodes: Readonly<Record<number, string>> =
  CMS_03C_CATALOGS.governedReview.codes;

/** A local refusal in the `governed-review` catalog; the response re-derives the code. */
export const failure = (
  status: GovernedStatus,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): GovernedError => {
  const code = catalogCodes[status] as string;
  return {
    ok: false,
    status,
    code,
    message: cmsCompositionCatalogMessage('governedReview', code),
    details,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};

/** Smallest fail-closed catalog envelope, with the fixed UUID request-id width. */
export const GOVERNED_MIN_RESPONSE_BYTES = new TextEncoder().encode(
  JSON.stringify({
    code: 'INTERNAL_ERROR',
    message: cmsCompositionCatalogMessage('governedReview', 'INTERNAL_ERROR'),
    requestId: '00000000-0000-4000-8000-000000000000',
    details: {},
  }),
).byteLength;

export const governedResponseLimit = (value = GOVERNED_MAX_BYTES): number => {
  if (!Number.isSafeInteger(value) || value < GOVERNED_MIN_RESPONSE_BYTES)
    throw new Error('Invalid CMS governed review response budget.');
  return Math.min(value, GOVERNED_MAX_BYTES);
};

export type GovernedRateInput = Readonly<{
  operationId: GovernedOperation;
  request: Request;
  actorId: string;
  actingPartyId: string | null;
  principalClass: 'human';
  rateClass: GovernedRateClass;
  rateScope: 'user' | 'party';
  limit: number;
  windowSeconds: 60;
}>;
/**
 * The closed facts a CMS-03C-09 request is counted under (BE03c Observability
 * `cms_governed_activation_total{subject_kind,action,outcome}`): the requested action once the body
 * is decoded, and the subject kind only when a verified success names it (`unknown` otherwise).
 */
export type GovernedActivationFacts = Readonly<{
  action: GovernedActivationResource['action'];
  subjectKind: GovernedActivationResource['subjectKind'] | 'unknown';
}>;
/** Written by a route while it runs, read when its telemetry is emitted. */
export type GovernedRouteFacts = { activation?: GovernedActivationFacts };
export type GovernedTelemetry = Readonly<{
  operationId: GovernedOperation;
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  activation?: GovernedActivationFacts;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;
type Port<Input, Output> = (
  input: Input,
  signal: AbortSignal,
) => Promise<GovernedResult<Output>>;
export type CmsGovernedReviewDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  maxResponseBytes?: number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<GovernedResult<CmsEditorialSession>>;
  rateLimit: (
    input: GovernedRateInput,
    signal: AbortSignal,
  ) => Promise<GovernedResult<CmsTemplateRateDecision>>;
  submitReview: Port<GovernedSubmitInput, GovernedReviewResource>;
  recordDecision: Port<GovernedDecisionInput, GovernedReviewResource>;
  assignReviewer: Port<
    GovernedAssignmentInput,
    GovernedReviewAssignmentResource
  >;
  activateReview: Port<GovernedActivationInput, GovernedActivationResource>;
  readReview: Port<GovernedDetailInput, GovernedReviewDetailResource>;
  listReviews: Port<GovernedQueueInput, GovernedReviewQueuePage>;
  telemetry: (event: GovernedTelemetry) => void | Promise<void>;
  /** CMS-03C-09 schedule: the pinned Time authority (BE03b E8); unset means the committed snapshot. */
  timeAuthority?: () => Promise<TimeAuthority | null>;
}>;

/** Verified session proof: a malformed or thrown resolver result fails closed. */
export const governedSession = async (
  dependencies: CmsGovernedReviewDependencies,
  request: Request,
  signal: AbortSignal,
): Promise<GovernedResult<CmsEditorialSession>> => {
  try {
    const session = await dependencies.resolveSession(request, signal);
    if (!validEnvelope<CmsEditorialSession>(session)) return failure(502);
    if (!session.ok) return session;
    if (session.value === null || typeof session.value !== 'object')
      return failure(401);
    return validHumanSession(session.value) ?? session;
  } catch {
    return failure(503, {}, 15);
  }
};

/**
 * The coarse Worker gate of an operation (registry `capabilities`, then recent MFA):
 * the any-of owner or reviewer capability first, then the unconditional step-up of
 * CMS-03C-07/-08. Anything finer (subject kind, assignment, receipt-derived owner) is
 * a database decision, because a Worker-side check there would turn the hidden-review
 * 404 into a 403 (BE03c 1467).
 */
export const governedGate = (
  operation: GovernedOperation,
  session: Pick<
    CmsEditorialSession,
    'actingPartyId' | 'capabilities' | 'mfaFresh'
  >,
): GovernedError | null => {
  const policy = policyOf(operation);
  if (policy.requiresParty && session.actingPartyId === null)
    return failure(403, { reasonCode: 'capability_missing' });
  if (
    policy.capabilities.length > 0 &&
    !policy.capabilities.some((capability) =>
      session.capabilities.includes(capability),
    )
  )
    return failure(403, { reasonCode: 'capability_missing' });
  return policy.stepUp && !session.mfaFresh ? stepUpRequired() : null;
};

/**
 * Both quotas, user then party, from the registry limits. A session without an acting
 * party has no party bucket; the database then decides whether the party is required.
 */
export const governedQuota = async (
  dependencies: CmsGovernedReviewDependencies,
  operation: GovernedOperation,
  request: Request,
  session: CmsEditorialSession,
  signal: AbortSignal,
): Promise<GovernedError | null> => {
  const policy = policyOf(operation);
  for (const rateScope of ['user', 'party'] as const) {
    if (rateScope === 'party' && session.actingPartyId === null) continue;
    if (signal.aborted) return failure(504, {}, 15);
    const limit = rateScope === 'user' ? policy.userLimit : policy.partyLimit;
    try {
      const rate = await dependencies.rateLimit(
        {
          operationId: operation,
          request,
          actorId:
            rateScope === 'user'
              ? session.userId
              : (session.actingPartyId as string),
          actingPartyId: session.actingPartyId,
          principalClass: 'human',
          rateScope,
          rateClass: policy.rateClass,
          limit,
          windowSeconds: policy.windowSeconds,
        },
        signal,
      );
      if (!validEnvelope<CmsTemplateRateDecision>(rate)) return failure(502);
      if (!rate.ok) return rate;
      // The helper types its limit as the template quotas; it compares by value.
      if (
        !validRateDecision(
          rate.value,
          limit as Parameters<typeof validRateDecision>[1],
        )
      )
        return failure(502);
      if (!rate.value.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          rate.value.resetAt - Math.floor(dependencies.now() / 1000),
        );
        return failure(
          429,
          { retryAfterSeconds, limit, resetAt: String(rate.value.resetAt) },
          retryAfterSeconds,
        );
      }
    } catch {
      return failure(503, {}, 15);
    }
  }
  return signal.aborted ? failure(504, {}, 15) : null;
};

/** Run after strict input parsing: the gate precedes both quotas (BE03c 1502). */
export const governedAdmission = async (
  dependencies: CmsGovernedReviewDependencies,
  operation: GovernedOperation,
  request: Request,
  session: CmsEditorialSession,
  signal: AbortSignal,
): Promise<GovernedError | null> =>
  governedGate(operation, session) ??
  (await governedQuota(dependencies, operation, request, session, signal));
