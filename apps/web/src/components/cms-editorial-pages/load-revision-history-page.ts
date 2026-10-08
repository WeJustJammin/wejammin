import {
  ApiErrorSchema,
  CmsUuidSchema,
  EntryDraftDetailResourceSchema,
  RevisionHistoryPageSchema,
  type RevisionHistoryPage,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialRevisionHistoryPageView {
  readonly page: RevisionHistoryPage;
  readonly entryId: string;
  readonly routePath: string;
  /** The request's URL-owned state: filters, cursor, compared revision. */
  readonly query: Readonly<Record<string, string>>;
  /** The entry version the restore CAS needs; null when it cannot be read. */
  readonly expectedVersion: string | null;
  /** A typed refusal of the comparison, shown instead of any change list. */
  readonly refusal: 'comparison_too_large' | 'comparison_unavailable' | null;
}

const REFUSALS = new Set(['comparison_too_large', 'comparison_unavailable']);

const refusalOf = async (
  response: Response,
): Promise<CmsEditorialRevisionHistoryPageView['refusal']> => {
  if (response.status !== 422) return null;
  try {
    const parsed = ApiErrorSchema.safeParse(await response.clone().json());
    const reason = parsed.success ? parsed.data.details.reasonCode : null;
    return typeof reason === 'string' && REFUSALS.has(reason)
      ? (reason as 'comparison_too_large' | 'comparison_unavailable')
      : null;
  } catch {
    return null;
  }
};

const withoutParams = (request: Request, names: readonly string[]): Request => {
  const url = new URL(request.url);
  for (const name of names) url.searchParams.delete(name);
  return new Request(url, { method: 'GET', headers: request.headers });
};

/**
 * The protected CMS-03B-03 history and comparison surface. The URL owns the
 * filters, cursor and compared revision. A typed 422 of the comparison is a
 * refusal rendered beside the list (the list is re-read without the comparison),
 * never a truncated success; a stale cursor restarts from the first page; and a
 * restore is only offered with the entry version read fresh for its CAS.
 */
export const loadRevisionHistoryPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialRevisionHistoryPageView>> => {
  const url = new URL(input.request.url);
  const routePath = url.pathname;
  const here = `${url.pathname}${url.search}`;
  const query = Object.fromEntries(url.searchParams);
  const restart = new URL(url);
  restart.searchParams.delete('cursor');
  const restartHref = `${restart.pathname}${restart.search}`;
  const noticeContext = (status: number) => ({
    subject: 'history' as const,
    returnTo: here,
    retryHref: status === 409 ? restartHref : here,
  });
  if (!CmsUuidSchema.safeParse(input.entryId).success)
    return {
      kind: 'notice',
      notice: {
        status: 400,
        title: 'Invalid request',
        heading: 'Invalid request',
        message:
          'This request could not be read. Check the address and try again.',
        retryHref: null,
        requestId: null,
      },
    };

  let response = await input.reads.revisionHistory(
    input.request,
    input.entryId,
  );
  let refusal: CmsEditorialRevisionHistoryPageView['refusal'] = null;
  if (response.status !== 200) {
    refusal = await refusalOf(response);
    if (refusal === null)
      return cmsEditorialNoticeFor(response, noticeContext(response.status));
    // The list is still shown: re-read it without the comparison and without
    // the cursor, which was signed for the query that included it.
    response = await input.reads.revisionHistory(
      withoutParams(input.request, ['compareRevisionId', 'cursor']),
      input.entryId,
    );
    if (response.status !== 200)
      return cmsEditorialNoticeFor(response, noticeContext(response.status));
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Revision history');
  }
  const parsed = RevisionHistoryPageSchema.safeParse(body);
  if (!parsed.success) return cmsEditorialUnverifiedNotice('Revision history');

  let expectedVersion: string | null = null;
  if (parsed.data.compare?.restore?.availability === 'available') {
    const detail = await input.reads.draftDetail(
      withoutParams(input.request, [...url.searchParams.keys()]),
      input.entryId,
    );
    if (detail.status === 200) {
      const resource = EntryDraftDetailResourceSchema.safeParse(
        await detail.json().catch(() => null),
      );
      if (resource.success && resource.data.entry.id === input.entryId)
        expectedVersion = resource.data.entry.version;
    }
  }
  return {
    kind: 'view',
    status: 200,
    title: 'Revision history',
    heading: 'Revision history',
    description: 'Authorized revision summaries and changes.',
    view: {
      page: parsed.data,
      entryId: input.entryId,
      routePath,
      query,
      expectedVersion,
      refusal,
    },
  };
};
