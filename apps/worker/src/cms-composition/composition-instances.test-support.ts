import type {
  CompositionInstancePage,
  CompositionInstanceResource,
} from '@wejammin/contracts';

import { PU_HASH, PU_REVISION_ID, puId } from './pattern-update.test-support';

/**
 * Wire fixtures for cmsCompositionInstancesRead (DEC-206; BE03c route registry, `CompositionInstancePage`). Every value
 * is schema-valid and shaped like what `platform_api.cms_list_composition_instances` answers.
 */
export const CI_ENTRY_ID = puId(500);
export const CI_PATH = `/api/v1/cms/entries/${CI_ENTRY_ID}/compositions`;
export const ciPath = (entryId: string = CI_ENTRY_ID, search = ''): string =>
  `/api/v1/cms/entries/${entryId}/compositions${search}`;
/** The BE00 default page size (BE03c `CompositionInstancesQuery.limit`: 1-50, default 25). */
export const CI_PAGE_SIZE = 25;
/** A cursor as the database issues one: base64 text of at most 512 characters. */
export const CI_CURSOR = 'eyJoIjoiYSIsImkiOiJiIn0=';

export const ciRow = (
  index: number,
  overrides: Partial<CompositionInstanceResource> = {},
): CompositionInstanceResource => ({
  id: puId(1000 + index),
  version: '1',
  contentHash: PU_HASH,
  createdAt: '2026-10-22T12:00:00.000Z',
  updatedAt: '2026-10-22T12:00:00.000Z',
  state: 'active',
  revisionId: PU_REVISION_ID,
  path: `/main/root${index}`,
  position: index,
  blockKey: 'profile.block',
  blockVersion: 1,
  patternId: puId(2000),
  patternVersion: 1,
  blockRegistryDigest: PU_HASH,
  linkMode: 'linked',
  conflictState: 'none',
  ...overrides,
});

export const ciPage = (
  count = 2,
  overrides: Partial<CompositionInstancePage> = {},
): CompositionInstancePage => ({
  revisionId: PU_REVISION_ID,
  items: Array.from({ length: count }, (_, index) => ciRow(index)),
  nextCursor: null,
  ...overrides,
});
