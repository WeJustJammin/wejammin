import { ApiErrorSchema, type ApiError } from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  CmsEditorialEntryRevisionRequestSchema,
  CmsEditorialEntryRevisionResourceSchema,
  type CmsEditorialEntryRevisionRequest,
  type CmsEditorialEntryRevisionResource,
} from './cms-editorial-contracts';
import type { CmsEditorialEntryDraft } from './cms-editorial-types';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Truthful browser outcomes for CMS-03B-01. The union is deliberately wider
 * than HTTP status: `unknown` exists because a lost response must never be
 * reported as success (FE03:1441-1451).
 */
export type CmsEditorialMutationOutcome =
  | 'success'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'unsupported-media'
  | 'payload-too-large'
  | 'rate-limited'
  | 'degraded'
  | 'unknown';

export interface CmsEditorialMutationResult {
  readonly outcome: CmsEditorialMutationOutcome;
  readonly status: number | null;
  readonly retryable: boolean;
  /** True when the request may have been applied but could not be confirmed. */
  readonly outcomeUnknown: boolean;
  readonly resource: CmsEditorialEntryRevisionResource | null;
  readonly errorCode: string | null;
  readonly errorDetails: readonly string[];
  readonly retryAfterSeconds: number | null;
}

/**
 * Shared 429 Retry-After parse: only a finite, non-negative integer counts.
 */
export const cmsEditorialRetryAfterSecondsFrom = (
  headers: Headers,
): number | null => {
  const raw = headers.get('retry-after');
  if (raw === null) return null;
  const seconds = raw.trim();
  if (!/^\d+$/.test(seconds)) return null;
  const parsed = Number(seconds);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/**
 * Shared field-level details: only a real BE00 ApiError is read, and only its
 * JSON-pointer violations survive. A foreign body is dropped, never echoed.
 */
export const cmsEditorialErrorDetailsFrom = async (
  response: Response,
): Promise<readonly string[]> => {
  let parsed: unknown;
  try {
    parsed = await response.clone().json();
  } catch {
    return [];
  }
  const error = ApiErrorSchema.safeParse(parsed);
  if (!error.success) return [];
  const violations = error.data.details?.violations;
  if (!Array.isArray(violations)) return [];
  return violations
    .map((violation) =>
      violation !== null && typeof violation === 'object' && 'path' in violation
        ? String((violation as { path: unknown }).path)
        : null,
    )
    .filter((path): path is string => path !== null);
};

/** Shared safe error code: null for anything that is not a BE00 ApiError. */
export const cmsEditorialErrorCodeFrom = async (
  response: Response,
): Promise<string | null> => {
  try {
    const parsed: unknown = await response.clone().json();
    const error = ApiErrorSchema.safeParse(parsed);
    return error.success ? error.data.code : null;
  } catch {
    return null;
  }
};

/**
 * Shared status-to-outcome mapping for the 03b mutation envelopes. An
 * unrecognised status becomes unknown, never a named error class the contract
 * omits, so the client reconciles instead of inventing a meaning.
 */
export const cmsEditorialOutcomeForStatus = (
  status: number,
): { outcome: CmsEditorialMutationOutcome; retryable: boolean } => {
  if (status === 400 || status === 422)
    return { outcome: 'validation', retryable: false };
  if (status === 401) return { outcome: 'unauthenticated', retryable: false };
  if (status === 403) return { outcome: 'forbidden', retryable: false };
  if (status === 404) return { outcome: 'not-found', retryable: false };
  if (status === 409) return { outcome: 'conflict', retryable: false };
  if (status === 415) return { outcome: 'unsupported-media', retryable: false };
  if (status === 413) return { outcome: 'payload-too-large', retryable: false };
  if (status === 429) return { outcome: 'rate-limited', retryable: true };
  if (status >= 500) return { outcome: 'degraded', retryable: true };
  // Any other status has no locked CMS-03B-01 meaning, and its body could not
  // be verified as the created revision. Reporting unknown keeps the editor
  // truthful: the request may have been applied, so the client reconciles
  // before retrying instead of claiming an error class the contract omits.
  return { outcome: 'unknown', retryable: false };
};

const EDITORIAL_ERROR_CODE_FOR_STATUS: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

const violationPathsFrom = (error: ApiError): readonly string[] => {
  const violations = error.details.violations;
  if (!Array.isArray(violations)) return [];
  return violations
    .map((violation) =>
      violation !== null && typeof violation === 'object' && 'path' in violation
        ? String((violation as { path: unknown }).path)
        : null,
    )
    .filter((path): path is string => path !== null);
};

/** An HTTP status alone cannot prove a definite CMS editorial refusal. */
export const cmsEditorialVerifiedMutationErrorFrom = async (
  response: Response,
): Promise<{
  readonly outcome: CmsEditorialMutationOutcome;
  readonly retryable: boolean;
  readonly errorCode: string;
  readonly errorDetails: readonly string[];
  readonly retryAfterSeconds: number | null;
} | null> => {
  const expectedCode = EDITORIAL_ERROR_CODE_FOR_STATUS[response.status];
  if (expectedCode === undefined) return null;
  let candidate: unknown;
  try {
    candidate = await response.clone().json();
  } catch {
    return null;
  }
  const parsed = ApiErrorSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.code !== expectedCode) return null;
  const retryAfterSeconds =
    response.status === 429
      ? cmsEditorialRetryAfterSecondsFrom(response.headers)
      : null;
  if (
    response.status === 429 &&
    (retryAfterSeconds === null ||
      retryAfterSeconds < 1 ||
      retryAfterSeconds > 86_400 ||
      parsed.data.details.retryAfterSeconds !== retryAfterSeconds)
  )
    return null;
  const mapped = cmsEditorialOutcomeForStatus(response.status);
  return {
    outcome: mapped.outcome,
    retryable: mapped.retryable,
    errorCode: parsed.data.code,
    errorDetails: violationPathsFrom(parsed.data),
    retryAfterSeconds,
  };
};

/**
 * Parse an authoritative 201 body. A response only becomes `success` when the
 * body is a strict `EntryRevisionResource` for the entry that was saved.
 */
const authoritativeResourceFrom = async (
  response: Response,
  entryId: string,
): Promise<CmsEditorialEntryRevisionResource | null> => {
  if (response.status !== 201) return null;
  try {
    const parsed = CmsEditorialEntryRevisionResourceSchema.safeParse(
      await response.clone().json(),
    );
    if (!parsed.success) return null;
    return parsed.data.entryId === entryId ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * Submit one immutable revision. Autosave never publishes
 * (BE03b:94, IA03:37).
 */
export const executeCmsEditorialRevisionMutation = async (input: {
  readonly path: string;
  readonly request: CmsEditorialEntryRevisionRequest;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly fetcher?: Fetcher;
}): Promise<CmsEditorialMutationResult> => {
  const local = CmsEditorialEntryRevisionRequestSchema.safeParse(input.request);
  if (!local.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      outcomeUnknown: false,
      resource: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: local.error.issues.map((issue) => issue.path.join('/')),
      retryAfterSeconds: null,
    };
  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (request, init) =>
    baseFetcher(request, await addClientBindingIdHeader(request, init));
  let response: Response;
  try {
    response = await fetcher(input.path, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': input.csrfToken,
        'idempotency-key': input.idempotencyKey,
        'if-match': '"' + input.request.expectedVersion + '"',
      },
      body: JSON.stringify(input.request),
    });
  } catch {
    return {
      outcome: 'unknown',
      status: null,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  }
  const resource = await authoritativeResourceFrom(
    response,
    input.request.entryId,
  );
  if (resource !== null)
    return {
      outcome: 'success',
      status: 201,
      retryable: false,
      outcomeUnknown: false,
      resource,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  if (response.status === 201)
    return {
      outcome: 'unknown',
      status: 201,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  const mapped = await cmsEditorialVerifiedMutationErrorFrom(response);
  if (mapped === null)
    return {
      outcome: 'unknown',
      status: response.status,
      retryable: response.status >= 400,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  return {
    outcome: mapped.outcome,
    status: response.status,
    retryable: mapped.retryable,
    outcomeUnknown: mapped.outcome === 'unknown',
    resource: null,
    errorCode: mapped.errorCode,
    errorDetails: mapped.errorDetails,
    retryAfterSeconds: mapped.retryAfterSeconds,
  };
};

/**
 * Adopt the authoritative revision as the next autosave base. `baseRevision`
 * and `expectedVersion` advance together so the next autosave is always
 * CAS-valid against the revision it was built from.
 */
export const applyCmsEditorialAcceptedRevision = (
  draft: CmsEditorialEntryDraft,
  resource: CmsEditorialEntryRevisionResource,
): CmsEditorialEntryDraft => ({
  ...draft,
  baseRevision: resource.revisionNumber,
  expectedVersion: resource.version,
});
