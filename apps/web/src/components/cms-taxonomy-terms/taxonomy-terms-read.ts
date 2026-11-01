import { retryable } from '../../lib/retryable-import';

/**
 * The verified facts of one page of a vocabulary's terms (`cmsTaxonomyTermsRead`). The
 * same-origin proxy has already parsed the strict `TaxonomyTermListPage`; the browser
 * repeats the structure and the rules (zod-free, FE03 AC261) and keeps only the members
 * the term form uses.
 */
export type TermLifecycle = 'active' | 'deprecated' | 'merged';
export const TERM_LIFECYCLES: readonly TermLifecycle[] = [
  'active',
  'deprecated',
  'merged',
];

export interface TermLabel {
  readonly locale: string;
  readonly label: string;
}

export interface TermFacts {
  readonly termId: string;
  readonly termKey: string;
  readonly lifecycle: TermLifecycle;
  readonly version: string;
  readonly parentId: string | null;
  /** The surviving term a `merged` term resolves to permanently. */
  readonly successorId: string | null;
  readonly labels: readonly TermLabel[];
  readonly aliases: readonly string[];
}

export interface TermsPageFacts {
  readonly items: readonly TermFacts[];
  readonly nextCursor: string | null;
  readonly pageVersion: string;
}

export interface TermsQuery {
  readonly lifecycle?: TermLifecycle | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

export type TermsResult =
  | { readonly kind: 'loaded'; readonly page: TermsPageFacts }
  | { readonly kind: 'rejected'; readonly status: 401 | 403 | 404 | 409 | 429 }
  | { readonly kind: 'unavailable' };

/** The seam a test replaces: the dynamic import of the reader (`taxonomy-terms-fetch.ts`, an on-demand chunk). */
export const termsReadImporters = {
  read: retryable(() => import('./taxonomy-terms-fetch')),
};

/**
 * Read one page of the terms without carrying mutation authority. Every use is a re-read or a read the person asked for
 * (a filter, a term action, a choice list), never part of the first paint, so the reader loads when the island asks
 * (P2-S11-AC-106, the initial-route budget). A chunk that cannot be fetched is the unavailable read the island already
 * shows, with its control to repeat it.
 */
export const readTaxonomyTerms = async (
  taxonomyId: string,
  query: TermsQuery = {},
  fetcher?: typeof fetch,
): Promise<TermsResult> => {
  try {
    return await (
      await termsReadImporters.read()
    ).readTaxonomyTerms(taxonomyId, query, fetcher);
  } catch {
    return { kind: 'unavailable' };
  }
};
