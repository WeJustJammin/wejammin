import type { TaxonomyVersionFacts } from './taxonomy-versions-read';

/*
 * The two pure comparisons the conflict check renders with, apart from the unknown-outcome verdict
 * (`taxonomy-outcome-reconcile.ts`), which runs only after a write whose outcome was lost and so
 * loads then (P2-S11-AC-106).
 */
type Identity = Pick<TaxonomyVersionFacts, 'id' | 'version' | 'contentHash'>;

/** A newer version than the one the form is based on can be compared and adopted. */
export const isNewerThanBase = (
  latest: Pick<TaxonomyVersionFacts, 'version'>,
  base: Pick<TaxonomyVersionFacts, 'version'> | null,
): boolean => base === null || BigInt(latest.version) > BigInt(base.version);

/**
 * A latest version is comparable with the one the form is based on only when it is newer,
 * or is that very row (same id and content hash): an older or foreign same-numbered version
 * must never read as "still the latest".
 */
export const versionIdentityValid = (
  base: Identity,
  latest: Identity,
): boolean =>
  BigInt(latest.version) > BigInt(base.version) ||
  (latest.version === base.version &&
    latest.id === base.id &&
    latest.contentHash === base.contentHash);
