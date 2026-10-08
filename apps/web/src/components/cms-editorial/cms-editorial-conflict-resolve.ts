import {
  ConflictChoiceSchema,
  ConflictResolutionHeadersSchema,
  ConflictResolutionPathParamsSchema,
  ConflictResolutionRequestSchema,
  EntryRevisionResourceSchema,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  cmsEditorialVerifiedMutationErrorFrom,
  type CmsEditorialMutationOutcome,
} from './cms-editorial-runtime';

/**
 * Browser-side projection of the locked CMS-03B-02 conflict-resolution
 * command for the CMS-06 native conflict form.
 *
 * Source of truth:
 * - .memory/wiki/specs/be/03b-editorial-workflow-publication.md (CMS-03B-02
 *   route row and the ConflictResolutionRequest/ConflictChoice contracts).
 * - .memory/wiki/specs/fe/03-cms-content-modeling.md CMS-06 interaction row,
 *   CMS-03B-02 data-mapping row, and the concurrency rules.
 *
 * The shared contracts are the single authority: this module re-exports their
 * schemas under browser-facing names instead of redeclaring any rule, so a
 * later BE03b contract change cannot drift away from this client.
 */

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION = {
  operationId: 'CMS-03B-02',
  method: 'POST',
  path: '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
  request: 'ConflictResolutionRequest',
  response: 'EntryRevisionResource',
  status: 201,
  browserPolicy: 'human-form',
} as const;

export const CmsEditorialConflictResolveChoiceSchema = ConflictChoiceSchema;
export const CmsEditorialConflictResolveRequestSchema =
  ConflictResolutionRequestSchema;
export const CmsEditorialConflictResolvePathSchema =
  ConflictResolutionPathParamsSchema;
export const CmsEditorialConflictResolveHeadersSchema =
  ConflictResolutionHeadersSchema;
export const CmsEditorialConflictResolveResourceSchema =
  EntryRevisionResourceSchema;

export type CmsEditorialConflictResolveChoice = {
  readonly path: string;
  readonly choice: 'base' | 'theirs' | 'yours' | 'explicit';
  readonly value?: unknown;
};

export type CmsEditorialConflictResolveRequest = {
  readonly entryId: string;
  readonly conflictId: string;
  readonly baseRevision: string;
  readonly choices: readonly CmsEditorialConflictResolveChoice[];
  readonly expectedVersion: string;
};

export type CmsEditorialConflictResolveResource = {
  readonly id: string;
  readonly version: string;
  /** The committed entry version: the next `If-Match`. */
  readonly entryVersion: string;
  readonly state: string;
  readonly entryId: string;
  readonly revisionNumber: string;
  readonly conflictId: string | null;
  readonly parentRevisionIds: readonly string[];
};

export interface CmsEditorialConflictResolveTransportInput {
  /** The locked CMS-03B-02 first-party resolve endpoint path. */
  readonly path: string;
  readonly request: CmsEditorialConflictResolveRequest;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  /** Optional entropy seam so a test can pin the rotated key. */
  readonly createIdempotencyKey?: () => string;
  readonly fetcher?: Fetcher;
}

export interface CmsEditorialConflictResolveTransportResult {
  readonly outcome: CmsEditorialMutationOutcome;
  readonly status: number | null;
  readonly retryable: boolean;
  /** True when the resolve may have applied but could not be confirmed. */
  readonly outcomeUnknown: boolean;
  readonly resource: CmsEditorialConflictResolveResource | null;
  readonly errorCode: string | null;
  readonly errorDetails: readonly string[];
  /** A verified typed reason token (closed vocabulary), else null. */
  readonly reasonCode: string | null;
  readonly retryAfterSeconds: number | null;
  /**
   * The caller-supplied request, returned by reference and never mutated, so
   * every explicit choice survives an error for retry (FE03 CMS-06 "Preserve
   * all choices").
   */
  readonly request: CmsEditorialConflictResolveRequest;
  /** The key the next attempt must present, per the rule below. */
  readonly idempotencyKey: string;
}

/**
 * A key survives only while the same logical resolve may still be retried.
 * A refused or completed command gets a fresh key so a corrected attempt is a
 * new logical resolve, and an uncertain one keeps its key so a retry replays
 * the original result instead of risking a second resolution effect.
 */
export const cmsEditorialConflictResolveRetainsIdempotencyKey = (
  outcome: CmsEditorialMutationOutcome,
): boolean =>
  outcome === 'rate-limited' || outcome === 'degraded' || outcome === 'unknown';

const defaultIdempotencyKey = (): string | null => {
  try {
    const api = globalThis.crypto;
    if (typeof api?.randomUUID === 'function') return api.randomUUID();
    const bytes = api.getRandomValues(new Uint8Array(16));
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
};

/**
 * Parse an authoritative 201 body. A response only becomes `success` when the
 * body is a strict `EntryRevisionResource` for this entry and conflict with
 * exactly two distinct parent revisions preserved.
 */
const authoritativeResourceFrom = async (
  response: Response,
  entryId: string,
  conflictId: string,
): Promise<CmsEditorialConflictResolveResource | null> => {
  if (response.status !== 201) return null;
  try {
    const parsed = EntryRevisionResourceSchema.safeParse(
      await response.clone().json(),
    );
    if (!parsed.success) return null;
    if (parsed.data.entryId !== entryId) return null;
    if (parsed.data.conflictId !== conflictId) return null;
    if (parsed.data.parentRevisionIds.length !== 2) return null;
    if (parsed.data.parentRevisionIds[0] === parsed.data.parentRevisionIds[1])
      return null;
    return parsed.data;
  } catch {
    return null;
  }
};

/**
 * Submit one explicit conflict resolution. No winner is ever inferred: the
 * builder takes the caller's choice list verbatim and the server derives
 * ownership, capability, and the winning side. Resolution stays inside the
 * editorial draft workflow and never publishes.
 */
export const executeCmsEditorialConflictResolve = async (
  input: CmsEditorialConflictResolveTransportInput,
): Promise<CmsEditorialConflictResolveTransportResult> => {
  const nextKey = (): string => {
    const candidate = (input.createIdempotencyKey ?? defaultIdempotencyKey)();
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : input.idempotencyKey;
  };
  const base = { request: input.request };
  const local = ConflictResolutionRequestSchema.safeParse(input.request);
  if (!local.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      outcomeUnknown: false,
      resource: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: local.error.issues.map((issue) => issue.path.join('/')),
      reasonCode: null,
      retryAfterSeconds: null,
      ...base,
      idempotencyKey: nextKey(),
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
      reasonCode: null,
      retryAfterSeconds: null,
      ...base,
      idempotencyKey: input.idempotencyKey,
    };
  }
  const resource = await authoritativeResourceFrom(
    response,
    input.request.entryId,
    input.request.conflictId,
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
      reasonCode: null,
      retryAfterSeconds: null,
      ...base,
      idempotencyKey: nextKey(),
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
      reasonCode: null,
      retryAfterSeconds: null,
      ...base,
      idempotencyKey: input.idempotencyKey,
    };
  const mapped = await cmsEditorialVerifiedMutationErrorFrom(response);
  if (mapped === null)
    return {
      outcome: 'unknown',
      status: response.status,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      reasonCode: null,
      retryAfterSeconds: null,
      ...base,
      idempotencyKey: input.idempotencyKey,
    };
  return {
    outcome: mapped.outcome,
    status: response.status,
    retryable: mapped.retryable,
    outcomeUnknown: mapped.outcome === 'unknown',
    resource: null,
    errorCode: mapped.errorCode,
    errorDetails: mapped.errorDetails,
    reasonCode: mapped.reasonCode,
    retryAfterSeconds: mapped.retryAfterSeconds,
    ...base,
    idempotencyKey: cmsEditorialConflictResolveRetainsIdempotencyKey(
      mapped.outcome,
    )
      ? input.idempotencyKey
      : nextKey(),
  };
};
