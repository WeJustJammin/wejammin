import {
  ReviewQueuePageSchema,
  type ReviewQueuePage,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialReviewQueuePageView {
  readonly page: ReviewQueuePage;
  readonly routePath: string;
  /** The request's URL-owned state: scope, state filter, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement for the page (the list restarted), else null. */
  readonly announcement: string | null;
}

/** One-shot marker of a queue restarted after a cursor 409; never forwarded. */
export const CMS_REVIEW_QUEUE_RESTART_MARKER = 'listChanged';

export const CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT =
  'The list changed, so it restarted from the first page. Your filters are kept.';

const RESTART_STATUSES: ReadonlySet<number> = new Set([400, 422]);

const search = (params: URLSearchParams): string => {
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/**
 * The protected CMS-03B-17 queue. The URL owns the scope, state filter, limit
 * and signed cursor. A cursor the API refused with 409 (expired, tampered,
 * foreign or a changed collection) drops ONLY the cursor, keeps the filters and
 * loads the first page with a polite announcement; any other refused query
 * restarts from the bare route and an expired session returns to the exact
 * position. A 200 must be the strict page: a row that names a person or an
 * entry beyond its contract is refused, never rendered.
 */
export const loadReviewQueuePage = async (input: {
  readonly request: Request;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialReviewQueuePageView>> => {
  const url = new URL(input.request.url);
  const restarted =
    url.searchParams.get(CMS_REVIEW_QUEUE_RESTART_MARKER) === '1';
  const params = new URLSearchParams(url.searchParams);
  params.delete(CMS_REVIEW_QUEUE_RESTART_MARKER);
  const here = `${url.pathname}${search(params)}`;
  const readRequest = restarted
    ? new Request(`${url.origin}${here}`, {
        method: 'GET',
        headers: input.request.headers,
      })
    : input.request;
  const response = await input.reads.reviewQueue(readRequest);
  if (response.status === 409 && params.has('cursor') && !restarted) {
    const first = new URLSearchParams(params);
    first.delete('cursor');
    first.set(CMS_REVIEW_QUEUE_RESTART_MARKER, '1');
    return { kind: 'redirect', location: `${url.pathname}${search(first)}` };
  }
  if (response.status !== 200) {
    const first = new URLSearchParams(params);
    first.delete('cursor');
    return cmsEditorialNoticeFor(response, {
      subject: 'reviews',
      returnTo: here,
      retryHref: RESTART_STATUSES.has(response.status)
        ? url.pathname
        : response.status === 409
          ? `${url.pathname}${search(first)}`
          : here,
    });
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Reviews');
  }
  const parsed = ReviewQueuePageSchema.safeParse(body);
  if (!parsed.success) return cmsEditorialUnverifiedNotice('Reviews');
  return {
    kind: 'view',
    status: 200,
    title: 'Reviews',
    heading: 'Reviews',
    description: 'Find the reviews assigned to you or submitted by you.',
    view: {
      page: parsed.data,
      routePath: url.pathname,
      query: Object.fromEntries(params),
      announcement: restarted ? CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT : null,
    },
  };
};
