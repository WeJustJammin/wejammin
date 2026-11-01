import {
  PatternVersionDetailSchema,
  PatternVersionResourceSchema,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
  type PatternVersionDetail,
  type PatternVersionResource,
} from '@wejammin/contracts';

import {
  CSRF,
  KEY,
  ORIGIN,
  bindingFor,
} from './cms-workflow-platform-command.test-support';

/*
 * Valid pattern-definition fixtures for the web suites (CMS-03C-12 and
 * cmsPatternLatestRead). Every builder parses through the REAL generated contract,
 * so a fixture can never drift from the schema it stands for.
 */
export { CSRF, KEY, ORIGIN, bindingFor };

export const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const PATTERN_ID = '90000000-0000-4000-8000-000000000009';
export const ROW_ID = '40000000-0000-4000-8000-000000000004';
export const HASH = 'a'.repeat(64);
export const INSTANT = '2026-10-14T12:00:00Z';
export const WRITE_PATH = '/api/v1/cms/patterns/versions';

export type PatternOperationId = 'CMS-03C-12' | 'cmsPatternLatestRead';

export const blockTree = (): unknown[] => [
  {
    kind: 'block',
    key: 'hero',
    blockKey: 'profile.header',
    blockVersion: 1,
    props: { title: 'Hello' },
    children: [
      {
        kind: 'block',
        key: 'title',
        blockKey: 'profile.text',
        blockVersion: 3,
        props: {},
        children: [],
      },
    ],
  },
];

export const patternRequestBody = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  patternKey: 'profile-hero',
  compatibleTypeIds: [TYPE_ID],
  blockTree: blockTree(),
  expectedVersion: null,
  ...overrides,
});

const resourceBase = {
  id: ROW_ID,
  version: '1',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'draft',
  patternId: PATTERN_ID,
  patternKey: 'profile-hero',
  patternVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  nodeCount: 2,
  blockRegistryDigest: 'b'.repeat(64),
} as const;

export const patternResourceFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): PatternVersionResource =>
  PatternVersionResourceSchema.parse({ ...resourceBase, ...overrides });

export const patternDetailFixture = (
  overrides: Readonly<Record<string, unknown>> = {},
): PatternVersionDetail =>
  PatternVersionDetailSchema.parse({
    ...resourceBase,
    blockTree: blockTree(),
    ...overrides,
  });

/** An ApiError in the composition catalog's exact code and message for `status`. */
export const patternApiError = (
  operation: PatternOperationId,
  status: number,
  details: Readonly<Record<string, unknown>> = status >= 502 && status <= 504
    ? { dependencyClass: 'cms_composition', retryable: true }
    : {},
): Record<string, unknown> => {
  const code = cmsCompositionCatalogCode(operation, status) as string;
  return {
    code,
    message: cmsCompositionCatalogMessage('composition', code),
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

export const writeRequest = (
  overrides: Readonly<{
    body?: BodyInit;
    headers?: Readonly<Record<string, string | null>>;
    url?: string;
    method?: string;
  }> = {},
  body: Record<string, unknown> = patternRequestBody(),
): Request => {
  const headers = new Headers({
    cookie: `wj_access=a; unrelated=secret; wj_csrf=${CSRF}`,
    origin: ORIGIN,
    'x-csrf-token': CSRF,
    'idempotency-key': KEY,
    'content-type': 'application/json',
  });
  if (body.expectedVersion !== null && body.expectedVersion !== undefined)
    headers.set('if-match', `"${String(body.expectedVersion)}"`);
  for (const [name, value] of Object.entries(overrides.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(overrides.url ?? `${ORIGIN}${WRITE_PATH}`, {
    method: overrides.method ?? 'POST',
    headers,
    ...((overrides.method ?? 'POST') === 'GET'
      ? {}
      : { body: overrides.body ?? JSON.stringify(body) }),
  });
};

export const latestRequest = (
  patternKey = 'profile-hero',
  headers: Readonly<Record<string, string>> = {},
  search = '',
): Request =>
  new Request(`${ORIGIN}/api/v1/cms/patterns/${patternKey}${search}`, {
    method: 'GET',
    headers: { cookie: `wj_access=a; unrelated=secret`, ...headers },
  });
