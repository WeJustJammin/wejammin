import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
  CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST,
  CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
  contentSchemaRegistryRoutePolicies,
} from '@wejammin/contracts';

import type { ContentSchemaRegistryDependencies } from './types';
import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
} from './types';
import { CONTENT_SCHEMA_REGISTRY_RUNBOOK } from './types';
import type { FeatureContext } from './route-types';
import { statusFor } from './route-types';
export { safeDetails } from './route-response-details';
import { boundedRetryAfterSeconds } from './error-detail-values';
import { safeDetails } from './route-response-details';

export const successStatusFor = (
  operationId: ContentSchemaRegistryOperationId,
  value: unknown,
): 200 | 201 | 202 => {
  if (
    operationId === 'CMS-03A-04' &&
    typeof value === 'object' &&
    value !== null
  )
    return (value as { jobId?: unknown }).jobId === null ? 200 : 202;
  if (
    operationId === 'CMS-03A-14' &&
    typeof value === 'object' &&
    value !== null
  )
    return (value as { state?: unknown }).state === 'revoked' ? 200 : 201;
  return statusFor[operationId] as 200 | 201 | 202;
};

export const policyFor = (operationId: ContentSchemaRegistryOperationId) => {
  const policy = contentSchemaRegistryRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error('Content registry route policy missing.');
  return policy;
};

export const isReleasePath = (path: string): boolean =>
  path === '/api/v1/cms/blocks/versions' ||
  path.startsWith('/api/v1/cms/blocks/versions/');

export const corsOriginsFor = (
  path: string,
  dependencies: ContentSchemaRegistryDependencies,
): readonly string[] =>
  isReleasePath(path) ? dependencies.releaseOrigins : dependencies.humanOrigins;

export const setRateHeaders = (
  context: FeatureContext,
  decision: Readonly<{
    limit: number;
    remaining: number;
    resetAt: number;
  }>,
): void => {
  context.header('ratelimit-limit', String(decision.limit));
  context.header('ratelimit-remaining', String(decision.remaining));
  context.header('ratelimit-reset', String(decision.resetAt));
};

const humanCapabilities = new Set<string>(
  CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES,
);
const presentationVariants = new Set<string>(
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
);

/** Only the private web service-binding host may receive capability proof. */
export const isContentSchemaRegistryPrivateServiceRequest = (
  request: Request,
): boolean => {
  try {
    const url = new URL(request.url);
    return (
      url.protocol === 'https:' &&
      url.hostname === CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST
    );
  } catch {
    return false;
  }
};

/** Emit only trusted read capabilities for the private Astro projection. */
export const setContentSchemaRegistryCapabilityHeader = (
  context: FeatureContext,
  capabilities: readonly string[],
  presentationVariant?: string,
  actorId?: string,
  actingPartyId?: string | null,
  stepUpFreshUntil?: string,
): void => {
  const safeCapabilities = capabilities.filter((capability) =>
    humanCapabilities.has(capability),
  );
  if (safeCapabilities.length > 0)
    context.header(
      CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
      [...new Set(safeCapabilities)].join(','),
    );
  if (
    presentationVariant !== undefined &&
    presentationVariants.has(presentationVariant)
  )
    context.header(
      CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
      presentationVariant,
    );
  if (actorId !== undefined && isCmsContextUuid(actorId))
    context.header(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER, actorId);
  if (
    actingPartyId !== undefined &&
    actingPartyId !== null &&
    isCmsContextUuid(actingPartyId)
  )
    context.header(
      CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
      actingPartyId,
    );
  if (stepUpFreshUntil !== undefined && isCanonicalInstant(stepUpFreshUntil))
    context.header(
      CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
      stepUpFreshUntil,
    );
};

const isCmsContextUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );

/**
 * A canonical RFC3339 instant with millisecond precision. A malformed
 * disclosure instant is dropped rather than forwarded; the browser fails
 * closed to "required" when the header is absent.
 */
const isCanonicalInstant = (value: string): boolean => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

/** Select the least-privileged presentation from authenticated server data. */
export const presentationVariantForSession = (
  session: Readonly<{
    capabilities: readonly string[];
    presentationVariant?: string;
  }>,
): string | undefined => {
  if (
    session.presentationVariant !== undefined &&
    presentationVariants.has(session.presentationVariant)
  )
    return session.presentationVariant;
  if (session.capabilities.includes('cms.schema_designer')) return 'ownerFull';
  if (session.capabilities.includes('cms.schema_registry.read'))
    return 'entitledRead';
  return undefined;
};

/**
 * WEBHOOK_REJECTED is reserved for the exact 401 outcome of the signed release
 * boundary (CMS-03A-05 and CMS-03A-08). Any other status, or any other
 * operation, that reports it is a defect upstream: the wire shows the code
 * the status itself declares, never the reserved release outcome.
 */
const RELEASE_BOUNDARY_OPERATIONS: ReadonlySet<string> = new Set([
  'CMS-03A-05',
  'CMS-03A-08',
]);
const STATUS_DECLARED_CODE: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

const NOT_FOUND_MESSAGE = 'The requested CMS registry resource was not found.';

export const errorResponse = (
  context: FeatureContext,
  result: ContentSchemaRegistryError,
  requestId: string,
): Response => {
  // BE00 uses the single code DEPENDENCY_UNAVAILABLE for 502, 503 and 504; the
  // finer internal reason codes never reach the wire.
  const dependencyFailure =
    result.status === 502 || result.status === 503 || result.status === 504;
  // BE00 has one 409 code, CONFLICT; `details.conflict` names the kind.
  const reservedMisuse =
    result.code === 'WEBHOOK_REJECTED' &&
    !(
      result.status === 401 &&
      RELEASE_BOUNDARY_OPERATIONS.has(context.get('operationId') ?? '')
    );
  const code = dependencyFailure
    ? 'DEPENDENCY_UNAVAILABLE'
    : result.status === 409
      ? 'CONFLICT'
      : reservedMisuse
        ? (STATUS_DECLARED_CODE[result.status] ?? 'INTERNAL_ERROR')
        : /^[A-Z][A-Z0-9_]{0,63}$/u.test(result.code)
          ? result.code
          : 'INTERNAL_ERROR';
  // A concealed resource must be indistinguishable from an absent one, so a 404
  // never carries port-authored text (BE03a 403-versus-404 rule).
  const safeMessage =
    result.status === 404
      ? NOT_FOUND_MESSAGE
      : result.status >= 500
        ? code === 'INTERNAL_ERROR'
          ? 'An unexpected error occurred.'
          : result.status === 504
            ? 'The CMS registry dependency exceeded its deadline.'
            : result.status === 502
              ? 'The CMS registry dependency returned an invalid response.'
              : 'The CMS registry dependency is temporarily unavailable.'
        : result.message;
  const body = {
    code,
    message: safeMessage,
    requestId,
    details: safeDetails(result, context.get('operationId')),
  };
  context.header('cache-control', 'no-store');
  if (result.status === 502 || result.status === 503 || result.status === 504)
    context.header(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER, 'true');
  const retryAfterSeconds = boundedRetryAfterSeconds(result.retryAfterSeconds);
  if (retryAfterSeconds !== null)
    context.header('retry-after', String(retryAfterSeconds));
  return context.json(body, result.status);
};

export const requestIdFor = (request: Request): string => {
  const candidate = request.headers.get('x-request-id');
  return candidate !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      candidate,
    )
    ? candidate
    : crypto.randomUUID();
};

export const etagFor = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const version = (value as { version?: unknown }).version;
  return typeof version === 'string' && /^[1-9][0-9]*$/u.test(version)
    ? `"${version}"`
    : null;
};

export const validatePortInput = (
  operationId: ContentSchemaRegistryOperationId,
  input: ContentSchemaRegistryPortInput,
): ContentSchemaRegistryPortInput => ({ ...input, operationId });

export const runTelemetry = async (
  dependencies: Pick<ContentSchemaRegistryDependencies, 'telemetry'>,
  event: Parameters<
    NonNullable<ContentSchemaRegistryDependencies['telemetry']>
  >[0],
): Promise<void> => {
  if (dependencies.telemetry === undefined) return;
  try {
    await dependencies.telemetry(event);
  } catch {
    // Telemetry loss cannot replace a canonical API response.
  }
};

export { CONTENT_SCHEMA_REGISTRY_RUNBOOK };
