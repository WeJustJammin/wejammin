import { vi } from 'vitest';

import {
  ROW_ID,
  TAXONOMY_ID,
  HASH,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import type {
  TaxonomyCreatedFacts,
  TaxonomySubmitResult,
} from './taxonomy-designer-submit';
import type {
  TaxonomyVersionFacts,
  TaxonomyVersionsResult,
} from './taxonomy-versions-read';

export const CSRF_TOKEN = 'csrf-token-000000000001';

/** The plain facts of the fixture versions, newest first: 3 draft, 2 active, 1 superseded. */
export const fixtureVersions = (): TaxonomyVersionFacts[] =>
  versionsPageFixture().items as unknown as TaxonomyVersionFacts[];

export const versionFacts = (
  overrides: Partial<TaxonomyVersionFacts> = {},
): TaxonomyVersionFacts => ({
  id: ROW_ID,
  version: '2',
  contentHash: HASH,
  state: 'active',
  taxonomyId: TAXONOMY_ID,
  taxonomyKey: 'instruments',
  taxonomyVersion: 2,
  shape: 'hierarchical',
  allowedTypeKeys: ['article', 'profile'],
  allowedFieldKeys: ['tags'],
  canonicalOverlapDomains: ['role'],
  ...overrides,
});

export const createdFacts = (
  overrides: Partial<TaxonomyCreatedFacts> = {},
): TaxonomyCreatedFacts => ({
  id: ROW_ID,
  taxonomyId: TAXONOMY_ID,
  taxonomyKey: 'instruments',
  taxonomyVersion: 3,
  version: '3',
  ...overrides,
});

export const submitStub = (...results: TaxonomySubmitResult[]) => {
  const queue = [...results];
  return vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected submit');
    return next;
  });
};

export const loadedVersions = (
  items: readonly TaxonomyVersionFacts[],
): TaxonomyVersionsResult => ({
  kind: 'loaded',
  page: { items, pageVersion: '9' },
});

export const readStub = (...results: TaxonomyVersionsResult[]) => {
  const queue = [...results];
  return vi.fn(async () => queue.shift() ?? ({ kind: 'unavailable' } as const));
};
