import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './related-content';

const origin = 'https://app.example.test';
const entryId = '10000000-0000-4000-8000-000000000001';
const path = `/api/v1/cms/entries/${entryId}/related-content`;
const body = {
  entryId,
  pins: [],
  exclusions: [],
  derivedRule: null,
  expectedVersion: '1',
};
const resource = {
  id: '40000000-0000-4000-8000-000000000004',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'active',
  sourceEntryId: entryId,
  pins: [],
  exclusions: [],
  derivedRule: null,
  eligibleCount: 0,
};
const request = (
  payload: unknown = body,
  headers: Record<string, string> = {},
) =>
  new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      origin,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'related-content-0001',
      'if-match': '"1"',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

describe('CMS-03C-05 related-content page route', () => {
  it('is a dynamic first-party POST route that forwards to the protected Worker', async () => {
    expect(prerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: { 'content-type': 'application/json', etag: '"2"' },
      }),
    );
    const response = await POST({
      request: request(),
      params: { entryId },
    } as unknown as Parameters<typeof POST>[0]);
    expect(response.status).toBe(201);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(await forwarded.json()).toEqual(body);
  });

  it('fails closed without forwarding on invalid media', async () => {
    fetchMock.mockClear();
    const response = await POST({
      request: request('bad', { 'content-type': 'text/plain' }),
      params: { entryId },
    } as unknown as Parameters<typeof POST>[0]);
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
