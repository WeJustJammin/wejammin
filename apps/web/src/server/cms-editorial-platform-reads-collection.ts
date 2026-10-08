import {
  AuthoringContextQuerySchema,
  AuthoringContextReadSchema,
  ConflictDetailPathParamsSchema,
  ConflictDetailResourceSchema,
  EntryListPageSchema,
  EntryListQuerySchema,
  editorialAuthoringContextErrors,
  editorialConflictDetailErrors,
  editorialEntryListErrors,
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
  cmsEditorialValidationError,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/**
 * Server-only first-party proxies for the collection-level and conflict reads:
 * CMS-03B-13 entry list, CMS-03B-14 authoring context and CMS-03B-12 conflict
 * detail. Each carries no body, no `Idempotency-Key`, and no `If-Match`, never
 * mutates on GET, and relays only a bounded strict resource bound to its
 * strong ETag. The entry-scoped draft and history reads live in
 * `cms-editorial-platform-reads.ts`, which re-exports these.
 */

const LIST_QUERY_KEYS = new Set(['cursor', 'limit', 'state', 'contentTypeId']);

/**
 * First-party CMS-03B-13 keyset read. The URL owns the page window: only the
 * four allowlisted filters are forwarded, malformed ones are refused before
 * the Worker is reached, and only a bounded strict page bound to the signed
 * page version ETag is relayed.
 */
export const forwardCmsEditorialEntryListRead = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);

  const query: Record<string, unknown> = {};
  const seen = new Set<string>();
  const forwardedQuery = new URLSearchParams();
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!LIST_QUERY_KEYS.has(key) || seen.has(key))
      return cmsEditorialLocalError(request, 400);
    seen.add(key);
    if (key === 'cursor' && (value.length === 0 || value.length > 512))
      return cmsEditorialLocalError(request, 400);
    if (key === 'limit') {
      if (!/^[1-9][0-9]?$/u.test(value) || Number(value) > 50)
        return cmsEditorialLocalError(request, 400);
      query[key] = Number(value);
    } else query[key] = value;
    forwardedQuery.set(key, value);
  }
  const parsedQuery = EntryListQuerySchema.safeParse(query);
  if (!parsedQuery.success)
    return cmsEditorialValidationError(request, 400, parsedQuery.error.issues);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}${forwardedQuery.size === 0 ? '' : `?${forwardedQuery.toString()}`}`,
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
      editorialEntryListErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.read,
    );

  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, 502);
  const parsed = EntryListPageSchema.safeParse(body.value);
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

const AUTHORING_CONTEXT_QUERY_KEYS = new Set(['contentTypeVersionId']);

const representationEtag = async (
  resource: unknown,
): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(resource);
  } catch {
    return null;
  }
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `"sha256:${hex}"`;
};

/**
 * First-party CMS-03B-14 preparation read. Only the single optional active
 * compiled-version selector is forwarded; every authority field is derived by
 * the Worker. The relayed resource must satisfy the literal-precedence read
 * contract and carry the exact bounded selection ETag.
 */
export const forwardCmsEditorialAuthoringContextRead = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);

  const query: Record<string, unknown> = {};
  const seen = new Set<string>();
  const forwardedQuery = new URLSearchParams();
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!AUTHORING_CONTEXT_QUERY_KEYS.has(key) || seen.has(key))
      return cmsEditorialLocalError(request, 400);
    seen.add(key);
    query[key] = value;
    forwardedQuery.set(key, value);
  }
  const parsedQuery = AuthoringContextQuerySchema.safeParse(query);
  if (!parsedQuery.success)
    return cmsEditorialValidationError(request, 400, parsedQuery.error.issues);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/authoring-context${forwardedQuery.size === 0 ? '' : `?${forwardedQuery.toString()}`}`,
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
      editorialAuthoringContextErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.read,
    );

  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, 502);
  const parsed = AuthoringContextReadSchema.safeParse({
    query: parsedQuery.data,
    resource: body.value,
  });
  if (!parsed.success) return cmsEditorialLocalError(request, 502);
  const expectedEtag = await representationEtag(parsed.data.resource);
  if (upstream.headers.get('etag') !== expectedEtag)
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(parsed.data.resource), {
    status: 200,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

/**
 * First-party CMS-03B-12 conflict-detail read. Both path UUIDs are exact;
 * a malformed address names no conflict, so it is concealed locally as 404
 * rather than forwarded, and a valid address may carry no query. Only a
 * bounded strict resource bound to the conflict/entry version and hash ETag
 * is relayed; private identity never passes through because the contract
 * itself is strict.
 */
export const forwardCmsEditorialConflictDetailRead = async (
  request: Request,
  entryId: string | undefined,
  conflictId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  const path = ConflictDetailPathParamsSchema.safeParse({
    entryId,
    conflictId,
  });
  if (!path.success)
    return cmsEditorialValidationError(request, 400, path.error.issues);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX}/${encodeURIComponent(path.data.entryId)}/conflicts/${encodeURIComponent(path.data.conflictId)}`,
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
      editorialConflictDetailErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.read,
    );

  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, 502);
  const parsed = ConflictDetailResourceSchema.safeParse(body.value);
  if (
    !parsed.success ||
    parsed.data.entry.id !== path.data.entryId ||
    parsed.data.conflict.id !== path.data.conflictId ||
    (parsed.data.conflict.state === 'open' && parsed.data.paths.length === 0)
  )
    return cmsEditorialLocalError(request, 502);
  const expectedEtag = `"${parsed.data.conflict.id}:${parsed.data.conflict.version}:${parsed.data.entry.version}:${parsed.data.conflict.conflictHash}"`;
  if (upstream.headers.get('etag') !== expectedEtag)
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};
