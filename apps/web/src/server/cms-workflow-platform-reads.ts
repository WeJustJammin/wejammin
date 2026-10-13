import {
  EditorialReviewDetailPathParamsSchema,
  EditorialReviewDetailResourceSchema,
  EntryWorkflowPathParamsSchema,
  EntryWorkflowQuerySchema,
  EntryWorkflowResourceSchema,
  ReviewQueuePageSchema,
  ReviewQueueQuerySchema,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedResponseJson,
  cmsEditorialForwardedError,
} from './cms-editorial-platform-bounded';
import { CMS_EDITORIAL_DETAIL_POLICIES } from './cms-editorial-platform-error-details';
import {
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
import { projectCmsWorkflowErrorDetails } from './cms-workflow-platform-errors';

/**
 * Server-only first-party proxies for the three Slice 11 protected reads:
 * CMS-03B-15 workflow and preparation, CMS-03B-16 review detail and
 * CMS-03B-17 reviewer queue. A safe read carries no body, no `Idempotency-Key`
 * and no `If-Match`, never mutates, and relays only a bounded strict resource
 * that names the identity that was asked for and carries a strong validator.
 * The URL owns the typed query; an unknown or duplicate member is refused here
 * rather than dropped on the way to the Worker.
 */

export type CmsWorkflowReadOperationId =
  'CMS-03B-15' | 'CMS-03B-16' | 'CMS-03B-17';

export type CmsWorkflowReadParams = Readonly<{
  entryId?: string | undefined;
  reviewId?: string | undefined;
}>;

const STRONG_ETAG = /^"[\x21\x23-\x7e]{1,256}"$/u;
const QUEUE_KEYS: ReadonlySet<string> = new Set([
  'cursor',
  'limit',
  'scope',
  'state',
]);

interface ReadPlan {
  /** The upstream path, or a Response when the identifier is malformed. */
  readonly route: string;
  /** The members forwarded in the query string, in request order. */
  readonly query: URLSearchParams;
  /** The strict, identity-bound resource of a 200 body, or null when it is not one. */
  readonly verify: (body: unknown, etag: string) => unknown;
}

const duplicateOrUnknown = (
  url: URL,
  allowed: ReadonlySet<string>,
): boolean => {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};

const workflowPlan = (
  request: Request,
  params: CmsWorkflowReadParams,
): ReadPlan | Response => {
  const path = EntryWorkflowPathParamsSchema.safeParse(params);
  if (!path.success) return cmsEditorialPathError(request, 'entryId');
  const url = new URL(request.url);
  if (duplicateOrUnknown(url, new Set(['revisionId'])))
    return cmsEditorialLocalError(request, 400);
  const rawRevision = url.searchParams.get('revisionId');
  // A native GET form submits an empty optional control: that is absence.
  const revisionId = rawRevision === '' ? null : rawRevision;
  const query = EntryWorkflowQuerySchema.safeParse({
    entryId: path.data.entryId,
    ...(revisionId === null ? {} : { revisionId }),
  });
  if (!query.success)
    return cmsEditorialValidationError(request, 400, query.error.issues);
  return {
    route: `/api/v1/cms/entries/${path.data.entryId}/workflow`,
    query: new URLSearchParams(
      revisionId === null ? [] : [['revisionId', revisionId]],
    ),
    verify: (body) => {
      const resource = EntryWorkflowResourceSchema.safeParse(body);
      return resource.success &&
        resource.data.entry.id === path.data.entryId &&
        (revisionId === null || resource.data.revision.id === revisionId)
        ? resource.data
        : null;
    },
  };
};

const detailPlan = (
  request: Request,
  params: CmsWorkflowReadParams,
): ReadPlan | Response => {
  const path = EditorialReviewDetailPathParamsSchema.safeParse(params);
  if (!path.success) return cmsEditorialPathError(request, 'reviewId');
  // CMS-03B-16 is addressed entirely by path: any query key is a 400.
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);
  return {
    route: `/api/v1/cms/reviews/${path.data.reviewId}`,
    query: new URLSearchParams(),
    verify: (body, etag) => {
      const resource = EditorialReviewDetailResourceSchema.safeParse(body);
      return resource.success &&
        resource.data.id === path.data.reviewId &&
        etag === `"${resource.data.version}"`
        ? resource.data
        : null;
    },
  };
};

const queuePlan = (request: Request): ReadPlan | Response => {
  const url = new URL(request.url);
  if (duplicateOrUnknown(url, QUEUE_KEYS))
    return cmsEditorialLocalError(request, 400);
  const query: Record<string, unknown> = {};
  const forwarded = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    // A native GET form submits empty optional controls: that is absence.
    if (key === 'state' && value === '') continue;
    if (key === 'cursor' && (value.length === 0 || value.length > 512))
      return cmsEditorialLocalError(request, 400);
    if (key === 'limit') {
      if (!/^[1-9][0-9]?$/u.test(value) || Number(value) > 50)
        return cmsEditorialLocalError(request, 400);
      query[key] = Number(value);
    } else query[key] = value;
    forwarded.set(key, value);
  }
  const parsed = ReviewQueueQuerySchema.safeParse(query);
  if (!parsed.success)
    return cmsEditorialValidationError(request, 400, parsed.error.issues);
  return {
    route: '/api/v1/cms/reviews',
    query: forwarded,
    verify: (body, etag) => {
      const page = ReviewQueuePageSchema.safeParse(body);
      return page.success && etag === `"${page.data.pageVersion}"`
        ? page.data
        : null;
    },
  };
};

const rowOf = (operationId: CmsWorkflowReadOperationId) => {
  const row = cmsEditorialRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  /* v8 ignore next -- registry parity is asserted by the route test */
  if (row === undefined) throw new Error(`unregistered ${operationId}`);
  return row;
};

/** Browser-facing transport for a Slice 11 protected read. */
export const forwardCmsWorkflowRead = async (
  operationId: CmsWorkflowReadOperationId,
  request: Request,
  params: CmsWorkflowReadParams,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'GET')
    return cmsEditorialLocalError(request, 503);
  const admissionStatus = readAdmissionStatus(request);
  if (admissionStatus !== null)
    return readAdmissionError(request, admissionStatus);
  const plan =
    operationId === 'CMS-03B-15'
      ? workflowPlan(request, params)
      : operationId === 'CMS-03B-16'
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
    return cmsEditorialLocalError(request, 503);
  }
  if (!(upstream instanceof Response))
    return cmsEditorialLocalError(request, 503);
  if (upstream.status !== 200)
    return cmsEditorialForwardedError(
      request,
      upstream,
      rowOf(operationId).errors,
      CMS_EDITORIAL_DETAIL_POLICIES.read,
      (status, code, details) =>
        projectCmsWorkflowErrorDetails(operationId, status, code, details),
    );

  // A 200 without a strong validator, or whose body is not the strict resource
  // bound to the identity asked for, is an invalid upstream answer.
  const etag = upstream.headers.get('etag');
  if (etag === null || !STRONG_ETAG.test(etag))
    return cmsEditorialLocalError(request, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  const verified = body.ok ? plan.verify(body.value, etag) : null;
  if (verified === null) return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(verified), {
    status: 200,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};
