import { expect } from 'vitest';

import { json, type Call } from './composition-page.test-support';
import { ENTRY_ID, REVISION_ID } from './composition.test-support';
import type { InstanceRow } from './composition-types';

/** The browser proxy of `cmsCompositionInstancesRead` (DEC-206), as the scripted wire keys it. */
export const LIST = `GET /api/v1/cms/entries/${ENTRY_ID}/compositions`;

/** One answer page of that read. */
export const listPage = (
  rows: readonly InstanceRow[],
  nextCursor: string | null = null,
  revisionId: string | null = REVISION_ID,
): Response =>
  json({ revisionId, items: [...rows], nextCursor }, 200, undefined);

/** The paths of the rows the list shows, in order. */
export const listedPaths = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('.cms-instance-row code')].map(
    (node) => node.textContent ?? '',
  );

/**
 * The page refetched the instance list `count` times, each a first-page read of the entry's compositions (FE03 1047,
 * 1049): the assertion of a command test whose list read the server model answered (review V20 n4).
 */
export const expectListRefetches = (
  page: { readonly lists: readonly Call[] },
  count: number,
): void => {
  expect(
    page.lists.map((call) => `${call.method} ${call.path}${call.search}`),
  ).toEqual(
    Array.from(
      { length: count },
      () => `${LIST.slice(0, 4)}${LIST.slice(4)}?limit=50`,
    ),
  );
};
