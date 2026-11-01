import { CmsLineageIdSchema } from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialSignInRedirect,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import { GOVERNED_QUEUE_PATH } from '../cms-governed-review/CmsGovernedReviewDetail';
import type { GovernedTaxonomyFacts } from '../cms-governed-review/CmsGovernedTaxonomyPanel';
import type { GovernedPanelReview } from '../cms-governed-review/load-governed-subject-review';
import {
  summaryOf,
  type TaxonomyVersionSummary,
} from '../cms-taxonomy-designer/CmsTaxonomyVersionList';
import {
  TAXONOMY_VERSIONS_PAGE_MAX,
  verifiedVersionsPage,
  type TaxonomyVersionFacts,
} from '../cms-taxonomy-designer/taxonomy-versions-read';
import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import { verifiedTermsPage } from '../cms-taxonomy-terms/taxonomy-terms-fetch';
import {
  TERM_LIFECYCLES,
  type TermLifecycle,
  type TermsPageFacts,
} from '../cms-taxonomy-terms/taxonomy-terms-read';
import type { ActiveVersion } from '../cms-taxonomy-terms/use-term-list';
import type { TaxonomyPageReads } from './taxonomy-page-reads';
import { cmsEditorialCsrfCookie } from '../../server/cms-editorial-platform-shared';

export const TAXONOMY_NEW_PATH = '/app/cms-content-modeling/taxonomies/new';
export const taxonomyPagePath = (taxonomyId: string): string =>
  `/app/cms-content-modeling/taxonomies/${taxonomyId}`;

/**
 * The reserved lineage the new-vocabulary page reads once. FE03 :1068 gates `/taxonomies/new` on
 * `cms.taxonomy_curator`, but BE03c names no curator read without a vocabulary id, and BE00
 * checks the session and the capability before any lookup. So the page reads
 * `cmsTaxonomyVersionsRead` for an id no vocabulary carries: a missing session is 401, a missing
 * capability 403 and a verified curator 404 (absent lineage). The id must pass the producer's
 * `cms_valid_uuid` grammar (version nibble 1-8, variant 8/9/a/b); an id the producer rejects as
 * INVALID_REQUEST would hide the curator behind a 400. `load-taxonomy-page.new.test.ts` reads the
 * grammar from the migration and fails if either side drifts. A dedicated curator context read
 * (BE03c) would replace the probe.
 */
export const TAXONOMY_PROBE_ID = '00000000-0000-4000-8000-000000000000';

export interface TaxonomyPageView {
  readonly mode: 'create' | 'edit';
  readonly csrfToken: string;
  /** The newest version: the preimage of the next draft. Null for a new vocabulary. */
  readonly latest: TaxonomyVersionFacts | null;
  readonly versions: readonly TaxonomyVersionSummary[];
  readonly vocabulary: {
    readonly taxonomyId: string;
    readonly taxonomyKey: string;
    readonly shape: TaxonomyShape;
    /** The `active` version term actions run under, else null. */
    readonly active: ActiveVersion | null;
    /**
     * True when no `active` version was found AND the read returned a full page: the read holds
     * at most the newest 50 versions (BE03c 406), so an older active one may exist unseen.
     */
    readonly versionsBounded: boolean;
  } | null;
  readonly terms: TermsPageFacts | null;
  readonly query: {
    readonly lifecycle: TermLifecycle | null;
    readonly cursor: string | null;
  };
  /** The page path term filters and pager links stay on. */
  readonly basePath: string;
  /** The few members the governed review panel needs, for a saved vocabulary. */
  readonly panel: GovernedTaxonomyFacts | null;
}

/** The governed review the page links to: the vocabulary's own when known, else the queue. */
export const taxonomyReviewHref = (
  review: GovernedPanelReview | null,
): string =>
  review === null
    ? GOVERNED_QUEUE_PATH
    : `${GOVERNED_QUEUE_PATH}/${encodeURIComponent(review.reviewId)}`;

const notice = (
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

const failureOutcome = async (
  response: Response,
  returnTo: string,
): Promise<CmsEditorialPageOutcome<never>> => {
  if (response.status === 403)
    return notice(
      403,
      'Access denied',
      'Vocabulary curator access is required for the current acting context.',
    );
  if (response.status === 404)
    return notice(
      404,
      'Not found',
      'This vocabulary is unavailable to the current acting context.',
    );
  return cmsEditorialNoticeFor(response, {
    subject: 'entry',
    returnTo,
    retryHref: returnTo,
  }) as Promise<CmsEditorialPageOutcome<never>>;
};

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

interface TermListQuery {
  readonly lifecycle: TermLifecycle | null;
  readonly cursor: string | null;
}

/** The term list URL state (FE03 :1068): at most one `lifecycle` and one `cursor`; nothing else. */
const termListQuery = (url: URL): TermListQuery | null => {
  const allowed = new Set(['lifecycle', 'cursor']);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) return null;
    seen.add(key);
  }
  // The filter form's "All terms" option submits `lifecycle=`: an empty filter is no filter.
  const rawLifecycle = url.searchParams.get('lifecycle');
  const lifecycle = rawLifecycle === '' ? null : rawLifecycle;
  const cursor = url.searchParams.get('cursor');
  if (
    (lifecycle !== null &&
      !(TERM_LIFECYCLES as readonly string[]).includes(lifecycle)) ||
    (cursor !== null && (cursor.length === 0 || cursor.length > 512))
  )
    return null;
  return { lifecycle: lifecycle as TermLifecycle | null, cursor };
};

const searchOf = (query: TermListQuery): string => {
  const parameters = new URLSearchParams();
  if (query.lifecycle !== null) parameters.set('lifecycle', query.lifecycle);
  if (query.cursor !== null) parameters.set('cursor', query.cursor);
  return parameters.size === 0 ? '' : `?${parameters}`;
};

const loadNew = async (
  request: Request,
  reads: TaxonomyPageReads,
): Promise<CmsEditorialPageOutcome<TaxonomyPageView>> => {
  const probe = await reads.versions(request, TAXONOMY_PROBE_ID);
  if (probe.status === 401)
    return cmsEditorialSignInRedirect(TAXONOMY_NEW_PATH);
  // 404 is the verified curator's answer for the reserved lineage; anything else explains itself.
  if (probe.status === 200) return cmsEditorialUnverifiedNotice('Vocabulary');
  if (probe.status !== 404) return failureOutcome(probe, TAXONOMY_NEW_PATH);
  return {
    kind: 'view',
    status: 200,
    title: 'Vocabulary',
    heading: 'Vocabulary designer',
    description: 'Govern a vocabulary and its terms.',
    view: {
      mode: 'create',
      csrfToken: cmsEditorialCsrfCookie(request) ?? '',
      latest: null,
      versions: [],
      vocabulary: null,
      terms: null,
      query: { lifecycle: null, cursor: null },
      basePath: TAXONOMY_NEW_PATH,
      panel: null,
    },
  };
};

/**
 * The protected vocabulary pages (FE03 :1068). `taxonomyId` is null on `/taxonomies/new` and the
 * path lineage id on `/taxonomies/:taxonomyId`. A malformed id (which includes the reserved words
 * `selector` and `versions`) and a malformed term list query are a 400 before any protected
 * read; a concealed or absent vocabulary is the disclosure-safe 404; a missing capability is a
 * 403; an expired session is a sign-in redirect; a stale term cursor restarts from the first page.
 * No form is ever built from a projection the strict reads did not verify.
 */
export const loadTaxonomyPage = async (input: {
  readonly request: Request;
  readonly taxonomyId: string | null;
  readonly reads: TaxonomyPageReads;
}): Promise<CmsEditorialPageOutcome<TaxonomyPageView>> => {
  const { request, reads } = input;
  if (input.taxonomyId === null) return loadNew(request, reads);
  const id = CmsLineageIdSchema.safeParse(input.taxonomyId);
  const query = termListQuery(new URL(request.url));
  if (!id.success || query === null)
    return notice(
      400,
      'Invalid request',
      'This vocabulary address could not be read. Check it and try again.',
      '/app/cms-content-modeling',
    );
  const taxonomyId = id.data;
  const basePath = taxonomyPagePath(taxonomyId);
  const [versionsResponse, termsResponse] = await Promise.all([
    reads.versions(request, taxonomyId),
    reads.terms(request, taxonomyId, searchOf(query)),
  ]);
  if (versionsResponse.status === 401 || termsResponse.status === 401)
    return cmsEditorialSignInRedirect(basePath);
  if (versionsResponse.status !== 200)
    return failureOutcome(versionsResponse, basePath);
  // A stale signed cursor restarts from the first page. With no cursor there is nothing to
  // restart from, and a redirect would be to this very address, so the failure is shown.
  if (termsResponse.status === 409 && query.cursor !== null)
    return {
      kind: 'redirect',
      location:
        query.lifecycle === null
          ? basePath
          : `${basePath}?lifecycle=${query.lifecycle}`,
    };
  if (termsResponse.status !== 200)
    return failureOutcome(termsResponse, basePath);

  const versions = verifiedVersionsPage(
    await jsonOf(versionsResponse),
    taxonomyId,
    versionsResponse.headers.get('etag'),
  );
  const terms = verifiedTermsPage(
    await jsonOf(termsResponse),
    termsResponse.headers.get('etag'),
  );
  if (versions === null || terms === null)
    return cmsEditorialUnverifiedNotice('Vocabulary');
  const latest = versions.items[0];
  if (latest === undefined)
    return notice(
      404,
      'Not found',
      'This vocabulary is unavailable to the current acting context.',
    );
  const active = versions.items.find((row) => row.state === 'active');
  return {
    kind: 'view',
    status: 200,
    title: 'Vocabulary',
    heading: 'Govern a vocabulary',
    description: 'Govern a vocabulary and its terms.',
    view: {
      mode: 'edit',
      csrfToken: cmsEditorialCsrfCookie(request) ?? '',
      latest,
      versions: versions.items.map(summaryOf),
      vocabulary: {
        taxonomyId,
        taxonomyKey: latest.taxonomyKey,
        shape: latest.shape,
        active: active === undefined ? null : { version: active.version },
        versionsBounded:
          active === undefined &&
          versions.items.length >= TAXONOMY_VERSIONS_PAGE_MAX,
      },
      terms,
      query,
      basePath,
      panel: {
        id: latest.id,
        contentHash: latest.contentHash,
        taxonomyId,
        taxonomyKey: latest.taxonomyKey,
        taxonomyVersion: latest.taxonomyVersion,
        state: latest.state,
      },
    },
  };
};
