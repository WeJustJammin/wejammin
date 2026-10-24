import type { TaxonomyVersionRequest } from '@wejammin/contracts';

import type { TaxonomyCreatedFacts } from './taxonomy-designer-submit';
import type {
  TaxonomyVersionFacts,
  TaxonomyVersionsResult,
} from './taxonomy-versions-read';

/**
 * What the server's latest version says about a write whose outcome was unknown (FE03 :1050,
 * :1173: reconcile with the server before any retry). Versions of one vocabulary rise by
 * exactly one per commit, so the newest version decides:
 * - `created`: it is the next version and holds exactly the attempted rules, so the write
 *   committed; offering it as "newer" would let a rebase save a duplicate.
 * - `not-saved`: it is still the version the attempt was based on, so nothing committed. A
 *   delayed commit is still safe: a retry of the unchanged body replays the same
 *   `Idempotency-Key`.
 * - `undetermined`: anything else is for the person to compare.
 */
export type OutcomeVerdict =
  | { readonly kind: 'created'; readonly resource: TaxonomyCreatedFacts }
  | { readonly kind: 'not-saved' }
  | { readonly kind: 'undetermined' };

const same = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const isOwnCommit = (
  attempt: TaxonomyVersionRequest,
  latest: TaxonomyVersionFacts,
): boolean =>
  latest.taxonomyKey === attempt.taxonomyKey &&
  latest.version ===
    (attempt.expectedVersion === null
      ? '1'
      : (BigInt(attempt.expectedVersion) + 1n).toString()) &&
  latest.shape === attempt.shape &&
  same(latest.allowedTypeKeys, attempt.allowedTypeKeys) &&
  same(latest.allowedFieldKeys, attempt.allowedFieldKeys) &&
  same(latest.canonicalOverlapDomains, attempt.canonicalOverlapDomains);

export const reconcileUnknownVersionOutcome = (
  attempt: TaxonomyVersionRequest,
  read: TaxonomyVersionsResult,
): OutcomeVerdict => {
  if (read.kind !== 'loaded') return { kind: 'undetermined' };
  const latest = read.page.items[0];
  if (latest === undefined) return { kind: 'undetermined' };
  if (isOwnCommit(attempt, latest))
    return {
      kind: 'created',
      resource: {
        id: latest.id,
        taxonomyId: latest.taxonomyId,
        taxonomyKey: latest.taxonomyKey,
        taxonomyVersion: latest.taxonomyVersion,
        version: latest.version,
      },
    };
  return attempt.expectedVersion !== null &&
    latest.version === attempt.expectedVersion
    ? { kind: 'not-saved' }
    : { kind: 'undetermined' };
};

export {
  isNewerThanBase,
  versionIdentityValid,
} from './taxonomy-version-identity';
