import { useCallback, useState } from 'react';

import {
  versionIdentityValid,
  isNewerThanBase,
} from './taxonomy-version-identity';
import {
  readTaxonomyVersions,
  type TaxonomyVersionFacts,
  type TaxonomyVersionsResult,
} from './taxonomy-versions-read';

export type TaxonomyConflictState =
  | { readonly kind: 'none' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'loaded'; readonly latest: TaxonomyVersionFacts }
  | { readonly kind: 'failed'; readonly message: string };

/** The version a form is based on. */
export type TaxonomyBaseIdentity = Pick<
  TaxonomyVersionFacts,
  'id' | 'version' | 'contentHash'
>;

const FAILED: Readonly<Record<number, string>> = {
  401: 'Your session expired. Sign in again.',
  403: 'Taxonomy curator access is required for this acting context.',
  404: 'This vocabulary is unavailable to the current acting context.',
  429: 'The latest version could not be read because of rate limiting. Wait and try again.',
};

export const UNVERIFIED_LATEST_MESSAGE =
  'The latest version could not be verified. Reload.';

export const conflictFailure = (result: TaxonomyVersionsResult): string =>
  result.kind === 'rejected'
    ? (FAILED[result.status] as string)
    : 'The latest version is unavailable. Wait and try again.';

/**
 * The explicit latest-version comparison after a compare-and-set conflict or an unknown
 * outcome (FE03 form contract: show the current server version beside the preserved draft;
 * never overwrite automatically). Reading the latest changes nothing; rebasing and
 * discarding are separate, explicit actions of the designer. A read that is not a
 * comparable version of this lineage (an older or foreign same-numbered one) is refused.
 */
export const useTaxonomyConflict = (
  taxonomyId: string | null,
  base: TaxonomyBaseIdentity | null,
  readVersions: typeof readTaxonomyVersions = readTaxonomyVersions,
) => {
  const [state, setState] = useState<TaxonomyConflictState>({ kind: 'none' });
  // FE03 1048: the last verified latest version is kept while a re-read runs or fails.
  const [kept, setKept] = useState<TaxonomyVersionFacts | null>(null);

  /** Resolves to what the server answered; `unavailable` when it is not comparable. */
  const check = useCallback(async (): Promise<TaxonomyVersionsResult> => {
    if (taxonomyId === null) return { kind: 'unavailable' };
    setState({ kind: 'checking' });
    const result = await readVersions(taxonomyId);
    if (result.kind === 'loaded') {
      const latest = result.page.items[0];
      if (latest === undefined) {
        setKept(null);
        setState({ kind: 'failed', message: UNVERIFIED_LATEST_MESSAGE });
        return { kind: 'unavailable' };
      }
      if (base !== null && !versionIdentityValid(base, latest)) {
        setKept(null);
        setState({ kind: 'failed', message: UNVERIFIED_LATEST_MESSAGE });
        return { kind: 'unavailable' };
      }
      setKept(latest);
      setState({ kind: 'loaded', latest });
      return result;
    }
    setState({ kind: 'failed', message: conflictFailure(result) });
    return result;
  }, [base, readVersions, taxonomyId]);

  const clear = useCallback((): void => {
    setKept(null);
    setState({ kind: 'none' });
  }, []);
  const latest = kept;
  return {
    state,
    /** The last verified latest version, kept across a re-read that is running or failed. */
    verified: kept,
    check,
    clear,
    newer: latest !== null && isNewerThanBase(latest, base),
  };
};
