import { EntryListPageSchema, type EntryListPage } from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialEntryListPageView {
  readonly page: EntryListPage;
  readonly routePath: string;
  /** The request's URL-owned state: filters, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement for the page (the list restarted), else null. */
  readonly announcement: string | null;
}

/** Statuses after which repeating the same query cannot succeed. */
const RESTART_STATUSES: ReadonlySet<number> = new Set([400, 422]);

/**
 * One-shot marker of a list restarted after a cursor 409. It is the URL's own
 * state, never forwarded to the read (the list accepts no unknown query key).
 */
export const CMS_EDITORIAL_LIST_RESTART_MARKER = 'listChanged';

export const CMS_EDITORIAL_LIST_RESTART_ANNOUNCEMENT =
  'The list changed, so it restarted from the first page. Your filters are kept.';

const search = (params: URLSearchParams): string => {
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/**
 * The protected CMS-03B-13 list surface. The URL owns the state, filters and
 * signed cursor; the page only relays what the authenticated API answers. A
 * cursor the API refused with 409 (expired, tampered, foreign or a changed
 * collection; DEC-140) drops ONLY the cursor, keeps the filters and loads the
 * first page with a polite announcement (FE03:574); any other refused query
 * (invalid filter) restarts from the bare route, an expired session returns to
 * the exact position, and a 200 must be the strict page: a row that leaks an
 * owner or assignment identifier is refused, never rendered.
 */
export const loadEntryListPage = async (input: {
  readonly request: Request;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialEntryListPageView>> => {
  const url = new URL(input.request.url);
  const restarted =
    url.searchParams.get(CMS_EDITORIAL_LIST_RESTART_MARKER) === '1';
  const params = new URLSearchParams(url.searchParams);
  params.delete(CMS_EDITORIAL_LIST_RESTART_MARKER);
  const here = `${url.pathname}${search(params)}`;
  const readRequest = restarted
    ? new Request(`${url.origin}${here}`, {
        method: 'GET',
        headers: input.request.headers,
      })
    : input.request;
  const response = await input.reads.entryList(readRequest);
  if (response.status === 409 && params.has('cursor') && !restarted) {
    const first = new URLSearchParams(params);
    first.delete('cursor');
    first.set(CMS_EDITORIAL_LIST_RESTART_MARKER, '1');
    return {
      kind: 'redirect',
      location: `${url.pathname}${search(first)}`,
    };
  }
  if (response.status !== 200) {
    const first = new URLSearchParams(params);
    first.delete('cursor');
    return cmsEditorialNoticeFor(response, {
      subject: 'entries',
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
    return cmsEditorialUnverifiedNotice('Entries');
  }
  const parsed = EntryListPageSchema.safeParse(body);
  if (!parsed.success) return cmsEditorialUnverifiedNotice('Entries');
  return {
    kind: 'view',
    status: 200,
    title: 'Entries',
    heading: 'Entries',
    description: 'Review the entries assigned to you.',
    view: {
      page: parsed.data,
      routePath: url.pathname,
      query: Object.fromEntries(params),
      announcement: restarted ? CMS_EDITORIAL_LIST_RESTART_ANNOUNCEMENT : null,
    },
  };
};
