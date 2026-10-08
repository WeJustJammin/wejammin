import {
  CmsUuidSchema,
  EntryDraftDetailQuerySchema,
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
import { CMS_EDITORIAL_DETAIL_POLICIES } from './cms-editorial-platform-error-details';
import {
  CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX,
  readAdmissionError,
  readAdmissionStatus,
} from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  cmsEditorialPathError,
  cmsEditorialValidationError,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

export { CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX } from './cms-editorial-platform-read-admission';
export {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryListRead,
} from './cms-editorial-platform-reads-collection';

/**
 * Server-only first-party proxies for CMS-03B-11 draft detail and CMS-03B-03
 * revision history.
 *
 * The read carries no body, no `Idempotency-Key`, and no `If-Match`, and it
 * never mutates on GET. The strong `ETag` the Worker emits is preserved
 * verbatim on the way out so the browser can use it as the next CAS base.
 *
 * A structurally malformed entry id or query value is a 400 INVALID_REQUEST
 * (BE03b:172, DEC-145), the same status the Worker answers, and is refused
 * locally with a bounded violation pointer rather than forwarded. A well-formed
 * id is forwarded with the browser's cancellation signal and only a bounded
 * strict resource or an allowlist-rebuilt typed error is relayed.
 */

const DRAFT_DETAIL_QUERY_KEYS = new Set(['locale']);

export const forwardCmsEditorialEntryDraftDetailRead = async (
  request: Request,
  binding: unknown,
  entryId: string,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  if (!CmsUuidSchema.safeParse(entryId).success)
    return cmsEditorialPathError(request, 'entryId');
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);

  const url = new URL(request.url);
  const query: Record<string, unknown> = { entryId };
  const forwardedQuery = new URLSearchParams();
  const seen = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (!DRAFT_DETAIL_QUERY_KEYS.has(key) || seen.has(key))
      return cmsEditorialLocalError(request, 400);
    seen.add(key);
    // A native GET form may submit an empty optional locale control. Treat it
    // as absent; duplicate controls remain refused rather than collapsed.
    if (key === 'locale' && value === '') continue;
    query[key] = value;
    forwardedQuery.set(key, value);
  }
  const parsedQuery = EntryDraftDetailQuerySchema.safeParse(query);
  if (!parsedQuery.success)
    return cmsEditorialValidationError(request, 400, parsedQuery.error.issues);
  const headers = cmsEditorialForwardHeaders(request);
  const search =
    forwardedQuery.size === 0 ? '' : `?${forwardedQuery.toString()}`;

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/${encodeURIComponent(entryId)}${search}`,
        { method: 'GET', headers, signal: request.signal },
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
      CMS_EDITORIAL_DETAIL_POLICIES.read,
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
    return cmsEditorialPathError(request, 'entryId');
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
    return cmsEditorialValidationError(request, 400, parsedQuery.error.issues);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/${encodeURIComponent(entryId)}/revisions${forwardedQuery.size === 0 ? '' : `?${forwardedQuery.toString()}`}`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
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
      CMS_EDITORIAL_DETAIL_POLICIES.history,
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
