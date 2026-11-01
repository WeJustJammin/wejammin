import type {
  EntryDraftDetailResource,
  RelatedContentRuleRead,
} from '@wejammin/contracts';

import type { RelatedLists } from './related-content-lists';

/** The entry the page edits related content for (verified by the page loader, FE03 :1072). */
export interface RelatedEntryFacts {
  readonly entryId: string;
  /** The entry aggregate `version`: the strong `If-Match` (BE03c 215). */
  readonly version: string;
  readonly locale: string;
  readonly lifecycle: string;
}

/**
 * The saved rule a form starts from: the loader's reading of `cmsRelatedContentRead` (DEC-195), or an empty
 * rule when none is active. Pins keep their stored order; ids are exactly as stored, including targets the
 * viewer can no longer open. The read's resource names the derived rule by `key` and `version` only
 * (BE03c `RelatedContentResource`), so the saved `maxCandidates` is not known: it is `null`, and the form
 * asks for it again before it saves a derived rule.
 */
export interface RelatedRuleSnapshot extends RelatedLists {
  readonly derivedRule: {
    readonly key: string;
    readonly version: string;
    readonly maxCandidates: number | null;
  } | null;
}

/** Two verified protected reads; neither replaces the person's local choices. */
export interface RelatedConflictSnapshot {
  readonly draft: EntryDraftDetailResource;
  readonly rule: RelatedContentRuleRead['rule'];
  /** The rule's entry token, or the EARLIER draft token when no rule exists. */
  readonly expectedVersion: string;
}

export type RelatedConflictReadResult =
  | { readonly kind: 'reviewed'; readonly snapshot: RelatedConflictSnapshot }
  | { readonly kind: 'failed'; readonly status: number | null }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number | null;
    };

export type RelatedConflictReviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading' }
  | RelatedConflictReadResult;
