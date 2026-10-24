import {
  TaxonomySelectorPageSchema,
  TaxonomyTermListPageSchema,
  type TaxonomySelectorPage,
  type TaxonomySelectorQuery,
  type TaxonomyTermListPage,
  type TaxonomyTermListQuery,
} from '@wejammin/contracts';

/**
 * A read page is accepted only when it honours the request that asked for it: the strict contract (which also bounds
 * the 256 KiB response of the terms list), at most `limit` rows, no row twice, the filter the request named and the
 * keyset order the page is signed over. An answer that breaks any of them is an invalid dependency answer (502), never
 * a page shown to the caller. Keys compare bytewise (the SQL `collate "C"`); every key here is ASCII.
 */
const bytewise = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

export const validTermsPage = (
  value: unknown,
  query: TaxonomyTermListQuery,
): value is TaxonomyTermListPage => {
  const parsed = TaxonomyTermListPageSchema.safeParse(value);
  if (!parsed.success) return false;
  const { items } = parsed.data;
  return (
    items.length <= query.limit &&
    unique(items.map((item) => item.termId)) &&
    items.every(
      (item, index) =>
        (query.lifecycle === undefined || item.lifecycle === query.lifecycle) &&
        (index === 0 ||
          bytewise(items[index - 1]!.termKey, item.termKey) < 0 ||
          (items[index - 1]!.termKey === item.termKey &&
            bytewise(items[index - 1]!.termId, item.termId) < 0)),
    )
  );
};

export const validSelectorPage = (
  value: unknown,
  query: TaxonomySelectorQuery,
): value is TaxonomySelectorPage => {
  const parsed = TaxonomySelectorPageSchema.safeParse(value);
  if (!parsed.success) return false;
  const { items } = parsed.data;
  return (
    items.length <= query.limit &&
    unique(items.map((item) => item.termId)) &&
    items.every(
      (item, index) =>
        index === 0 ||
        bytewise(items[index - 1]!.taxonomyKey, item.taxonomyKey) < 0 ||
        (items[index - 1]!.taxonomyKey === item.taxonomyKey &&
          bytewise(items[index - 1]!.termKey, item.termKey) <= 0),
    )
  );
};
