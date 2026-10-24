import type { PatternVersionRequest } from '@wejammin/contracts';
import { cmsJsonEqual } from '@wejammin/contracts/client';

import type { PatternCreatedFacts } from './pattern-designer-submit';
import type {
  PatternLatestDetail,
  PatternLatestResult,
} from './pattern-latest-read';

/**
 * What the server's latest version says about a write whose outcome was unknown
 * (FE03 :1050, :1173: reconcile with the server before any retry). Versions of one
 * key rise by exactly one per commit, so the latest version decides:
 * - `created`: it is the next version and holds exactly the attempted content, so the
 *   write committed; offering it as "newer" would let a rebase save a duplicate.
 * - `not-saved`: it is still the version the attempt was based on (or, for a first
 *   version, the key does not exist), so nothing committed. A delayed commit is still
 *   safe: a retry of the unchanged body replays the same `Idempotency-Key`.
 * - `undetermined`: anything else is for the person to compare.
 */
export type OutcomeVerdict =
  | { readonly kind: 'created'; readonly resource: PatternCreatedFacts }
  | { readonly kind: 'not-saved' }
  | { readonly kind: 'undetermined' };

const sameTypes = (
  left: readonly string[],
  right: readonly string[],
): boolean => left.join('\u0000') === right.join('\u0000');

const isOwnCommit = (
  attempt: PatternVersionRequest,
  detail: PatternLatestDetail,
): boolean =>
  detail.patternKey === attempt.patternKey &&
  detail.version ===
    (attempt.expectedVersion === null
      ? '1'
      : (BigInt(attempt.expectedVersion) + 1n).toString()) &&
  sameTypes(detail.compatibleTypeIds, attempt.compatibleTypeIds) &&
  cmsJsonEqual(detail.blockTree, attempt.blockTree);

export const reconcileUnknownOutcome = (
  attempt: PatternVersionRequest,
  read: PatternLatestResult,
): OutcomeVerdict => {
  if (read.kind === 'loaded') {
    const { detail } = read;
    if (isOwnCommit(attempt, detail))
      return {
        kind: 'created',
        resource: {
          id: detail.id,
          patternKey: detail.patternKey,
          patternVersion: detail.patternVersion,
          version: detail.version,
          nodeCount: detail.nodeCount,
          blockRegistryDigest: detail.blockRegistryDigest,
        },
      };
    return attempt.expectedVersion !== null &&
      detail.version === attempt.expectedVersion
      ? { kind: 'not-saved' }
      : { kind: 'undetermined' };
  }
  return read.kind === 'rejected' &&
    read.status === 404 &&
    attempt.expectedVersion === null
    ? { kind: 'not-saved' }
    : { kind: 'undetermined' };
};

/**
 * A latest version is comparable with the one the form is based on only when it is
 * newer, or is that very row (same id and content hash): an older or foreign
 * same-numbered version must never read as "still the latest".
 */
export const patternLatestIdentityValid = (
  base: Pick<PatternLatestDetail, 'id' | 'version' | 'contentHash'>,
  latest: Pick<PatternLatestDetail, 'id' | 'version' | 'contentHash'>,
): boolean =>
  BigInt(latest.version) > BigInt(base.version) ||
  (latest.version === base.version &&
    latest.id === base.id &&
    latest.contentHash === base.contentHash);
