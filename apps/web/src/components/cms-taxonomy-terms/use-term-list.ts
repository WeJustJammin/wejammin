import { useCallback, useRef, useState } from 'react';

import { readTaxonomyVersionsOnDemand } from '../cms-taxonomy-designer/taxonomy-versions-on-demand';
import { TAXONOMY_VERSIONS_PAGE_MAX } from '../cms-taxonomy-designer/taxonomy-vocabulary-core';
import type {
  readTaxonomyVersions,
  TaxonomyVersionsResult,
} from '../cms-taxonomy-designer/taxonomy-versions-read';
import {
  readTaxonomyTerms,
  type TermLifecycle,
  type TermsPageFacts,
} from './taxonomy-terms-read';

/** The version term actions run under: the vocabulary's `active` one, if any. */
export interface ActiveVersion {
  readonly version: string;
}

export type TermListNotice =
  | { readonly kind: 'none' }
  /** The signed cursor no longer matched, so the list restarted from the first page (409). */
  | { readonly kind: 'restarted' }
  /** The last refresh failed: the last verified list is kept and actions stay off. */
  | { readonly kind: 'failed' };

export interface TermListOptions {
  readonly taxonomyId: string;
  readonly initialPage: TermsPageFacts;
  readonly initialActive: ActiveVersion | null;
  /** True when no active version was found in a full (newest 50) versions read. */
  readonly initialBounded?: boolean | undefined;
  /** The URL state the page was served for. */
  readonly lifecycle: TermLifecycle | null;
  readonly cursor: string | null;
  /** Where the URL goes after a restart; a test replaces it. */
  readonly replaceUrl?: ((lifecycle: TermLifecycle | null) => void) | undefined;
  readonly readTerms?: typeof readTaxonomyTerms | undefined;
  readonly readVersions?: typeof readTaxonomyVersions | undefined;
}

interface ActiveSearch {
  readonly active: ActiveVersion | null;
  /** No active version, but the read was full: an older one may exist (BE03c 406). */
  readonly bounded: boolean;
}

const activeOf = (result: TaxonomyVersionsResult): ActiveSearch | undefined => {
  if (result.kind !== 'loaded') return undefined;
  const active = result.page.items.find((item) => item.state === 'active');
  return active === undefined
    ? {
        active: null,
        bounded: result.page.items.length >= TAXONOMY_VERSIONS_PAGE_MAX,
      }
    : { active: { version: active.version }, bounded: false };
};

/**
 * The verified term list and the active version, refetched after every term action (FE03
 * :1038, :2668). A 409 cursor conflict restarts from the first page; a refresh that fails
 * keeps the last verified list and turns the actions off until a later refresh succeeds.
 */
export const useTermList = ({
  taxonomyId,
  initialPage,
  initialActive,
  initialBounded = false,
  lifecycle,
  cursor: initialCursor,
  replaceUrl = () => undefined,
  readTerms = readTaxonomyTerms,
  readVersions = readTaxonomyVersionsOnDemand,
}: TermListOptions) => {
  const [page, setPage] = useState(initialPage);
  const [active, setActive] = useState(initialActive);
  const [bounded, setBounded] = useState(initialBounded);
  const [notice, setNotice] = useState<TermListNotice>({ kind: 'none' });
  const [refreshing, setRefreshing] = useState(false);
  const cursorRef = useRef<string | null>(initialCursor);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  const refresh = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    const query = (cursor: string | null) => ({
      ...(lifecycle === null ? {} : { lifecycle }),
      ...(cursor === null ? {} : { cursor }),
    });
    const [terms, versions] = await Promise.all([
      readTerms(taxonomyId, query(cursorRef.current)),
      readVersions(taxonomyId),
    ]);
    let ok = true;
    const nextActive = activeOf(versions);
    if (nextActive === undefined) ok = false;
    else {
      setActive(nextActive.active);
      setBounded(nextActive.bounded);
    }
    if (terms.kind === 'loaded') {
      setPage(terms.page);
      if (ok) setNotice({ kind: 'none' });
    } else if (terms.kind === 'rejected' && terms.status === 409) {
      const first = await readTerms(taxonomyId, query(null));
      if (first.kind === 'loaded') {
        cursorRef.current = null;
        setCursor(null);
        setPage(first.page);
        replaceUrl(lifecycle);
        if (ok) setNotice({ kind: 'restarted' });
      } else ok = false;
    } else ok = false;
    if (!ok) setNotice({ kind: 'failed' });
    setRefreshing(false);
    return ok;
  }, [lifecycle, readTerms, readVersions, replaceUrl, taxonomyId]);

  return { page, active, bounded, notice, refreshing, refresh, cursor };
};
