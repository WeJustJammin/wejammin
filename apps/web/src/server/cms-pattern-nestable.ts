import {
  CMS_PATTERN_NESTABLE_TYPES_MAX,
  CmsUuidSchema,
  createRequestId,
  PatternSelectorPageSchema,
} from '@wejammin/contracts';

import {
  compositionInstancesError,
  forwardedCompositionInstancesError,
} from './cms-composition-instances-errors';
import { honoursQuery } from './cms-composition-instances-selector';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

const PATH = '/api/v1/cms/patterns/nestable';
const KEYS: ReadonlySet<string> = new Set(['contentTypeId', 'cursor', 'limit']);
const MAX_CURSOR = 512;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
/** A canonical decimal integer: no plus sign, no padding, no fraction. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;
/** BE03c error matrix (DEC-232): this read declares no 409; every cursor fault is a 400. */
const UNDECLARED: ReadonlySet<number> = new Set([409]);

const violation = (path: '/limit' | '/contentTypeId') =>
  ({
    violations: [{ path, code: 'invalid', message: 'The value is invalid.' }],
  }) as const;

type Query = Readonly<{
  contentTypeIds: readonly string[];
  cursor: string | null;
  limit: number;
}>;
type Parsed =
  | Readonly<{ ok: true; query: Query }>
  | Readonly<{
      ok: false;
      status: 400 | 422;
      member?: '/limit' | '/contentTypeId';
    }>;

/**
 * The allowlisted query (BE03c 413): `contentTypeId` repeated 1-64 times (UUIDs, none twice), an optional bounded cursor
 * and a 1-50 limit that defaults to 25. A malformed value is 400; a count or a limit out of its bounds is the 422 that
 * names the member.
 */
const parseQuery = (search: URLSearchParams): Parsed => {
  const types: string[] = [];
  const found = new Map<string, string>();
  for (const [key, value] of search) {
    if (!KEYS.has(key) || value === '') return { ok: false, status: 400 };
    if (key === 'contentTypeId') {
      types.push(value);
      continue;
    }
    if (found.has(key)) return { ok: false, status: 400 };
    found.set(key, value);
  }
  const cursor = found.get('cursor');
  const limit = found.get('limit');
  if (
    types.length === 0 ||
    types.some((type) => !CmsUuidSchema.safeParse(type).success) ||
    new Set(types.map((type) => type.toLowerCase())).size !== types.length ||
    (cursor !== undefined && cursor.length > MAX_CURSOR) ||
    (limit !== undefined && !LIMIT_SYNTAX.test(limit))
  )
    return { ok: false, status: 400 };
  if (types.length > CMS_PATTERN_NESTABLE_TYPES_MAX)
    return { ok: false, status: 422, member: '/contentTypeId' };
  const requested = limit === undefined ? DEFAULT_LIMIT : Number(limit);
  if (requested < 1 || requested > MAX_LIMIT)
    return { ok: false, status: 422, member: '/limit' };
  return {
    ok: true,
    query: { contentTypeIds: types, cursor: cursor ?? null, limit: requested },
  };
};

/**
 * Server-only first-party proxy for cmsPatternNestableRead (`GET /api/v1/cms/patterns/nestable`, DEC-196, BE03c 184): the
 * active pattern versions of the caller's owner party that list every requested content type, for the nested-pattern
 * picker of the pattern version designer. The query allowlist, the absence of a body, an `Idempotency-Key`, an `If-Match`
 * and a media type are checked here and never reach the Worker; the forwarded headers are the session allowlist, so a
 * browser's conditional headers cannot turn the read into a 304. A 200 is relayed only as the strict page that honours the
 * request and whose strong ETag is its `pageVersion`. The matrix declares no 409 for this read (DEC-232), so one is a local 502.
 */
export const readCmsPatternNestable = async (
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
      parsed.member === undefined ? {} : violation(parsed.member),
    );

  const { query } = parsed;
  const target = new URL(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${PATH}`);
  for (const type of query.contentTypeIds)
    target.searchParams.append('contentTypeId', type);
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
      : forwardedCompositionInstancesError(
          request,
          upstream,
          'cmsPatternNestableRead',
        );

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
