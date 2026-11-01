import type { InstanceRow } from './composition-types';

/*
 * The instance list's pure rules (FE03 887). A placement writes one row per block root; an update appends a newer row
 * of the same path. The list shows the newest row of every path in the render order the instance list read answers
 * (DEC-206: template slot, then the stored `position` of DEC-185, then the path bytewise). The slot ordinal is not a
 * member of a row, so the page never re-sorts rows it was given: they keep the server's order, an updated path keeps
 * its place, and a path first seen in this session follows the listed rows by position then path (which is its place
 * in an entry without a template, where one slot holds every row). A reload lists the exact render order again.
 */
const versionOf = (row: InstanceRow): bigint => BigInt(row.version);

export const orderRows = (rows: readonly InstanceRow[]): InstanceRow[] =>
  [...rows].sort((left, right) =>
    left.position !== right.position
      ? left.position - right.position
      : left.path < right.path
        ? -1
        : left.path > right.path
          ? 1
          : 0,
  );

/**
 * Newest row per path wins; an older answer never replaces a newer row. The rows already listed keep their order, an
 * updated path is replaced where it stands, and the paths not yet listed are appended in `orderRows` order.
 */
export const mergeRows = (
  current: readonly InstanceRow[],
  incoming: readonly InstanceRow[],
): InstanceRow[] => {
  const merged = [...current];
  const placeOf = new Map(merged.map((row, index) => [row.path, index]));
  const fresh = new Map<string, InstanceRow>();
  for (const row of incoming) {
    const place = placeOf.get(row.path);
    if (place !== undefined) {
      if (versionOf(row) >= versionOf(merged[place]!)) merged[place] = row;
      continue;
    }
    const known = fresh.get(row.path);
    if (known === undefined || versionOf(row) >= versionOf(known))
      fresh.set(row.path, row);
  }
  return [...merged, ...orderRows([...fresh.values()])];
};

/** A `pending_diff` linked row is the only row an update can be accepted on (FE03 2708). */
export const canReviewUpdate = (row: InstanceRow): boolean =>
  row.linkMode === 'linked' && row.state === 'pending_diff';

/** A detached row offers neither accept nor detach; the newest retired row of a path may still be detached. */
export const canDetach = (row: InstanceRow): boolean =>
  row.linkMode === 'linked' &&
  (row.state === 'draft' ||
    row.state === 'active' ||
    row.state === 'pending_diff' ||
    row.state === 'retired');

/** The row's state in the words the list shows (`pending_diff` is "Update available", DEC-193). */
export const stateLabel = (row: InstanceRow): string => {
  if (row.state === 'retired') return 'Removed from the entry';
  if (row.linkMode === 'detached') return 'Local copy';
  if (row.state === 'pending_diff') return 'Update available';
  return 'Up to date';
};

/** The pinned version in words; a row placed from no pattern states none. */
export const pinLabel = (row: InstanceRow): string =>
  row.patternVersion === null
    ? 'No pattern version'
    : `Pinned to pattern version ${row.patternVersion}`;

/** The most rows one request carries (CompositionUpdateRequest `instances`, DEC-181). */
export const MAX_INSTANCES_PER_REQUEST = 32;

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    chunks.push(items.slice(start, start + size));
  return chunks;
};

/**
 * The rows of a refetched list with the `retired` rows the island still holds. `cmsCompositionInstancesRead` lists only
 * the newest `draft`, `active` or `pending_diff` row of each path (DEC-206), so a block an accept removed ("Removed from
 * the entry") is absent from it, yet DEC-193 lets the author still detach it. Such a row keeps the place after the row
 * that preceded it, unless the read now lists that path. Only a row of the draft revision the read answered
 * (`revisionId`) is kept: a retired row of an earlier revision is not part of this draft, and its id would send a
 * detach of the wrong revision (review V20 m3, DEC-246 ruling 2).
 */
export const keepRetired = (
  listed: readonly InstanceRow[],
  held: readonly InstanceRow[],
  revisionId: string,
): InstanceRow[] => {
  const paths = new Set(listed.map((row) => row.path));
  const result = [...listed];
  held.forEach((row, index) => {
    if (
      row.state !== 'retired' ||
      row.revisionId !== revisionId ||
      paths.has(row.path)
    )
      return;
    const before = held
      .slice(0, index)
      .reverse()
      .map((previous) =>
        result.findIndex((entry) => entry.path === previous.path),
      )
      .find((place) => place >= 0);
    result.splice(before === undefined ? 0 : before + 1, 0, row);
  });
  return result;
};
