import { vi } from 'vitest';

/*
 * Fixtures for the first-party CMS-03C-13/-14/-15 proxy suites: the request builder, the upstream binding stub and
 * the success/error response builders. Every value is a canonical accepted contract value.
 */
export const ORIGIN = 'https://app.example.test';
export const contentTypeId = 'd4000000-0000-4000-8000-000000000001';
export const patternId = 'd4000000-0000-4000-8000-000000000002';
export const patternVersionId = 'd4000000-0000-4000-8000-000000000003';
export const instanceId = 'd4000000-0000-4000-8000-000000000004';
export const instanceId2 = 'd4000000-0000-4000-8000-000000000005';
export const revisionId = 'd4000000-0000-4000-8000-000000000006';
export const requestId = 'd4000000-0000-4000-8000-000000000007';

/** A distinct valid version id per (key, version): a polynomial hash of the key keeps keys that share letters apart. */
const versionIdOf = (patternKey: string, patternVersion: number): string => {
  const hash = [...patternKey].reduce(
    (sum, c) => (sum * 31 + c.charCodeAt(0)) % 1_000_000_000,
    7,
  );
  return `d4000000-0000-4000-8000-${String(100_000_000_000 + hash * 100 + patternVersion)}`;
};

export const selectorItem = (
  patternKey = 'hero-block',
  patternVersion = 2,
) => ({
  patternId,
  patternVersionId: versionIdOf(patternKey, patternVersion),
  patternKey,
  patternVersion,
  nodeCount: 3,
  blockRegistryDigest: 'a'.repeat(64),
});
export const selectorPage = (
  items: readonly unknown[] = [selectorItem()],
  nextCursor: string | null = null,
) => ({ items, nextCursor, pageVersion: '7' });

const nodeValue = (props: Record<string, unknown> = {}) => ({
  blockKey: 'profile.header',
  blockVersion: 1,
  props,
  children: [],
});
export const diffResource = (overrides: Record<string, unknown> = {}) => ({
  instance: {
    id: instanceId,
    version: '3',
    revisionId,
    path: '/main/hero',
    state: 'pending_diff',
    linkMode: 'linked',
    pinnedPatternVersion: 1,
  },
  slotPath: '/main',
  targetPatternVersion: 2,
  paths: [
    {
      path: '/hero',
      base: nodeValue({ text: 'a' }),
      theirs: nodeValue({ text: 'b' }),
      yours: { text: 'mine' },
      collision: true,
      collisionKind: 'props',
    },
  ],
  newRoots: [],
  collisionCount: 1,
  bulkEligible: false,
  ...overrides,
});

export const rowOf = (
  id: string,
  version: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  version,
  contentHash: 'c'.repeat(64),
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  state: 'active',
  revisionId,
  path: id === instanceId ? '/main/hero' : '/main/footer',
  position: id === instanceId ? 0 : 1,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 2,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
  ...extra,
});

export const acceptBody = {
  action: 'accept',
  targetPatternVersion: 2,
  instances: [
    {
      instanceId,
      expectedVersion: '3',
      choices: [{ path: '/hero', choice: 'theirs' }],
    },
  ],
  expectedVersion: '9',
};

export const request = (options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}): Request => {
  const method = options.method ?? 'GET';
  return new Request(`${ORIGIN}${options.url}`, {
    method,
    headers: {
      origin: ORIGIN,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123; unrelated=private',
      ...(method === 'POST'
        ? {
            'x-csrf-token': 'csrf-token-123',
            'content-type': 'application/json',
            'idempotency-key': 'composition-update-0001',
            'if-match': '"9"',
          }
        : {}),
      ...options.headers,
    },
    ...(method === 'GET'
      ? {}
      : {
          body: options.rawBody ?? JSON.stringify(options.body ?? acceptBody),
        }),
  });
};

export const binding = (result: Response | Error) => {
  const fetch = vi.fn(async (forwarded: Request) => {
    if (!(forwarded instanceof Request))
      throw new Error('Expected a forwarded Request.');
    if (result instanceof Error) throw result;
    return result;
  });
  return { fetch };
};

export const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const apiError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId,
      details,
    }),
    { status, headers },
  );

export const forwardedOf = (stub: {
  fetch: { mock: { calls: unknown[][] } };
}): Request => stub.fetch.mock.calls[0]?.[0] as Request;

/* cmsCompositionInstancesRead (DEC-206): the entry whose current draft revision is listed, and a page of its rows. */
export const entryId = 'd4000000-0000-4000-8000-000000000008';
export const instancesPage = (
  rows: readonly unknown[] = [rowOf(instanceId, '3'), rowOf(instanceId2, '1')],
  nextCursor: string | null = null,
  revision: string | null = revisionId,
) => ({ revisionId: revision, items: rows, nextCursor });
