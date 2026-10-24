import {
  CmsUuidSchema,
  GovernedReviewQueueQuerySchema,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewQueueQuery,
} from '@wejammin/contracts';

import {
  boundGovernedDetail,
  boundGovernedPage,
} from './cms-governed-review-binding';
import {
  governedLocalError,
  relayGovernedError,
} from './cms-governed-review-platform-errors';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/**
 * Server-only first-party proxies for the two protected governed-review reads:
 * CMS-03C-10 detail and CMS-03C-11 queue (BE03c rows 172, 173). A safe read
 * carries no body, no `Idempotency-Key` and no `If-Match`, never mutates, and
 * relays only a bounded strict resource that answers the identity or filter that
 * was asked for and carries the strong validator. The URL owns the typed query:
 * an unknown or duplicate member is refused here rather than dropped on the way
 * to the Worker.
 */
export type CmsGovernedReadOperationId = 'CMS-03C-10' | 'CMS-03C-11';

export type CmsGovernedReadParams = Readonly<{
  reviewId?: string | undefined;
}>;

const STRONG_ETAG = /^"[\x21\x23-\x7e]{1,256}"$/u;
const MAX_CURSOR = 512;
const LIMIT_SYNTAX = /^[0-9]{1,6}$/u;
const QUEUE_KEYS: ReadonlySet<string> = new Set([
  'cursor',
  'limit',
  'scope',
  'state',
  'subjectKind',
]);
/** A native GET form submits an empty optional control: that is absence. */
const EMPTY_IS_ABSENT: ReadonlySet<string> = new Set(['state', 'subjectKind']);

interface ReadPlan {
  readonly route: string;
  /** The members forwarded in the query string, in request order. */
  readonly query: URLSearchParams;
  /** The strict, request-bound resource of a 200 body with its validator operand, or null. */
  readonly verify: (body: unknown, etag: string) => unknown;
}

const detailPlan = (
  request: Request,
  params: CmsGovernedReadParams,
): ReadPlan | Response => {
  const reviewId = CmsUuidSchema.safeParse(params.reviewId);
  // CMS-03C-10 is addressed entirely by path: any query key is a 400.
  if (!reviewId.success || new URL(request.url).search !== '')
    return governedLocalError(request, 'CMS-03C-10', 400);
  return {
    route: `/api/v1/cms/governed-reviews/${reviewId.data}`,
    query: new URLSearchParams(),
    verify: (body, etag) => {
      const detail: GovernedReviewDetailResource | null = boundGovernedDetail(
        body,
        reviewId.data,
      );
      return detail !== null && etag === `"${detail.version}"` ? detail : null;
    },
  };
};

const queuePlan = (request: Request): ReadPlan | Response => {
  const url = new URL(request.url);
  const refuse = (): Response => governedLocalError(request, 'CMS-03C-11', 400);
  const members: Record<string, string> = {};
  const forwarded = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!QUEUE_KEYS.has(key) || Object.hasOwn(members, key)) return refuse();
    members[key] = value;
    if (EMPTY_IS_ABSENT.has(key) && value === '') continue;
    forwarded.set(key, value);
  }
  const { cursor, limit, ...filters } = members;
  if (cursor !== undefined && (cursor === '' || cursor.length > MAX_CURSOR))
    return refuse();
  if (limit !== undefined && !LIMIT_SYNTAX.test(limit)) return refuse();
  const candidate: Record<string, unknown> = { ...filters };
  for (const name of EMPTY_IS_ABSENT)
    if (candidate[name] === '') delete candidate[name];
  if (cursor !== undefined) candidate.cursor = cursor;
  if (limit !== undefined) candidate.limit = Number(limit);
  const parsed = GovernedReviewQueueQuerySchema.safeParse(candidate);
  if (!parsed.success) {
    const member = String(parsed.error.issues[0]?.path[0] ?? '');
    return governedLocalError(request, 'CMS-03C-11', 422, {
      violations: [
        {
          path: QUEUE_KEYS.has(member) ? `/${member}` : '/',
          code: 'invalid',
        },
      ],
    });
  }
  const query: GovernedReviewQueueQuery = parsed.data;
  return {
    route: '/api/v1/cms/governed-reviews',
    query: forwarded,
    verify: (body, etag) => {
      const page: GovernedReviewQueuePage | null = boundGovernedPage(
        body,
        query,
      );
      return page !== null && etag === `"${page.pageVersion}"` ? page : null;
    },
  };
};

/** Browser-facing transport for a protected governed-review read. */
export const forwardCmsGovernedReviewRead = async (
  operationId: CmsGovernedReadOperationId,
  request: Request,
  params: CmsGovernedReadParams,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return governedLocalError(request, operationId, 503);
  const admission = readAdmissionStatus(request);
  if (admission !== null)
    return governedLocalError(request, operationId, admission);
  const plan =
    operationId === 'CMS-03C-10'
      ? detailPlan(request, params)
      : queuePlan(request);
  if (plan instanceof Response) return plan;

  const search = plan.query.size === 0 ? '' : `?${plan.query.toString()}`;
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${plan.route}${search}`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
      ),
    );
  } catch {
    return governedLocalError(request, operationId, 503);
  }
  if (!(upstream instanceof Response))
    return governedLocalError(request, operationId, 503);
  if (upstream.status !== 200)
    return relayGovernedError(request, upstream, operationId);

  // A 200 without a strong validator, or whose body is not the strict resource
  // bound to the request, is an invalid upstream answer.
  const etag = upstream.headers.get('etag');
  if (etag === null || !STRONG_ETAG.test(etag))
    return governedLocalError(request, operationId, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  const verified = body.ok ? plan.verify(body.value, etag) : null;
  if (verified === null) return governedLocalError(request, operationId, 502);
  return new Response(JSON.stringify(verified), {
    status: 200,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};
