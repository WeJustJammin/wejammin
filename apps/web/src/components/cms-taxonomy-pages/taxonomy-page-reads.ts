import {
  readCmsTaxonomyTerms,
  readCmsTaxonomyVersions,
} from '../../server/cms-taxonomy-platform-read';

/**
 * The protected reads a vocabulary page performs, behind one seam. The Astro pages build it from
 * the PLATFORM_API binding; the loader takes it as a parameter, so a loader test drives the real
 * parsing and view logic with only the proxy edge replaced.
 */
export interface TaxonomyPageReads {
  /** `cmsTaxonomyVersionsRead`: a vocabulary's versions, newest first. */
  readonly versions: (
    request: Request,
    taxonomyId: string,
  ) => Promise<Response>;
  /** `cmsTaxonomyTermsRead`: one page of terms; `search` is the validated `?lifecycle=&cursor=`. */
  readonly terms: (
    request: Request,
    taxonomyId: string,
    search: string,
  ) => Promise<Response>;
}

/** A GET with only the session headers of the page request: its URL state never leaks into a read. */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createTaxonomyPageReads = (
  binding: unknown,
): TaxonomyPageReads => ({
  versions: async (request, taxonomyId) =>
    readCmsTaxonomyVersions(
      derivedRead(request, `/api/v1/cms/taxonomies/${taxonomyId}/versions`),
      binding,
      taxonomyId,
    ),
  terms: async (request, taxonomyId, search) =>
    readCmsTaxonomyTerms(
      derivedRead(
        request,
        `/api/v1/cms/taxonomies/${taxonomyId}/terms${search}`,
      ),
      binding,
      taxonomyId,
    ),
});
