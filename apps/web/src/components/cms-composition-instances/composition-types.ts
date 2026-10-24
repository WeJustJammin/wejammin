import type {
  CompositionInstanceResource,
  CompositionUpdateDiffPath,
  CompositionUpdateDiffResource,
  PatternSelectorItem,
  PatternSelectorPage,
} from '@wejammin/contracts';

/*
 * The shapes the composition island shares. They are types only: the island never imports the zod contracts at run
 * time (FE03 AC261), because the first-party proxies have already verified every answer against the strict schemas.
 */
export type InstanceRow = CompositionInstanceResource;
export type UpdateDiff = CompositionUpdateDiffResource;
export type DiffPath = CompositionUpdateDiffPath;
export type SelectorItem = PatternSelectorItem;
export type SelectorPage = PatternSelectorPage;

/** `yours` keeps the local value; `theirs` takes the target version's (CompositionUpdateRequest `choices`). */
export type Choice = 'yours' | 'theirs';
export type ChoiceMap = Readonly<Record<string, Choice>>;

/** The entry facts the page commands are built on (FE03 :1072, :1114). */
export interface CompositionEntryFacts {
  readonly entryId: string;
  /** The entry aggregate `version`: the strong `If-Match` of CMS-03C-02 and -15. */
  readonly version: string;
  /** The entry's current draft revision: the only revision a command targets. */
  readonly revisionId: string;
  readonly contentTypeId: string;
  /** False when the revision is not the editable draft; the commands are then unavailable. */
  readonly editable: boolean;
}

/** An asynchronous read as the island shows it (FE03 `AsyncState`). */
export type ReadState<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'failed';
      readonly status: number | null;
      readonly reason: string | null;
    }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number | null;
    };
