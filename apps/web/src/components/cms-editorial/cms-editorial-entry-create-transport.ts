import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  CmsEditorialEntryCreateRequestSchema,
  CmsEditorialEntryCreateResourceSchema,
  type CmsEditorialEntryCreateRequest,
  type CmsEditorialEntryCreateResource,
} from './cms-editorial-entry-create';
import {
  cmsEditorialVerifiedMutationErrorFrom,
  type CmsEditorialMutationOutcome,
} from './cms-editorial-runtime';

/**
 * Browser client for the locked CMS-03B-10 initial-entry create.
 *
 * Source of truth: .memory/wiki/specs/be/03b-editorial-workflow-publication.md
 * (135 and 824 idempotency/atomicity; 906 rollback row; 938-950 test rows) and
 * .memory/wiki/specs/fe/03-cms-content-modeling.md:544,749,822-823,902.
 *
 * The protected Worker route and first-party proxy exist locally. The create
 * page remains fail-closed because no approved served workflow-policy source
 * can populate the locked request; this transport is not hosted acceptance.
 */

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialEntryCreateTransportInput {
  /** The locked CMS-03B-10 route; no record is addressed in the path. */
  readonly path: string;
  readonly request: CmsEditorialEntryCreateRequest;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  /** Optional entropy seam so a test can pin the rotated key. */
  readonly createIdempotencyKey?: () => string;
  readonly fetcher?: Fetcher;
}

export interface CmsEditorialEntryCreateTransportResult {
  readonly outcome: CmsEditorialMutationOutcome;
  readonly status: number | null;
  readonly retryable: boolean;
  /** True when the create may have been applied but could not be confirmed. */
  readonly outcomeUnknown: boolean;
  readonly resource: CmsEditorialEntryCreateResource | null;
  /** The created-entry location, only ever set alongside a verified resource. */
  readonly location: string | null;
  readonly errorCode: string | null;
  readonly errorDetails: readonly string[];
  readonly retryAfterSeconds: number | null;
  /**
   * The caller-supplied request, returned by reference and never mutated, so a
   * denial can restore the unsent values it already holds (FE03:506,544).
   */
  readonly request: CmsEditorialEntryCreateRequest;
  /** The key the next attempt must present, per the rule below. */
  readonly idempotencyKey: string;
}

/**
 * A key survives only while the same logical create may still be retried.
 * A refused or completed command gets a fresh key so a corrected attempt is a
 * new logical create, and an uncertain one keeps its key so a retry replays the
 * original result instead of risking a duplicate entry (03b:824).
 */
export const cmsEditorialEntryCreateRetainsIdempotencyKey = (
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
 * A `201` is authoritative only when the body is a strict
 * `EntryCreateResourceSchema` AND the response advertises the required
 * created-entry location that resolves to the entry the body names. Anything
 * less is unverifiable, never success.
 */
const authoritativeCreateFrom = async (
  response: Response,
): Promise<{
  readonly resource: CmsEditorialEntryCreateResource;
  readonly location: string;
} | null> => {
  if (response.status !== 201) return null;
  const rawLocation = response.headers.get('location');
  if (rawLocation === null || rawLocation.trim().length === 0) return null;
  let parsed: unknown;
  try {
    parsed = await response.clone().json();
  } catch {
    return null;
  }
  const resource = CmsEditorialEntryCreateResourceSchema.safeParse(parsed);
  if (!resource.success) return null;
  const target = rawLocation.split('?')[0] ?? '';
  if (!target.endsWith('/' + resource.data.entry.id)) return null;
  return { resource: resource.data, location: rawLocation };
};

/**
 * Submit one initial entry create. Ownership, assignment, author, acting party,
 * capability, and authority are never sent: the server derives them from the
 * authenticated principal and a body asserting any of them is refused.
 */
export const executeCmsEditorialEntryCreate = async (
  input: CmsEditorialEntryCreateTransportInput,
): Promise<CmsEditorialEntryCreateTransportResult> => {
  const nextKey = (): string => {
    const candidate = (input.createIdempotencyKey ?? defaultIdempotencyKey)();
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : input.idempotencyKey;
  };
  const local = CmsEditorialEntryCreateRequestSchema.safeParse(input.request);
  if (!local.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      outcomeUnknown: false,
      resource: null,
      location: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: local.error.issues.map((issue) => issue.path.join('/')),
      retryAfterSeconds: null,
      request: input.request,
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
      location: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
      request: input.request,
      idempotencyKey: input.idempotencyKey,
    };
  }
  const authoritative = await authoritativeCreateFrom(response);
  if (authoritative !== null)
    return {
      outcome: 'success',
      status: 201,
      retryable: false,
      outcomeUnknown: false,
      resource: authoritative.resource,
      location: authoritative.location,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
      request: input.request,
      idempotencyKey: nextKey(),
    };
  if (response.status === 201)
    return {
      outcome: 'unknown',
      status: 201,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      location: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
      request: input.request,
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
      location: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
      request: input.request,
      idempotencyKey: input.idempotencyKey,
    };
  return {
    outcome: mapped.outcome,
    status: response.status,
    retryable: mapped.retryable,
    outcomeUnknown: mapped.outcome === 'unknown',
    resource: null,
    location: null,
    errorCode: mapped.errorCode,
    errorDetails: mapped.errorDetails,
    retryAfterSeconds: mapped.retryAfterSeconds,
    request: input.request,
    idempotencyKey: cmsEditorialEntryCreateRetainsIdempotencyKey(mapped.outcome)
      ? input.idempotencyKey
      : nextKey(),
  };
};
