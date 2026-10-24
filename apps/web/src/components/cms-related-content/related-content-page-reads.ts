import { readCmsRelatedContent } from '../../server/cms-composition-platform-related-read';
import {
  forwardCmsEditorialEntryDraftDetailRead,
  forwardCmsEditorialEntryListRead,
} from '../../server/cms-editorial-platform-reads';
import { retryingSafeRead } from '../../lib/safe-read-retry';
import { CANDIDATE_PAGE_LIMIT, ENTRY_LIST_PATH } from './related-candidates';

/**
 * The protected reads the related-content page performs, behind one seam. The Astro page builds it from
 * the PLATFORM_API binding; the loader takes it as a parameter, so a loader test drives the real
 * parsing and view logic with only the proxy edge replaced.
 */
export interface RelatedContentPageReads {
  /** CMS-03B-11: the entry's draft detail, whose `entry.version` is the `If-Match` operand. */
  readonly draftDetail: (
    request: Request,
    entryId: string,
  ) => Promise<Response>;
  /** CMS-03B-13: the first page of the entries the caller can read, the pin and exclusion candidates. */
  readonly entryList: (request: Request) => Promise<Response>;
  /**
   * `cmsRelatedContentRead` (DEC-195): the entry's saved rule, or none. It is also the page's edit-authority gate:
   * a 403 means the entry is visible but the caller cannot edit it.
   */
  readonly savedRule: (request: Request, entryId: string) => Promise<Response>;
}

/**
 * A GET with only the session headers of the page request and a path and query of its own: the page's
 * address never leaks into a read. The read proxies forward an allowlist of headers (the session), so
 * a browser's conditional headers cannot turn a read into a 304 (proved in the reads test).
 */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createRelatedContentPageReads = (
  binding: unknown,
): RelatedContentPageReads => ({
  draftDetail: (request, entryId) =>
    forwardCmsEditorialEntryDraftDetailRead(
      derivedRead(
        request,
        `/api/v1/cms/entries/${encodeURIComponent(entryId)}`,
      ),
      binding,
      entryId,
    ),
  entryList: (request) =>
    forwardCmsEditorialEntryListRead(
      derivedRead(request, `${ENTRY_LIST_PATH}?limit=${CANDIDATE_PAGE_LIMIT}`),
      binding,
    ),
  // FE03 :1173: a 502, 503 or 504 the BE declares safe is retried twice (250 ms, 750 ms); a 429 is not retried.
  savedRule: (request, entryId) =>
    retryingSafeRead(() =>
      readCmsRelatedContent(
        derivedRead(
          request,
          `/api/v1/cms/entries/${encodeURIComponent(entryId)}/related-content`,
        ),
        entryId,
        binding,
      ),
    ),
});
