import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './pattern-instances';

const revisionId = 'd1000000-0000-4000-8000-000000000011';
const patternId = 'd1000000-0000-4000-8000-000000000012';
const instanceId = 'd1000000-0000-4000-8000-000000000013';
const path = '/api/v1/cms/compositions/pattern-instances';
const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
};
const resource = {
  id: instanceId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary',
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
const request = (
  overrides: { body?: unknown; headers?: Record<string, string> } = {},
) =>
  new Request(`https://app.example.test${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://app.example.test',
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'pattern-command-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    body: JSON.stringify(overrides.body ?? body),
  });

describe('first-party CMS pattern instance endpoint (CMS-03C-02)', () => {
  it('stays dynamic and forwards a validated mutation through the private Worker binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"1"',
        },
      }),
    );
    const response = await POST({ request: request() } as Parameters<
      typeof POST
    >[0]);
    expect(prerender).toBe(false);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(await forwarded.json()).toEqual(body);
  });

  it('rejects forged origin and caller authority fields before the Worker call', async () => {
    fetchMock.mockReset();
    const crossOrigin = await POST({
      request: request({ headers: { origin: 'https://evil.test' } }),
    } as Parameters<typeof POST>[0]);
    expect(crossOrigin.status).toBe(403);
    const injected = await POST({
      request: request({ body: { ...body, ownerId: instanceId } }),
    } as Parameters<typeof POST>[0]);
    expect(injected.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
