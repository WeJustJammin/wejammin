import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './variants';

const entryId = 'd1000000-0000-4000-8000-000000000001';
const sourceRevisionId = 'd1000000-0000-4000-8000-000000000002';
const revisionId = 'd1000000-0000-4000-8000-000000000003';
const variantId = 'd1000000-0000-4000-8000-000000000004';
const fieldId = 'd1000000-0000-4000-8000-000000000005';
const path = `/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`;
const body = {
  entryId,
  locale: 'fr-FR',
  sourceRevisionId,
  fields: [{ fieldId, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: 'a'.repeat(64),
  expectedVersion: '1',
};
const resource = {
  id: variantId,
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
  state: 'draft',
  entryId,
  revisionId,
  locale: 'fr-FR',
  sourceRevisionId,
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
};

describe('first-party CMS locale endpoint (CMS-03C-04)', () => {
  it('stays dynamic and forwards through the private Worker binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: { 'content-type': 'application/json', etag: '"2"' },
      }),
    );
    const request = new Request(`https://app.example.test${path}`, {
      method: 'POST',
      headers: {
        origin: 'https://app.example.test',
        cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
        'x-csrf-token': 'csrf-token-123',
        'content-type': 'application/json',
        'idempotency-key': 'locale-command-0001',
        'if-match': '"1"',
      },
      body: JSON.stringify(body),
    });
    const response = await POST({
      request,
      params: { entryId, locale: 'fr-FR' },
    } as unknown as Parameters<typeof POST>[0]);
    expect(prerender).toBe(false);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[0] as Request).url).toBe(
      `https://platform-api.internal${path}`,
    );
  });
});
