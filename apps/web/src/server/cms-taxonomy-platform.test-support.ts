import {
  TaxonomySelectorPageSchema,
  TaxonomyTermListPageSchema,
  TaxonomyTermResourceSchema,
  TaxonomyVersionResourceSchema,
  TaxonomyVersionsPageSchema,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
  type TaxonomySelectorPage,
  type TaxonomyTermListPage,
  type TaxonomyTermResource,
  type TaxonomyVersionResource,
  type TaxonomyVersionsPage,
} from '@wejammin/contracts';

import {
  CSRF,
  KEY,
  ORIGIN,
  bindingFor,
} from './cms-workflow-platform-command.test-support';

/*
 * Valid vocabulary fixtures for the web suites (CMS-03C-16, CMS-03C-03, CMS-03C-17,
 * cmsTaxonomyVersionsRead and cmsTaxonomyTermsRead). Every builder parses through the REAL
 * generated contract, so a fixture can never drift from the schema it stands for.
 */
export { CSRF, KEY, ORIGIN, bindingFor };

export const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';
export const TAXONOMY_ID = '90000000-0000-4000-8000-000000000009';
export const ROW_ID = '40000000-0000-4000-8000-000000000004';
export const TERM_ID = '50000000-0000-4000-8000-000000000005';
export const SURVIVOR_ID = '50000000-0000-4000-8000-000000000006';
export const PARENT_ID = '50000000-0000-4000-8000-000000000007';
export const CANONICAL_ID = '60000000-0000-4000-8000-000000000001';
export const HASH = 'a'.repeat(64);
export const INSTANT = '2026-10-14T12:00:00Z';
export const WRITE_PATH = '/api/v1/cms/taxonomies/versions';
export const ACTION_PATH = `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`;
export const VERSIONS_PATH = `/api/v1/cms/taxonomies/${TAXONOMY_ID}/versions`;
export const TERMS_PATH = `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms`;
export const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';

export type TaxonomyOperationId =
  | 'CMS-03C-16'
  | 'CMS-03C-03'
  | 'CMS-03C-17'
  | 'cmsTaxonomyVersionsRead'
  | 'cmsTaxonomyTermsRead';

export const versionRequestBody = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  taxonomyKey: 'instruments',
  shape: 'hierarchical',
  allowedTypeKeys: ['article', 'profile'],
  allowedFieldKeys: ['tags'],
  canonicalOverlapDomains: ['role'],
  expectedVersion: null,
  ...overrides,
});

const versionBase = {
  id: ROW_ID,
  version: '1',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'draft',
  taxonomyId: TAXONOMY_ID,
  taxonomyKey: 'instruments',
  taxonomyVersion: 1,
  shape: 'hierarchical',
  allowedTypeKeys: ['article', 'profile'],
  allowedFieldKeys: ['tags'],
  canonicalOverlapDomains: ['role'],
} as const;

export const versionFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomyVersionResource =>
  TaxonomyVersionResourceSchema.parse({ ...versionBase, ...overrides });

/** Newest first, as the read serves them: versions 3 (draft), 2 (active), 1 (superseded). */
export const versionsPageFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomyVersionsPage =>
  TaxonomyVersionsPageSchema.parse({
    items: [
      {
        ...versionBase,
        id: '40000000-0000-4000-8000-000000000033',
        version: '3',
        taxonomyVersion: 3,
      },
      {
        ...versionBase,
        id: '40000000-0000-4000-8000-000000000022',
        version: '2',
        taxonomyVersion: 2,
        state: 'active',
      },
      { ...versionBase, state: 'superseded' },
    ],
    pageVersion: '3',
    ...overrides,
  });

export const termActionBody = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  taxonomyId: TAXONOMY_ID,
  action: 'create',
  termKey: 'guitar',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en', label: 'Guitar' }],
  aliases: [],
  expectedVersion: '2',
  ...overrides,
});

export const termResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomyTermResource =>
  TaxonomyTermResourceSchema.parse({
    id: TERM_ID,
    version: '1',
    contentHash: HASH,
    createdAt: INSTANT,
    updatedAt: INSTANT,
    lifecycle: 'active',
    taxonomyId: TAXONOMY_ID,
    termId: TERM_ID,
    termKey: 'guitar',
    parentId: null,
    successorId: null,
    ...overrides,
  });

const termItem = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  termId: TERM_ID,
  termKey: 'guitar',
  lifecycle: 'active',
  version: '1',
  parentId: null,
  successorId: null,
  labels: [{ locale: 'en', label: 'Guitar' }],
  aliases: [],
  ...overrides,
});

export const termsPageFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomyTermListPage =>
  TaxonomyTermListPageSchema.parse({
    items: [
      termItem(),
      termItem({
        termId: SURVIVOR_ID,
        termKey: 'organ',
        labels: [{ locale: 'en', label: 'Organ' }],
      }),
    ],
    nextCursor: null,
    pageVersion: '7',
    ...overrides,
  });

export const selectorPageFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomySelectorPage =>
  TaxonomySelectorPageSchema.parse({
    items: [
      {
        taxonomyId: TAXONOMY_ID,
        taxonomyVersionId: ROW_ID,
        taxonomyKey: 'instruments',
        shape: 'hierarchical',
        termId: TERM_ID,
        termKey: 'guitar',
        parentId: null,
        label: 'Guitar',
      },
    ],
    nextCursor: null,
    pageVersion: '7',
    ...overrides,
  });

/** An ApiError in the taxonomy catalog's exact code and message for `status`. */
export const taxonomyApiError = (
  operation: TaxonomyOperationId,
  status: number,
  details: Readonly<Record<string, unknown>> = status >= 502 && status <= 504
    ? { dependencyClass: 'cms_composition', retryable: true }
    : {},
): Record<string, unknown> => {
  const code = cmsCompositionCatalogCode(operation, status) as string;
  return {
    code,
    message: cmsCompositionCatalogMessage('taxonomy', code),
    details,
    requestId: REQUEST_ID,
  };
};

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

interface WriteOverrides {
  readonly body?: BodyInit;
  readonly headers?: Readonly<Record<string, string | null>>;
  readonly url?: string;
  readonly method?: string;
}

const mutationRequest = (
  path: string,
  overrides: WriteOverrides,
  body: Record<string, unknown>,
  ifMatch: string | null,
): Request => {
  const headers = new Headers({
    cookie: `wj_access=a; unrelated=secret; wj_csrf=${CSRF}`,
    origin: ORIGIN,
    'x-csrf-token': CSRF,
    'idempotency-key': KEY,
    'content-type': 'application/json',
  });
  if (ifMatch !== null) headers.set('if-match', `"${ifMatch}"`);
  for (const [name, value] of Object.entries(overrides.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(overrides.url ?? `${ORIGIN}${path}`, {
    method: overrides.method ?? 'POST',
    headers,
    ...((overrides.method ?? 'POST') === 'GET'
      ? {}
      : { body: overrides.body ?? JSON.stringify(body) }),
  });
};

export const writeRequest = (
  overrides: WriteOverrides = {},
  body: Record<string, unknown> = versionRequestBody(),
): Request =>
  mutationRequest(
    WRITE_PATH,
    overrides,
    body,
    body.expectedVersion === null || body.expectedVersion === undefined
      ? null
      : String(body.expectedVersion),
  );

export const actionRequest = (
  overrides: WriteOverrides = {},
  body: Record<string, unknown> = termActionBody(),
): Request =>
  mutationRequest(
    overrides.url === undefined ? ACTION_PATH : new URL(overrides.url).pathname,
    overrides,
    body,
    String(body.expectedVersion),
  );

export const readRequest = (
  path: string,
  headers: Readonly<Record<string, string>> = {},
  search = '',
): Request =>
  new Request(`${ORIGIN}${path}${search}`, {
    method: 'GET',
    headers: { cookie: `wj_access=a; unrelated=secret`, ...headers },
  });
