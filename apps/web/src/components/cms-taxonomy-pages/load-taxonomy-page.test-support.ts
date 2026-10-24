import { vi } from 'vitest';

import {
  TAXONOMY_ID,
  jsonResponse,
  taxonomyApiError,
  termsPageFixture,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import type { TaxonomyPageReads } from './taxonomy-page-reads';

export const ORIGIN = 'https://web.test';
export const BASE = `/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}`;
export const request = (
  path: string,
  cookie = 'wj_access=a; wj_csrf=csrf-token-1',
) => new Request(`${ORIGIN}${path}`, { headers: { cookie } });

export const versionsOk = (overrides: Record<string, unknown> = {}) =>
  jsonResponse(200, versionsPageFixture(overrides), {
    etag: `"${versionsPageFixture(overrides).pageVersion}"`,
  });
export const termsOk = (overrides: Record<string, unknown> = {}) =>
  jsonResponse(200, termsPageFixture(overrides), {
    etag: `"${termsPageFixture(overrides).pageVersion}"`,
  });
export const failure = (status: number, headers: Record<string, string> = {}) =>
  jsonResponse(
    status,
    taxonomyApiError('cmsTaxonomyVersionsRead', status),
    headers,
  );

export const reads = (
  versions: Response = versionsOk(),
  terms: Response = termsOk(),
) =>
  ({
    versions: vi.fn(async () => versions),
    terms: vi.fn(async () => terms),
  }) satisfies TaxonomyPageReads;
