import {
  AuthoringContextResourceSchema,
  type AuthoringContextField,
  type AuthoringContextType,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';

export interface CmsEditorialCreatePageView {
  readonly types: readonly AuthoringContextType[];
  readonly selected: AuthoringContextType | null;
  readonly fields: readonly AuthoringContextField[];
}

/**
 * The protected create surface for CMS-03B-10. The page owns preparation, not
 * authority: it reads the CMS-03B-14 AuthoringContext projection through the
 * first-party proxy and renders only what that verified projection carries.
 * Owner, assignee, acting party and capability stay server-derived and absent.
 * A failed or unverifiable preparation is a closed state, never a form that
 * could not be committed.
 */
export const loadEntryCreatePage = async (input: {
  readonly request: Request;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialCreatePageView>> => {
  const url = new URL(input.request.url);
  const upstream = await input.reads.authoringContext(input.request);
  if (upstream.status !== 200)
    return cmsEditorialNoticeFor(upstream, {
      subject: 'entries',
      returnTo: `${url.pathname}${url.search}`,
      retryHref: `${url.pathname}${url.search}`,
    });
  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Create entry');
  }
  const parsed = AuthoringContextResourceSchema.safeParse(body);
  if (!parsed.success) return cmsEditorialUnverifiedNotice('Create entry');
  return {
    kind: 'view',
    status: 200,
    title: 'Create entry',
    heading: 'Create entry',
    description: 'Create an entry.',
    view: {
      types: parsed.data.creatableTypes,
      selected: parsed.data.selectedType,
      fields: parsed.data.fields,
    },
  };
};
