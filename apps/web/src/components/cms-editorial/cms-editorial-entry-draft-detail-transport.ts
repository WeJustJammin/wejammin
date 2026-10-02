import {
  Bcp47Schema,
  CmsUuidSchema,
  EntryDraftDetailEtagSchema,
  entryDraftDetailEtagMatchesResource,
  type EntryDraftDetailResource,
} from '@wejammin/contracts';
import { addClientBindingIdHeader } from '../../lib/client-binding';
import { CmsEditorialEntryDraftDetailResourceSchema } from './cms-editorial-entry-draft-detail';
import {
  cmsEditorialErrorCodeFrom,
  cmsEditorialErrorDetailsFrom,
  cmsEditorialRetryAfterSecondsFrom,
} from './cms-editorial-runtime';

/**
 * Browser client for the locked CMS-03B-11 protected draft read.
 *
 * Source of truth: .memory/wiki/specs/be/03b-editorial-workflow-publication.md
 * (159 and 700 resource; 726-727 error matrix; 903 read row) and
 * .memory/wiki/specs/fe/03-cms-content-modeling.md:544,750,823-824,903.
 *
 * The shared contract, first-party proxy, protected Worker route, and named
 * production RPC adapter are implemented locally. The edit workbench still
 * lacks a loader; this client never fabricates a loaded draft when a protected
 * read fails, and local composition is not hosted acceptance.
 *
 * The read carries no body, no `Idempotency-Key`, and no `If-Match`, and it
 * never mutates on GET. A visible entry the caller may not read and a hidden
 * entry both resolve to `not-found`, so the client cannot tell them apart.
 */

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CmsEditorialDraftDetailOutcome =
  | 'success'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'degraded'
  | 'unknown';

export interface CmsEditorialEntryDraftDetailReadResult {
  readonly outcome: CmsEditorialDraftDetailOutcome;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly resource: EntryDraftDetailResource | null;
  /** The exact read-representation validator; writes use entry.version. */
  readonly etag: string | null;
  readonly errorCode: string | null;
  readonly errorDetails: readonly string[];
  readonly retryAfterSeconds: number | null;
}

/**
 * Only the bounded entry/revision representation validator is relayable. It
 * is not the numeric If-Match precondition for a revision write, which comes
 * from the canonical entry version in the read resource.
 */
export const cmsEditorialDraftDetailEtagFrom = (
  headers: Headers,
): string | null => {
  const raw = headers.get('etag');
  if (raw === null) return null;
  return EntryDraftDetailEtagSchema.safeParse(raw).success ? raw : null;
};

/**
 * A read is only trusted once the response is a strict
 * `EntryDraftDetailResourceSchema` for the entry that was addressed. A body
 * for a different entry, a weak or absent ETag, or a non-JSON body is
 * unverifiable and maps to `unknown`, never to success.
 */
const authoritativeDraftFrom = async (
  response: Response,
  entryId: string,
): Promise<{
  readonly resource: EntryDraftDetailResource;
  readonly etag: string;
} | null> => {
  if (response.status !== 200) return null;
  const etag = cmsEditorialDraftDetailEtagFrom(response.headers);
  if (etag === null) return null;
  let parsed: unknown;
  try {
    parsed = await response.clone().json();
  } catch {
    return null;
  }
  const resource = CmsEditorialEntryDraftDetailResourceSchema.safeParse(parsed);
  if (!resource.success) return null;
  return resource.data.entry.id === entryId &&
    entryDraftDetailEtagMatchesResource(etag, resource.data)
    ? { resource: resource.data, etag }
    : null;
};

/**
 * Map a read status to a client outcome. `409` has no meaning for a bounded
 * read in the locked matrix, so it and every other unrecognised status fall
 * through to `unknown` instead of borrowing a mutation class.
 */
const outcomeForReadStatus = (
  status: number,
): {
  readonly outcome: CmsEditorialDraftDetailOutcome;
  readonly retryable: boolean;
} => {
  if (status === 400 || status === 422)
    return { outcome: 'validation', retryable: false };
  if (status === 401) return { outcome: 'unauthenticated', retryable: false };
  if (status === 403) return { outcome: 'forbidden', retryable: false };
  if (status === 404) return { outcome: 'not-found', retryable: false };
  if (status === 429) return { outcome: 'rate-limited', retryable: true };
  if (status >= 500) return { outcome: 'degraded', retryable: true };
  return { outcome: 'unknown', retryable: false };
};

/**
 * Read one authorised draft. The optional locale is a query parameter only;
 * the path always addresses exactly one UUID entry, and a bad locale is
 * refused locally instead of being sent as an unvalidated query string.
 */
export const executeCmsEditorialEntryDraftDetailRead = async (input: {
  readonly basePath: string;
  readonly entryId: string;
  readonly locale?: string;
  readonly fetcher?: Fetcher;
}): Promise<CmsEditorialEntryDraftDetailReadResult> => {
  const pathParam = CmsUuidSchema.safeParse(input.entryId);
  if (!pathParam.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      resource: null,
      etag: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: ['entryId'],
      retryAfterSeconds: null,
    };
  const locale =
    input.locale === undefined ? null : Bcp47Schema.safeParse(input.locale);
  if (locale !== null && !locale.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      resource: null,
      etag: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: ['locale'],
      retryAfterSeconds: null,
    };
  const url =
    input.basePath +
    '/' +
    pathParam.data +
    (locale === null ? '' : '?locale=' + encodeURIComponent(locale.data));
  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (request, init) =>
    baseFetcher(request, await addClientBindingIdHeader(request, init));
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  } catch {
    return {
      outcome: 'degraded',
      status: null,
      retryable: true,
      resource: null,
      etag: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  }
  const authoritative = await authoritativeDraftFrom(response, input.entryId);
  if (authoritative !== null)
    return {
      outcome: 'success',
      status: 200,
      retryable: false,
      resource: authoritative.resource,
      etag: authoritative.etag,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  if (response.status === 200)
    return {
      outcome: 'unknown',
      status: 200,
      retryable: true,
      resource: null,
      etag: null,
      errorCode: null,
      errorDetails: [],
      retryAfterSeconds: null,
    };
  const mapped = outcomeForReadStatus(response.status);
  return {
    outcome: mapped.outcome,
    status: response.status,
    retryable: mapped.retryable,
    resource: null,
    etag: null,
    errorCode: await cmsEditorialErrorCodeFrom(response),
    errorDetails: await cmsEditorialErrorDetailsFrom(response),
    retryAfterSeconds:
      mapped.outcome === 'rate-limited'
        ? cmsEditorialRetryAfterSecondsFrom(response.headers)
        : null,
  };
};
