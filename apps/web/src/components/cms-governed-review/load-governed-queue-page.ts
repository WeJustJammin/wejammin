import {
  GovernedReviewQueuePageSchema,
  type GovernedReviewQueuePage,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageNoticeOutcome } from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import {
  CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT,
  CMS_REVIEW_QUEUE_RESTART_MARKER,
} from '../cms-editorial-pages/load-review-queue-page';
import type { CmsGovernedPageReads } from './governed-review-page-reads';

export interface CmsGovernedQueuePageView {
  readonly page: GovernedReviewQueuePage;
  readonly routePath: string;
  /** The request's URL-owned state: scope, filters, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement for the page (the list restarted), else null. */
  readonly announcement: string | null;
}

export const GOVERNED_QUEUE_DESCRIPTION =
  'Review and approve templates, patterns and vocabularies.';

const RESTART_STATUSES: ReadonlySet<number> = new Set([400, 422]);

/**
 * A 200 that is not the strict page is a degraded read like any other: the closed notice offers Retry at the same list
 * position (DEC-242(1), FE03 1018/1630: the queue has no in-place re-read and no browser cache).
 */
const unverified = (retryHref: string): CmsEditorialPageNoticeOutcome => {
  // `cmsEditorialUnverifiedNotice` answers a notice by construction (it has no redirect form).
  const { notice } = cmsEditorialUnverifiedNotice(
    'Definition reviews',
  ) as Extract<CmsEditorialPageNoticeOutcome, { kind: 'notice' }>;
  return { kind: 'notice', notice: { ...notice, retryHref } };
};

const search = (params: URLSearchParams): string => {
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/**
 * The protected CMS-03C-11 queue. The URL owns the scope, filters, limit and
 * signed cursor. A cursor the API refused with 409 (expired, tampered, foreign or
 * a changed collection) drops ONLY the cursor, keeps the filters and loads the
 * first page with a polite announcement; any other refused query restarts from
 * the bare route and an expired session returns to the exact position. A 200
 * must be the strict page: a row that names a person or a party beyond its
 * contract is refused, never rendered.
 */
export const loadGovernedQueuePage = async (input: {
  readonly request: Request;
  readonly reads: CmsGovernedPageReads;
}): Promise<CmsEditorialPageOutcome<CmsGovernedQueuePageView>> => {
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
    return unverified(here);
  }
  const parsed = GovernedReviewQueuePageSchema.safeParse(body);
  if (!parsed.success) return unverified(here);
  return {
    kind: 'view',
    status: 200,
    title: 'Definition reviews',
    heading: 'Definition reviews',
    description: GOVERNED_QUEUE_DESCRIPTION,
    view: {
      page: parsed.data,
      routePath: url.pathname,
      query: Object.fromEntries(params),
      announcement: restarted ? CMS_REVIEW_QUEUE_RESTART_ANNOUNCEMENT : null,
    },
  };
};
