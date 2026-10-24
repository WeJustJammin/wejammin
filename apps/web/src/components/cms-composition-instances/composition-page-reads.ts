import { retryingSafeRead } from '../../lib/safe-read-retry';
import { readCmsCompositionInstances } from '../../server/cms-composition-instances-list';
import { readCmsPatternSelector } from '../../server/cms-composition-instances-selector';
import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialEntryDraftDetailRead,
} from '../../server/cms-editorial-platform-reads';
import { SELECTOR_PAGE_LIMIT } from './composition-reads';

/**
 * The protected reads the composition page performs, behind one seam. The Astro page builds it from the PLATFORM_API
 * binding; the loader takes it as a parameter, so a loader test drives the real parsing and view logic with only the
 * proxy edge replaced.
 */
export interface CompositionPageReads {
  /** CMS-03B-11: the entry's draft detail: `entry.version`, the draft `revision.id` and `schemaVersionId`. */
  readonly draftDetail: (
    request: Request,
    entryId: string,
  ) => Promise<Response>;
  /**
   * cmsCompositionInstancesRead (DEC-206): one page of at most `limit` (1-50) instances of the entry's current draft
   * revision, after the opaque signed `cursor` of the page before (null for the first). Its 403 is the page-level 403.
   */
  readonly instances: (
    request: Request,
    entryId: string,
    cursor: string | null,
    limit: number,
  ) => Promise<Response>;
  /** CMS-03B-14: the content type of the draft's schema version, whose id the selector is queried by. */
  readonly authoringContext: (
    request: Request,
    contentTypeVersionId: string,
  ) => Promise<Response>;
  /** CMS-03C-13: the first page of the active patterns compatible with the content type. */
  readonly selector: (
    request: Request,
    contentTypeId: string,
  ) => Promise<Response>;
}

/** A GET with only the session headers of the page request and a path and query of its own. */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createCompositionPageReads = (
  binding: unknown,
): CompositionPageReads => ({
  draftDetail: (request, entryId) =>
    forwardCmsEditorialEntryDraftDetailRead(
      derivedRead(
        request,
        `/api/v1/cms/entries/${encodeURIComponent(entryId)}`,
      ),
      binding,
      entryId,
    ),
  // FE03 :1173: a 502, 503 or 504 the BE declares safe is retried twice (250 ms, 750 ms); a 429 is not retried.
  instances: (request, entryId, cursor, limit) =>
    retryingSafeRead(() =>
      readCmsCompositionInstances(
        derivedRead(
          request,
          `/api/v1/cms/entries/${encodeURIComponent(entryId)}/compositions?limit=${limit}${
            cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
          }`,
        ),
        binding,
        entryId,
      ),
    ),
  authoringContext: (request, contentTypeVersionId) =>
    forwardCmsEditorialAuthoringContextRead(
      derivedRead(
        request,
        `/api/v1/cms/entries/authoring-context?contentTypeVersionId=${encodeURIComponent(contentTypeVersionId)}`,
      ),
      binding,
    ),
  // FE03 :1173: a 502, 503 or 504 the BE declares safe is retried twice (250 ms, 750 ms); a 429 is not retried.
  selector: (request, contentTypeId) =>
    retryingSafeRead(() =>
      readCmsPatternSelector(
        derivedRead(
          request,
          `/api/v1/cms/patterns/selector?contentTypeId=${encodeURIComponent(contentTypeId)}&limit=${SELECTOR_PAGE_LIMIT}`,
        ),
        binding,
      ),
    ),
});
