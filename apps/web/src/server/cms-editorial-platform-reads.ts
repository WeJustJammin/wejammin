import {
  CmsUuidSchema,
  EntryDraftDetailResourceSchema,
  RevisionHistoryPageSchema,
  RevisionHistoryQuerySchema,
  entryDraftDetailEtagMatchesResource,
  editorialDraftDetailErrors,
  editorialRevisionHistoryErrors,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedResponseJson,
  cmsEditorialForwardedError,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/**
 * Server-only first-party proxies for CMS-03B-11 draft detail and CMS-03B-03
 * revision history.
 *
 * The read carries no body, no `Idempotency-Key`, and no `If-Match`, and it
 * never mutates on GET. The strong `ETag` the Worker emits is preserved
 * verbatim on the way out so the browser can use it as the next CAS base.
 *
 * A malformed entry id addresses no entry, so it is refused locally as
 * `not-found` rather than being forwarded. A well-formed id is forwarded and
 * only a bounded strict resource or typed error is relayed.
 */

export const CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX = '/api/v1/cms/entries';

const readAdmissionStatus = (request: Request): 400 | 415 | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return 400;
  if (request.headers.has('content-type')) return 415;
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return 400;
  return null;
};

const readAdmissionError = (request: Request, status: 400 | 415): Response =>
  status === 415
    ? cmsEditorialLocalError(
        request,
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'A protected CMS read has no request media.',
      )
    : cmsEditorialLocalError(request, 400);

export const forwardCmsEditorialEntryDraftDetailRead = async (
  request: Request,
  binding: unknown,
  entryId: string,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  if (!CmsUuidSchema.safeParse(entryId).success)
    return cmsEditorialLocalError(request, 404);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);

  const headers = cmsEditorialForwardHeaders(request);
  let search: string;
  try {
    search = new URL(request.url).search;
  } catch {
    search = '';
  }

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/${encodeURIComponent(entryId)}${search}`,
        { method: 'GET', headers },
      ),
    );
  } catch {
    return cmsEditorialLocalError(request, 503);
  }
  if (!(upstream instanceof Response))
    return cmsEditorialLocalError(request, 503);

  if (upstream.status !== 200)
    return cmsEditorialForwardedError(
      request,
      upstream,
      editorialDraftDetailErrors,
    );

  // CMS-03B-11 requires a strong authenticated ETag: the draft the browser
  // receives is the base for the next revision, so an absent validator would
  // let an unsound value anchor a write. The parsed resource below must also
  // match its entry/revision identity and version tuple exactly.
  const etag = upstream.headers.get('etag');
  if (etag === null) return cmsEditorialLocalError(request, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, 502);
  const parsed = EntryDraftDetailResourceSchema.safeParse(body.value);
  // A 200 for a different entry, or for a body that is not the strict
  // resource, is an invalid upstream response and must not be relayed.
  if (
    !parsed.success ||
    parsed.data.entry.id !== entryId ||
    !entryDraftDetailEtagMatchesResource(etag, parsed.data)
  )
    return cmsEditorialLocalError(request, 502);

  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

const HISTORY_QUERY_KEYS = new Set([
  'cursor',
  'limit',
  'state',
  'compareRevisionId',
  'locale',
]);

/**
 * First-party CMS-03B-03 read. Query state is URL-owned; the Worker is still
 * the authority, but the web boundary rejects malformed or duplicate filters
 * before they can be forwarded and only relays a bounded strict history page.
 */
export const forwardCmsEditorialRevisionHistoryRead = async (
  request: Request,
  binding: unknown,
  entryId: string,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  if (!CmsUuidSchema.safeParse(entryId).success)
    return cmsEditorialLocalError(request, 404);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);

  const url = new URL(request.url);
  const query: Record<string, unknown> = { entryId };
  const seen = new Set<string>();
  const forwardedQuery = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!HISTORY_QUERY_KEYS.has(key) || seen.has(key))
      return cmsEditorialLocalError(request, 400);
    seen.add(key);
    // A native GET form submits empty optional controls. Canonicalize those
    // two to absence; a second occurrence remains a duplicate, not a value.
    if ((key === 'state' || key === 'locale') && value === '') continue;
    if (key === 'cursor' && (value.length === 0 || value.length > 512))
      return cmsEditorialLocalError(request, 400);
    if (key === 'limit') {
      if (!/^[1-9][0-9]?$/u.test(value) || Number(value) > 50)
        return cmsEditorialLocalError(request, 400);
      query[key] = Number(value);
    } else query[key] = value;
    forwardedQuery.set(key, value);
  }
  const parsedQuery = RevisionHistoryQuerySchema.safeParse(query);
  if (!parsedQuery.success)
    return cmsEditorialLocalError(
      request,
      parsedQuery.error.issues.some((issue) =>
        ['cursor', 'limit', 'compareRevisionId', 'locale'].includes(
          String(issue.path[0]),
        ),
      )
        ? 400
        : 422,
    );

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/${encodeURIComponent(entryId)}/revisions${forwardedQuery.size === 0 ? '' : `?${forwardedQuery.toString()}`}`,
        { method: 'GET', headers: cmsEditorialForwardHeaders(request) },
      ),
    );
  } catch {
    return cmsEditorialLocalError(request, 503);
  }
  if (!(upstream instanceof Response))
    return cmsEditorialLocalError(request, 503);
  if (upstream.status !== 200)
    return cmsEditorialForwardedError(
      request,
      upstream,
      editorialRevisionHistoryErrors,
    );
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, 502);
  const parsed = RevisionHistoryPageSchema.safeParse(body.value);
  if (
    !parsed.success ||
    upstream.headers.get('etag') !== `"${parsed.data.pageVersion}"`
  )
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};
