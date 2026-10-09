import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';

/*
 * BE03b "Frozen dependency manifest build and version set (E1, E7)": every list
 * of a `DependencyManifest` and a `VersionSet` is sorted ascending by its
 * canonical identity (the lowercase UUID string, bytewise) and names each
 * identity once. A frozen set is compared and hashed as canonical JSON text, so
 * one dependency set has exactly one serialization.
 */

/**
 * Bytewise comparison. Canonical identities and keys are ASCII, so UTF-16 code
 * unit order is the bytewise order of their UTF-8 form (and of PostgreSQL
 * `collate "C"`): digits precede upper case precede lower case, and `"10"`
 * precedes `"2"`.
 */
export const compareBytewise = (left: string, right: string): number => {
  if (left < right) return -1;
  return left > right ? 1 : 0;
};

/** Validator references order by key and then by version, both bytewise. */
export const compareValidatorRefs = (
  left: { readonly key: string; readonly version: string },
  right: { readonly key: string; readonly version: string },
): number =>
  compareBytewise(left.key, right.key) ||
  compareBytewise(left.version, right.version);

/** True when no item sorts after the item that follows it (a repeat is ordered). */
export const isAscendingBy = <T>(
  items: readonly T[],
  compare: (left: T, right: T) => number,
): boolean =>
  items.every(
    (item, index) => index === 0 || compare(items[index - 1] as T, item) <= 0,
  );

/** True when every key the selector derives from `items` is distinct. */
export const allDistinctBy = <T>(
  items: readonly T[],
  select: (item: T) => string,
): boolean => new Set(items.map(select)).size === items.length;

/**
 * A UUID that is also the canonical lowercase text. `z.uuid()` accepts upper
 * case, which would let one identity appear twice and would sort differently
 * from the database's lowercase `uuid::text`.
 */
export const CmsCanonicalUuidSchema = CmsUuidSchema.refine(
  (value) => value === value.toLowerCase(),
  'uuid_must_be_lowercase',
);

/** Sorts a copy of `ids` bytewise (the canonical order of an id list). */
export const sortedBytewise = (ids: readonly string[]): string[] =>
  [...ids].sort(compareBytewise);
