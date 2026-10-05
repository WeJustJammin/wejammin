import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './versions';

const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const TEMPLATE_ID = '40000000-0000-4000-8000-000000000004';
const HASH = 'a'.repeat(64);
const body = {
  templateKey: 'profile-header',
  compatibleTypeIds: [TYPE_ID],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
};
const resource = {
  id: TEMPLATE_ID,
  version: '1',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: body.templateKey,
  templateVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: body.reservedRegions,
  blockRegistryDigest: HASH,
};
const request = (contentType = 'application/json') =>
  new Request('https://app.example.test/api/v1/cms/templates/versions', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.test',
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'template-create-0001',
      'content-type': contentType,
    },
    body: JSON.stringify(body),
  });

describe('first-party CMS template endpoint', () => {
  it('serves only on-demand and forwards a valid write to the server binding', async () => {
    expect(prerender).toBe(false);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: { 'content-type': 'application/json', etag: '"1"' },
      }),
    );
    const response = await POST({ request: request() } as Parameters<
      typeof POST
    >[0]);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/templates/versions',
    );
  });

  it('rejects non-JSON before using the binding', async () => {
    fetchMock.mockClear();
    const response = await POST({
      request: request('text/plain'),
    } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
