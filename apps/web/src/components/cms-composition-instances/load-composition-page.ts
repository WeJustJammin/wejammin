import {
  AuthoringContextReadSchema,
  EntryDraftDetailResourceSchema,
  PatternSelectorPageSchema,
} from '@wejammin/contracts';

import { cmsEditorialCsrfCookie } from '../../server/cms-editorial-platform-shared';
import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import type { CompositionPageReads } from './composition-page-reads';
import { compositionPagePath } from './composition-path';
import { loadInstanceRows } from './load-composition-instances';
import type {
  CompositionEntryFacts,
  InstanceRow,
  SelectorPage,
} from './composition-types';

export interface CompositionPageView {
  readonly entry: CompositionEntryFacts;
  /** The first page of compatible patterns (CMS-03C-13); later pages are read by the island. */
  readonly selector: SelectorPage;
  /** The rows of the entry's current draft revision, in the render order the read answered (DEC-206). */
  readonly instances: readonly InstanceRow[];
  readonly csrfToken: string;
  /** The page path: sign-in and reload links return to it. */
  readonly path: string;
}

const closed = (
  status: number,
  title: string,
  message: string,
  retryHref: string | null = null,
): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status,
    title,
    heading: title,
    message,
    retryHref,
    requestId: null,
  },
});

/** The explicit degraded state of the instance list (FE03 read states): the list could not be loaded in full, so none of it is shown. */
const degraded = (retryHref: string): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status: 503,
    title: 'Composition',
    heading: 'Composition list unavailable',
    message:
      'The composition could not be loaded in full, so none of it is shown. Reload to try again.',
    retryHref,
    requestId: null,
  },
});

const forbidden = (): CmsEditorialPageOutcome<never> =>
  closed(
    403,
    'Access denied',
    'This account cannot edit the composition of this entry.',
  );

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * The protected composition page (FE03 1072, 1640; P2-S12-AC-269). The address is `:entryId` only: a malformed id or
 * ANY query is a 400 before a read. The entry draft is read first (CMS-03B-11): a missing session is the 303 sign-in
 * redirect, a concealed or absent entry the disclosure-safe 404. The instances of its current draft revision are read
 * next, every page, followed until the cursor ends (cmsCompositionInstancesRead, DEC-206), and that read is the edit-authority gate: its 403 is the
 * page-level 403 for a visible entry the account cannot edit. The draft's schema version names its content type
 * (CMS-03B-14), and the compatible patterns are read for it (CMS-03C-13). A revision that is not the editable draft is
 * shown read-only, not hidden. No view is built from an answer the strict contracts did not verify.
 */
export const loadCompositionPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly reads: CompositionPageReads;
  /** The clock of the instance walk's time budget; the wall clock unless a test supplies one. */
  readonly now?: () => number;
}): Promise<CmsEditorialPageOutcome<CompositionPageView>> => {
  const { request, entryId, reads } = input;
  const path = compositionPagePath(entryId);
  if (path === null || new URL(request.url).search !== '')
    return closed(
      400,
      'Invalid request',
      'This request could not be read. Check the address and try again.',
    );
  const context = { returnTo: path, retryHref: path };

  const draftResponse = await reads.draftDetail(request, entryId);
  if (draftResponse.status !== 200)
    return cmsEditorialNoticeFor(draftResponse, {
      subject: 'entry',
      ...context,
    });
  const draft = EntryDraftDetailResourceSchema.safeParse(
    await jsonOf(draftResponse),
  );
  if (!draft.success || draft.data.entry.id !== entryId)
    return cmsEditorialUnverifiedNotice('Composition');

  const listed = await loadInstanceRows({
    request,
    entryId,
    revisionId: draft.data.revision.id,
    reads,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (listed.kind === 'unverified')
    return cmsEditorialUnverifiedNotice('Composition');
  if (listed.kind === 'degraded') return degraded(path);
  if (listed.kind === 'response') {
    if (listed.response.status === 403) return forbidden();
    return cmsEditorialNoticeFor(listed.response, {
      subject: 'entry',
      ...context,
    });
  }

  const typeResponse = await reads.authoringContext(
    request,
    draft.data.schemaVersionId,
  );
  if (typeResponse.status !== 200)
    return cmsEditorialNoticeFor(typeResponse, {
      subject: 'entry',
      ...context,
    });
  const type = AuthoringContextReadSchema.safeParse({
    query: { contentTypeVersionId: draft.data.schemaVersionId },
    resource: await jsonOf(typeResponse),
  });
  const selected = type.success ? type.data.resource.selectedType : null;
  if (selected === null) return cmsEditorialUnverifiedNotice('Composition');

  const selectorResponse = await reads.selector(
    request,
    selected.contentTypeId,
  );
  if (selectorResponse.status === 403) return forbidden();
  if (selectorResponse.status !== 200)
    return cmsEditorialNoticeFor(selectorResponse, {
      subject: 'entry',
      ...context,
    });
  const patterns = PatternSelectorPageSchema.safeParse(
    await jsonOf(selectorResponse),
  );
  if (!patterns.success) return cmsEditorialUnverifiedNotice('Composition');

  return {
    kind: 'view',
    status: 200,
    title: 'Composition',
    heading: 'Composition',
    description:
      'Insert patterns and resolve pattern updates for the current draft.',
    view: {
      entry: {
        entryId,
        version: draft.data.entry.version,
        revisionId: draft.data.revision.id,
        contentTypeId: selected.contentTypeId,
        editable:
          draft.data.state === 'draft' && draft.data.lifecycle === 'active',
      },
      selector: patterns.data,
      instances: listed.rows,
      csrfToken: cmsEditorialCsrfCookie(request) ?? '',
      path,
    },
  };
};
