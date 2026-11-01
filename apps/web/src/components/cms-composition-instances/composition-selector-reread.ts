import { readSelectorPage } from './composition-reads';
import type {
  ReadState,
  SelectorItem,
  SelectorPage,
} from './composition-types';

/**
 * What the pattern selector answers when it is read again after the block registry changed (review V20 m9, DEC-246
 * ruling 5). The first page replaces the list, as after a cursor conflict (BE03c 1414); the pattern the author chose is
 * replaced by its fresh listing (the digest the next placement carries), or cleared when the page no longer lists it.
 */
export type SelectorReread =
  | {
      readonly kind: 'read';
      readonly page: SelectorPage;
      /** The chosen pattern as the first page lists it now, or null when it is no longer listed. */
      readonly chosen: SelectorItem | null;
    }
  | {
      readonly kind: 'unread';
      readonly cause: Extract<
        ReadState<never>,
        { kind: 'failed' | 'rate_limited' }
      >;
    };

export const rereadSelector = async (
  contentTypeId: string,
  chosen: SelectorItem | null,
  options: { readonly fetcher?: typeof fetch },
): Promise<SelectorReread> => {
  const answer = await readSelectorPage(contentTypeId, null, options);
  if (answer.kind !== 'page') return { kind: 'unread', cause: answer };
  return {
    kind: 'read',
    page: answer.page,
    chosen:
      chosen === null
        ? null
        : (answer.page.items.find(
            (item) => item.patternVersionId === chosen.patternVersionId,
          ) ?? null),
  };
};
