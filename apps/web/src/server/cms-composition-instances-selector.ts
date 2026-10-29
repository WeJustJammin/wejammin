import {
  CmsUuidSchema,
  createRequestId,
  PatternSelectorPageSchema,
  type PatternSelectorPage,
} from '@wejammin/contracts';

import {
  compositionInstancesError,
  forwardedCompositionInstancesError,
} from './cms-composition-instances-errors';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

const PATH = '/api/v1/cms/patterns/selector';
const KEYS: ReadonlySet<string> = new Set(['contentTypeId', 'cursor', 'limit']);
const MAX_CURSOR = 512;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
/** A canonical decimal integer: no plus sign, no padding, no fraction. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;
/** BE03c error matrix, CMS-03C-13: a bounded read declares no 409. */
const UNDECLARED: ReadonlySet<number> = new Set([409]);

const LIMIT_VIOLATION = {
  violations: [
    { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
  ],
} as const;

type Query = Readonly<{
  contentTypeId: string;
  cursor: string | null;
  limit: number;
}>;
type Parsed =
  | Readonly<{ ok: true; query: Query }>
  | Readonly<{ ok: false; status: 400 | 422 }>;

/** The allowlisted query: one UUID, an optional bounded cursor and a 1-50 limit that defaults to 25. */
const parseQuery = (search: URLSearchParams): Parsed => {
  const found = new Map<string, string>();
  for (const [key, value] of search) {
    if (!KEYS.has(key) || found.has(key) || value === '')
      return { ok: false, status: 400 };
    found.set(key, value);
  }
  const contentTypeId = found.get('contentTypeId');
  const cursor = found.get('cursor');
  const limit = found.get('limit');
  if (
    contentTypeId === undefined ||
    !CmsUuidSchema.safeParse(contentTypeId).success ||
    (cursor !== undefined && cursor.length > MAX_CURSOR) ||
    (limit !== undefined && !LIMIT_SYNTAX.test(limit))
  )
    return { ok: false, status: 400 };
  const requested = limit === undefined ? DEFAULT_LIMIT : Number(limit);
  if (requested < 1 || requested > MAX_LIMIT) return { ok: false, status: 422 };
  return {
    ok: true,
    query: { contentTypeId, cursor: cursor ?? null, limit: requested },
  };
};

const bytewise = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * At most `limit` rows, no version row twice, the signed keyset order, and a cursor only after a full page. Shared with the
 * nestable-pattern proxy (cmsPatternNestableRead answers the same page).
 */
export const honoursQuery = (
  page: PatternSelectorPage,
  query: Readonly<{ limit: number }>,
): boolean => {
  const { items, nextCursor } = page;
  if (items.length > query.limit) return false;
  if (new Set(items.map((item) => item.patternVersionId)).size !== items.length)
    return false;
  if (
    nextCursor !== null &&
    (nextCursor === '' || items.length !== query.limit)
  )
    return false;
  return items.every((item, index) => {
    const previous = items[index - 1];
    if (previous === undefined) return true;
    const order = bytewise(previous.patternKey, item.patternKey);
    return (
      order < 0 ||
      (order === 0 && previous.patternVersion > item.patternVersion)
    );
  });
};

/**
 * Server-only first-party proxy for CMS-03C-13 (`GET /api/v1/cms/patterns/selector`, BE03c 175): the active, compatible
 * pattern versions of the caller's owner party for one content type. The query allowlist, the absence of a body, an
 * `Idempotency-Key`, an `If-Match` and a media type are checked here and never reach the Worker; the forwarded headers
 * are the session allowlist, so a browser's conditional headers cannot turn the read into a 304. A 200 is relayed only
 * as the strict page that honours the request and whose strong ETag is its `pageVersion`.
 */
export const readCmsPatternSelector = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return compositionInstancesError(request, 503);
  if (request.method !== 'GET') return compositionInstancesError(request, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null) return compositionInstancesError(request, admission);
  if (!cmsEditorialSameOriginRequest(request))
    return compositionInstancesError(request, 403);
  const parsed = parseQuery(new URL(request.url).searchParams);
  if (!parsed.ok)
    return compositionInstancesError(
      request,
      parsed.status,
      parsed.status === 422 ? LIMIT_VIOLATION : {},
    );

  const { query } = parsed;
  const target = new URL(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${PATH}`);
  target.searchParams.set('contentTypeId', query.contentTypeId);
  if (query.cursor !== null) target.searchParams.set('cursor', query.cursor);
  target.searchParams.set('limit', String(query.limit));
  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(target, {
        method: 'GET',
        headers: cmsEditorialForwardHeaders(request),
        signal: request.signal,
      }),
    );
    if (!(answer instanceof Response))
      return compositionInstancesError(request, 503);
    upstream = answer;
  } catch {
    return compositionInstancesError(request, 503);
  }
  if (upstream.status !== 200)
    return UNDECLARED.has(upstream.status)
      ? compositionInstancesError(request, 502)
      : forwardedCompositionInstancesError(request, upstream, 'CMS-03C-13');

  const body = await cmsEditorialBoundedResponseJson(upstream);
  const page = body.ok ? PatternSelectorPageSchema.safeParse(body.value) : null;
  if (
    page === null ||
    !page.success ||
    !honoursQuery(page.data, query) ||
    upstream.headers.get('etag') !== `"${page.data.pageVersion}"`
  )
    return compositionInstancesError(request, 502);
  return new Response(JSON.stringify(page.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      etag: `"${page.data.pageVersion}"`,
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};
