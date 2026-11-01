import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import { readRelatedConflict } from './related-conflict-read';
import type { SavedRelatedContent } from './related-content-submit';
import type { RelatedConflictSnapshot } from './related-content-types';

/*
 * FE03 1050 (DEC-242): an unknown outcome is reconciled by refetching the entry's saved rule BEFORE any retry is offered,
 * and a verified success refetches it too (1047). Both use the protected draft-then-rule read of a 409 review
 * (`readRelatedConflict`, DEC-195). The read decides only what the person is told; the identical request stays what
 * the retry sends, under its own `Idempotency-Key`.
 */
export type ReconcileOutcome =
  /** The saved rule is the answer to the request: the save was recorded. */
  | {
      readonly kind: 'recorded';
      readonly saved: SavedRelatedContent;
      readonly snapshot: RelatedConflictSnapshot;
    }
  /** The read verified and shows no such save. */
  | { readonly kind: 'not_recorded' }
  /** The read did not verify (or was limited): nothing is known. */
  | { readonly kind: 'unverified'; readonly retryAfterSeconds: number | null };

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The saved rule when it is the answer to `request` (the entry advanced by exactly one version), else null. */
export const recordedSave = (
  snapshot: RelatedConflictSnapshot,
  request: RelatedContentRuleRequest,
): SavedRelatedContent | null => {
  const rule = snapshot.rule;
  if (
    rule === null ||
    !isCmsVersion(request.expectedVersion) ||
    rule.version !== String(BigInt(request.expectedVersion) + 1n) ||
    !sameIds(rule.pins, request.pins) ||
    !sameIds(rule.exclusions, request.exclusions)
  )
    return null;
  const asked = request.derivedRule;
  const stored = rule.derivedRule;
  if (
    asked === null
      ? stored !== null
      : stored === null ||
        stored.key !== asked.key ||
        stored.version !== asked.version
  )
    return null;
  return {
    version: rule.version,
    eligibleCount: rule.eligibleCount,
    pins: [...rule.pins],
    exclusions: [...rule.exclusions],
    derivedRule:
      stored === null ? null : { key: stored.key, version: stored.version },
  };
};

export const reconcileSave = async (
  request: RelatedContentRuleRequest,
  input: {
    readonly signal: AbortSignal;
    readonly isCurrent: () => boolean;
    readonly fetcher?: typeof fetch;
  },
): Promise<ReconcileOutcome> => {
  const read = await readRelatedConflict({
    entryId: request.entryId,
    ...input,
  });
  if (read.kind === 'rate_limited')
    return { kind: 'unverified', retryAfterSeconds: read.retryAfterSeconds };
  if (read.kind !== 'reviewed')
    return { kind: 'unverified', retryAfterSeconds: null };
  const saved = recordedSave(read.snapshot, request);
  return saved === null
    ? { kind: 'not_recorded' }
    : { kind: 'recorded', saved, snapshot: read.snapshot };
};
