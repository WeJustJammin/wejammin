import type { ChoiceMap, UpdateDiff } from './composition-types';

/** What the update panel shows: nothing, a read in flight, a read that failed, one diff, or a selection's diffs. */
export type Panel =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | {
      readonly kind: 'diff';
      readonly diff: UpdateDiff;
      readonly choices: ChoiceMap;
    }
  | { readonly kind: 'bulk'; readonly diffs: readonly UpdateDiff[] };

export const NO_PANEL: Panel = { kind: 'none' };
