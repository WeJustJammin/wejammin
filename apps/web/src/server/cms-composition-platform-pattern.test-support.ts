import { vi } from 'vitest';

/*
 * Setup fixtures for the CMS-03C-02 first-party proxy test: the request
 * builder, the upstream binding stub, and the success/error response builders.
 * Extracted so the test file stays under the 300-line limit; semantics are
 * unchanged from the inline originals.
 */
export const path = '/api/v1/cms/compositions/pattern-instances';
export const revisionId = 'd3000000-0000-4000-8000-000000000011';
export const patternId = 'd3000000-0000-4000-8000-000000000012';
export const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
};
export const resource = {
  id: 'd3000000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary/hero',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
export const request = (
  options: {
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: string;
  } = {},
): Request =>
  new Request(`https://app.example.test${options.path ?? path}`, {
    method: options.method ?? 'POST',
    headers: {
      origin: 'https://app.example.test',
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123; unrelated=private',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'pattern-command-0001',
      'if-match': '"1"',
      ...options.headers,
    },
    ...(options.method === 'GET'
      ? {}
      : { body: options.rawBody ?? JSON.stringify(options.body ?? body) }),
  });
export const binding = (result: Response | unknown | Error) => {
  const fetch = vi.fn(async (request: Request) => {
    if (!(request instanceof Request))
      throw new Error('Expected a forwarded Request.');
    if (result instanceof Error) throw result;
    return result;
  });
  return { fetch };
};
// A placement 201 carries a PatternPlacementResource list; the ETag is the entry
// aggregate version (BE00), which need not equal any row `version`.
export const success = (
  value: unknown = resource,
  status = 201,
  etag = '"1"',
) =>
  new Response(JSON.stringify({ items: [value] }), {
    status,
    headers: { 'content-type': 'application/json', etag },
  });
export const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'd3000000-0000-4000-8000-000000000014',
      details,
    }),
    { status, headers },
  );
