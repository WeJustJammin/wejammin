import type { CompositionObservation } from './observability-observation';
import {
  cmsCompositionCatalogMessage,
  PatternVersionDetailSchema,
  PatternVersionResourceSchema,
  type PatternVersionRequest,
  type PatternVersionResource,
  type PatternVersionDetail,
} from '@wejammin/contracts';
import type { CmsEditorialSession } from '../cms-editorial/types';
import { validHumanSession } from '../cms-editorial/admission-identity';
import {
  validEnvelope,
  validRateDecision,
  type CmsTemplateError,
  type CmsTemplateResult,
  type CmsTemplateRateDecision,
} from './template-shared';
import { failure } from './pattern-instance-contracts';

export { failure, serializedBytesWithin } from './pattern-instance-contracts';
export { validEnvelope } from './template-shared';
export const PATTERN_MAX_BYTES = 262_144;
/** Smallest fail-closed catalog envelope, with the fixed UUID request-id width. */
export const PATTERN_MIN_RESPONSE_BYTES = new TextEncoder().encode(
  JSON.stringify({
    code: 'INTERNAL_ERROR',
    message: cmsCompositionCatalogMessage('composition', 'INTERNAL_ERROR'),
    requestId: '00000000-0000-4000-8000-000000000000',
    details: {},
  }),
).byteLength;
export const patternResponseLimit = (value = PATTERN_MAX_BYTES): number => {
  if (!Number.isSafeInteger(value) || value < PATTERN_MIN_RESPONSE_BYTES)
    throw new Error('Invalid CMS pattern definition response budget.');
  return Math.min(value, PATTERN_MAX_BYTES);
};
export const PATTERN_DEADLINE_MS = 15_000;
export type PatternOperation = 'CMS-03C-12' | 'cmsPatternLatestRead';
export type PatternError = CmsTemplateError;
export type PatternResult<T> = CmsTemplateResult<T>;
export type PatternPortContext = Readonly<{
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;
export type PatternWriteInput = PatternPortContext &
  Readonly<{
    operationId: 'CMS-03C-12';
    body: PatternVersionRequest;
    idempotencyKey: string;
    ifMatch: string | null;
  }>;
export type PatternLatestInput = PatternPortContext &
  Readonly<{
    operationId: 'cmsPatternLatestRead';
    patternKey: string;
  }>;
export type PatternRateInput = Readonly<{
  operationId: PatternOperation;
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-pattern-write' | 'cms-pattern-read';
  rateScope: 'user' | 'party';
  limit: 30 | 60;
  windowSeconds: 60;
}>;
export type PatternTelemetry = Readonly<{
  operationId: PatternOperation;
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;
export type CmsPatternDefinitionDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  maxResponseBytes?: number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<PatternResult<CmsEditorialSession>>;
  rateLimit: (
    input: PatternRateInput,
    signal: AbortSignal,
  ) => Promise<PatternResult<CmsTemplateRateDecision>>;
  definePattern: (
    input: PatternWriteInput,
    signal: AbortSignal,
  ) => Promise<PatternResult<PatternVersionResource>>;
  readLatest: (
    input: PatternLatestInput,
    signal: AbortSignal,
  ) => Promise<PatternResult<PatternVersionDetail>>;
  telemetry: (event: PatternTelemetry) => void | Promise<void>;
}>;

/** Definition versions, not private lifecycle counters, bind every response. */
export const validPatternDraft = (
  value: unknown,
  body: PatternVersionRequest,
): value is PatternVersionResource => {
  const parsed = PatternVersionResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const resource = parsed.data;
  return (
    resource.state === 'draft' &&
    resource.patternKey === body.patternKey &&
    resource.version === String(resource.patternVersion) &&
    BigInt(resource.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
    resource.compatibleTypeIds.join('\u0000') ===
      body.compatibleTypeIds.join('\u0000') &&
    (body.blockRegistryDigest === undefined ||
      resource.blockRegistryDigest === body.blockRegistryDigest)
  );
};
export const validPatternDetail = (
  value: unknown,
  key: string,
): value is PatternVersionDetail => {
  const parsed = PatternVersionDetailSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.patternKey === key &&
    parsed.data.version === String(parsed.data.patternVersion)
  );
};

export const patternSession = async (
  dependencies: CmsPatternDefinitionDependencies,
  request: Request,
  signal: AbortSignal,
): Promise<PatternResult<CmsEditorialSession>> => {
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

/** Run after strict input parsing; capability and party precede both quotas. */
export const patternAdmission = async (
  dependencies: CmsPatternDefinitionDependencies,
  operationId: PatternOperation,
  request: Request,
  session: CmsEditorialSession,
  signal: AbortSignal,
): Promise<PatternError | null> => {
  if (
    session.actingPartyId === null ||
    !session.capabilities.includes('cms.template_designer')
  )
    return failure(403, { reasonCode: 'capability_missing' });
  for (const rateScope of ['user', 'party'] as const) {
    if (signal.aborted) return failure(504, {}, 15);
    const limit =
      operationId === 'CMS-03C-12' && rateScope === 'user' ? 30 : 60;
    try {
      const rate = await dependencies.rateLimit(
        {
          operationId,
          request,
          actorId:
            rateScope === 'user' ? session.userId : session.actingPartyId,
          actingPartyId: session.actingPartyId,
          principalClass: 'human',
          rateScope,
          rateClass:
            operationId === 'CMS-03C-12'
              ? 'cms-pattern-write'
              : 'cms-pattern-read',
          limit,
          windowSeconds: 60,
        },
        signal,
      );
      if (!validEnvelope<CmsTemplateRateDecision>(rate)) return failure(502);
      if (!rate.ok) return rate;
      if (!validRateDecision(rate.value, limit)) return failure(502);
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
