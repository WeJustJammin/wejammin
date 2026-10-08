import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryDraftDetailRead,
  forwardCmsEditorialEntryListRead,
  forwardCmsEditorialRevisionHistoryRead,
} from '../../server/cms-editorial-platform-reads';

/**
 * The protected first-party reads a CMS editorial page performs, behind one
 * seam. The Astro pages build it from the PLATFORM_API binding; the loaders take
 * it as a parameter, so a loader test drives the real parsing and view logic
 * with only the proxy edge replaced.
 */
export interface CmsEditorialPageReads {
  readonly draftDetail: (
    request: Request,
    entryId: string,
  ) => Promise<Response>;
  /** CMS-03B-14; with a version id the author-safe field definitions too. */
  readonly authoringContext: (
    request: Request,
    contentTypeVersionId?: string,
  ) => Promise<Response>;
  readonly conflictDetail: (
    request: Request,
    entryId: string,
    conflictId: string,
  ) => Promise<Response>;
  readonly revisionHistory: (
    request: Request,
    entryId: string,
  ) => Promise<Response>;
  readonly entryList: (request: Request) => Promise<Response>;
}

/**
 * A GET with only the session headers of the page request and a path and query
 * of its own: the page's URL-owned state never leaks into a read that does not
 * own it (the conflict read accepts no query at all).
 */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createCmsEditorialPageReads = (
  binding: unknown,
): CmsEditorialPageReads => ({
  draftDetail: (request, entryId) =>
    forwardCmsEditorialEntryDraftDetailRead(request, binding, entryId),
  authoringContext: (request, contentTypeVersionId) =>
    forwardCmsEditorialAuthoringContextRead(
      contentTypeVersionId === undefined
        ? request
        : derivedRead(
            request,
            `/api/v1/cms/entries/authoring-context?contentTypeVersionId=${encodeURIComponent(contentTypeVersionId)}`,
          ),
      binding,
    ),
  conflictDetail: (request, entryId, conflictId) =>
    forwardCmsEditorialConflictDetailRead(
      derivedRead(request, '/api/v1/cms/entries'),
      entryId,
      conflictId,
      binding,
    ),
  revisionHistory: (request, entryId) =>
    forwardCmsEditorialRevisionHistoryRead(request, binding, entryId),
  entryList: (request) => forwardCmsEditorialEntryListRead(request, binding),
});
