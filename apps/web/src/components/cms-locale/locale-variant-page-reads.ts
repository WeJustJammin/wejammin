import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialEntryDraftDetailRead,
} from '../../server/cms-editorial-platform-reads';
import { readCmsLocaleVariant } from '../../server/cms-composition-platform-locale-read';
import { retryingSafeRead } from '../../lib/safe-read-retry';

/**
 * The protected reads the locale page performs, behind one seam. The Astro page builds it from the
 * PLATFORM_API binding; the loader takes it as a parameter, so a loader test drives the real parsing and
 * view logic with only the proxy edge replaced.
 */
export interface LocalePageReads {
  /** CMS-03B-11: the entry's draft detail, the source revision and the `If-Match` operand. */
  readonly draftDetail: (
    request: Request,
    entryId: string,
  ) => Promise<Response>;
  /** CMS-03B-14 for the draft's own schema version: the author-safe localizable field definitions. */
  readonly authoringContext: (
    request: Request,
    contentTypeVersionId: string,
  ) => Promise<Response>;
  /**
   * `cmsLocaleVariantRead` (DEC-205): the entry's current variant for the locale, its stored values, the CMS-03C-20
   * resolution of every localizable field and the active fallback order, in one read the Worker authorizes like
   * CMS-03C-04 (403 for a visible entry without edit, 404 for a hidden entry or an unsupported locale).
   */
  readonly localeVariant: (
    request: Request,
    entryId: string,
    locale: string,
  ) => Promise<Response>;
}

/** A GET with only the session headers of the page request and a path and query of its own. */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createLocalePageReads = (binding: unknown): LocalePageReads => ({
  draftDetail: (request, entryId) =>
    retryingSafeRead(() =>
      forwardCmsEditorialEntryDraftDetailRead(
        derivedRead(
          request,
          `/api/v1/cms/entries/${encodeURIComponent(entryId)}`,
        ),
        binding,
        entryId,
      ),
    ),
  authoringContext: (request, contentTypeVersionId) =>
    retryingSafeRead(() =>
      forwardCmsEditorialAuthoringContextRead(
        derivedRead(
          request,
          `/api/v1/cms/entries/authoring-context?contentTypeVersionId=${encodeURIComponent(contentTypeVersionId)}`,
        ),
        binding,
      ),
    ),
  localeVariant: (request, entryId, locale) =>
    retryingSafeRead(() =>
      readCmsLocaleVariant(
        derivedRead(
          request,
          `/api/v1/cms/entries/${encodeURIComponent(entryId)}/locales/${encodeURIComponent(locale)}`,
        ),
        entryId,
        locale,
        binding,
      ),
    ),
});
