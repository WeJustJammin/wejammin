import {
  CmsUuidSchema,
  EntryWorkflowResourceSchema,
  type EntryWorkflowResource,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialWorkflowPageView {
  readonly workflow: EntryWorkflowResource;
  readonly entryId: string;
  /** The URL-owned revision, else null for the entry's current draft. */
  readonly revisionId: string | null;
  readonly routePath: string;
  /** When the server verified this read; the island's `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

/**
 * The protected CMS-03B-15 workflow surface. The URL owns only the optional
 * `revisionId`; a refused query restarts at the bare route (never repeating the
 * bad query), an expired session returns to the exact position, and a 200 must
 * be the strict workflow for THIS entry: anything else is refused, never
 * rendered. The frozen manifest rides only in the island data of the no-store
 * document and is never put in a URL.
 */
export const loadWorkflowPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialWorkflowPageView>> => {
  const url = new URL(input.request.url);
  const here = `${url.pathname}${url.search}`;
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
  const response = await input.reads.workflow(input.request, input.entryId);
  if (response.status !== 200)
    return cmsEditorialNoticeFor(response, {
      subject: 'workflow',
      returnTo: here,
      retryHref:
        response.status === 400 || response.status === 422
          ? url.pathname
          : here,
    });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Review and publish');
  }
  const parsed = EntryWorkflowResourceSchema.safeParse(body);
  if (!parsed.success || parsed.data.entry.id !== input.entryId)
    return cmsEditorialUnverifiedNotice('Review and publish');
  return {
    kind: 'view',
    status: 200,
    title: 'Review and publish',
    heading: 'Review and publish',
    description:
      'Check, review, schedule, preview and publish the current draft of an entry.',
    view: {
      workflow: parsed.data,
      entryId: input.entryId,
      revisionId: url.searchParams.get('revisionId'),
      routePath: url.pathname,
      verifiedAt: new Date().toISOString(),
    },
  };
};
