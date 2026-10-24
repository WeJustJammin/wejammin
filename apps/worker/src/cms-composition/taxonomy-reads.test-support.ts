import type {
  TaxonomySelectorPage,
  TaxonomyTermListItem,
  TaxonomyTermListPage,
} from '@wejammin/contracts';
import { Hono } from 'hono';
import { vi } from 'vitest';

import { registerCmsTaxonomyDefinitionRoutes } from './taxonomy-definition-routes';
import type { CmsTaxonomyDefinitionDependencies } from './taxonomy-definition-shared';
import {
  taxonomyDefinitionId,
  taxonomyDefinitionOrigin,
  taxonomyResource,
  taxonomySession,
} from './taxonomy-definition.test-support';

/** Fixtures and a route harness for the two taxonomy reads that follow CMS-03C-16 (BE03c 166-167, 179). */
export const READS_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const TERMS_PATH = `/api/v1/cms/taxonomies/${taxonomyDefinitionId}/terms`;
export const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';
export const SELECTOR_QUERY =
  'typeKey=article&fieldKey=instruments&locale=en-US';

const termId = (index: number): string =>
  `aaaaaaaa-0000-4000-8000-${String(index).padStart(12, '0')}`;

export const termItem = (
  index: number,
  overrides: Partial<TaxonomyTermListItem> = {},
): TaxonomyTermListItem => ({
  termId: termId(index),
  termKey: `term-${String(index).padStart(3, '0')}`,
  lifecycle: 'active',
  version: '1',
  parentId: null,
  successorId: null,
  labels: [{ locale: 'en-US', label: `Term ${index}` }],
  aliases: [],
  ...overrides,
});

export const termsPage = (
  count = 2,
  overrides: Partial<TaxonomyTermListPage> = {},
): TaxonomyTermListPage => ({
  items: Array.from({ length: count }, (_, index) => termItem(index + 1)),
  nextCursor: null,
  pageVersion: '1790000000000000',
  ...overrides,
});

export const selectorTerm = (
  index: number,
  taxonomyKey = 'instrument-tags',
) => ({
  taxonomyId: taxonomyDefinitionId,
  taxonomyVersionId: '55555555-5555-4555-8555-555555555555',
  taxonomyKey,
  shape: 'flat' as const,
  termId: termId(index),
  termKey: `term-${String(index).padStart(3, '0')}`,
  parentId: null,
  label: `Term ${index}`,
});

export const selectorPage = (
  count = 2,
  overrides: Partial<TaxonomySelectorPage> = {},
): TaxonomySelectorPage => ({
  items: Array.from({ length: count }, (_, index) => selectorTerm(index + 1)),
  nextCursor: null,
  pageVersion: '1790000000000000',
  ...overrides,
});

export const createReadsHarness = (
  overrides: Partial<CmsTaxonomyDefinitionDependencies> = {},
  capabilities: readonly string[] = ['cms.taxonomy_curator', 'cms.author'],
) => {
  const resolveSession = vi.fn(async () => ({
    ok: true as const,
    value: { ...taxonomySession, capabilities },
  }));
  const rateLimit = vi.fn(async (input: { limit: number }) => ({
    ok: true as const,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 60,
    },
  }));
  const readTerms = vi.fn<CmsTaxonomyDefinitionDependencies['readTerms']>(
    async () => ({ ok: true, value: termsPage() }),
  );
  const readSelector = vi.fn<CmsTaxonomyDefinitionDependencies['readSelector']>(
    async () => ({ ok: true, value: selectorPage() }),
  );
  const dependencies: CmsTaxonomyDefinitionDependencies = {
    humanOrigins: [taxonomyDefinitionOrigin],
    now: () => 0,
    resolveSession,
    rateLimit,
    createVersion: vi.fn(async () => ({
      ok: true as const,
      value: taxonomyResource(),
    })),
    readVersions: vi.fn(async () => ({
      ok: true as const,
      value: { items: [taxonomyResource()], pageVersion: '9' },
    })),
    readTerms,
    readSelector,
    telemetry: vi.fn(),
    ...overrides,
  };
  const app = new Hono();
  registerCmsTaxonomyDefinitionRoutes(app, dependencies);
  return {
    dependencies,
    resolveSession,
    rateLimit,
    readTerms,
    readSelector,
    request: (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          origin: taxonomyDefinitionOrigin,
          'x-request-id': READS_REQUEST_ID,
          ...(init.headers as Record<string, string> | undefined),
        },
      }),
  };
};
