import {
  CmsUuidSchema,
  compositionInstancesPageHonours,
  CompositionInstancePageSchema,
  createRequestId,
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

const MAX_CURSOR = 512;
const MAX_LIMIT = 50;
/** A canonical decimal integer (no plus sign, no padding, no fraction), of any magnitude. */
const LIMIT_SYNTAX = /^[1-9][0-9]*$/u;
/** BE03c error matrix, cmsCompositionInstancesRead: a bounded read has no conflict and no validation answer. */
const UNDECLARED: ReadonlySet<number> = new Set([409, 422]);

type Parsed =
  | Readonly<{ ok: true; cursor: string | null; limit: number | null }>
  | Readonly<{ ok: false }>;

/**
 * The allowlisted query: the optional opaque signed cursor, bounded to 1-512 characters, and the optional `limit`, a
 * canonical integer 1-50 (BE03c `CompositionInstancesQuery`; the error matrix gives this read no 422, so a bad limit is
 * a 400). The default page size of 25 is the Worker's: nothing is defaulted here.
 */
const parseQuery = (search: URLSearchParams): Parsed => {
  const found = new Map<string, string>();
  for (const [key, value] of search) {
    if ((key !== 'cursor' && key !== 'limit') || found.has(key) || value === '')
      return { ok: false };
    found.set(key, value);
  }
  const cursor = found.get('cursor');
  if (cursor !== undefined && cursor.length > MAX_CURSOR) return { ok: false };
  const limitText = found.get('limit');
  if (limitText !== undefined && !LIMIT_SYNTAX.test(limitText))
    return { ok: false };
  const limit = limitText === undefined ? null : Number(limitText);
  if (limit !== null && limit > MAX_LIMIT) return { ok: false };
  return { ok: true, cursor: cursor ?? null, limit };
};

/**
 * Server-only first-party proxy for cmsCompositionInstancesRead (`GET /api/v1/cms/entries/{entryId}/compositions`,
 * DEC-206; BE03c route registry): the newest draft, active and pending-diff row of each path of the entry's current
 * draft revision, in render order, at most `limit` (1-50, default 25) per page, and the composition page's
 * edit-authority gate (403 for a visible entry the account cannot edit, a disclosure-safe 404 otherwise). The entry
 * path, the allowlisted query (the opaque signed cursor and the limit only), the absence of a body, an
 * `Idempotency-Key`, an `If-Match` and a media type are checked here and never reach the Worker; the forwarded headers
 * are the session allowlist, so a browser's conditional headers cannot turn the read into a 304. A 200 is relayed
 * only as the strict page that honours the request. The page carries no version, so no entity tag is relayed.
 */
export const readCmsCompositionInstances = async (
  request: Request,
  binding: unknown,
  entryId: string,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return compositionInstancesError(request, 503);
  if (request.method !== 'GET') return compositionInstancesError(request, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null) return compositionInstancesError(request, admission);
  if (!cmsEditorialSameOriginRequest(request))
    return compositionInstancesError(request, 403);
  const url = new URL(request.url);
  const query = parseQuery(url.searchParams);
  if (
    !query.ok ||
    !CmsUuidSchema.safeParse(entryId).success ||
    url.pathname !== `/api/v1/cms/entries/${entryId}/compositions`
  )
    return compositionInstancesError(request, 400);

  const target = new URL(
    `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/entries/${entryId}/compositions`,
  );
  if (query.cursor !== null) target.searchParams.set('cursor', query.cursor);
  if (query.limit !== null)
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
          'cmsCompositionInstancesRead',
        );

  const body = await cmsEditorialBoundedResponseJson(upstream);
  const page = body.ok
    ? CompositionInstancePageSchema.safeParse(body.value)
    : null;
  if (
    page === null ||
    !page.success ||
    !compositionInstancesPageHonours(page.data, {
      ...(query.cursor === null ? {} : { cursor: query.cursor }),
      ...(query.limit === null ? {} : { limit: query.limit }),
    })
  )
    return compositionInstancesError(request, 502);
  return new Response(JSON.stringify(page.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};
