import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './revisions';

const origin = 'https://app.example.test';
const entryId = '123e4567-e89b-42d3-a456-426614174000';
const revisionId = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const body = {
  entryId,
  baseRevision: '1',
  changedPaths: [`/fields/${revisionId}`],
  values: { [revisionId]: { title: 'Updated' } },
  locale: 'en-US',
  expectedVersion: '2',
};
const resource = {
  id: revisionId,
  version: '1',
  entryVersion: '3',
  createdAt: instant,
  updatedAt: instant,
  state: 'draft',
  entryId,
  revisionNumber: '2',
  schemaVersionId: revisionId,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: hash,
  parentRevisionIds: [entryId],
  validationState: 'valid',
  conflictId: null,
};
const request = (
  payload: unknown = body,
  extra: Record<string, string> = {},
): Request =>
  new Request(`${origin}/api/v1/cms/entries/${entryId}/revisions`, {
    method: 'POST',
    headers: {
      origin,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'revision-save-0001',
      'if-match': '"2"',
      'content-type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(payload),
  });
const post = (input: Request = request(), pathId = entryId) =>
  POST({ request: input, params: { entryId: pathId } } as unknown as Parameters<
    typeof POST
  >[0]);

describe('first-party CMS revision endpoint (CMS-03B-01)', () => {
  it('is server-rendered and forwards a valid, bounded revision through the private binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions/${revisionId}`,
        },
      }),
    );
    expect(prerender).toBe(false);
    const response = await post();
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${entryId}/revisions/${revisionId}`,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      `https://platform-api.internal/api/v1/cms/entries/${entryId}/revisions`,
    );
    expect(forwarded.headers.get('if-match')).toBe('"2"');
    expect(forwarded.headers.get('idempotency-key')).toBe('revision-save-0001');
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
  });

  it('denies cross-origin and mismatched CSRF before forwarding', async () => {
    fetchMock.mockReset();
    expect(
      (await post(request(body, { origin: 'https://evil.example.test' })))
        .status,
    ).toBe(403);
    expect(
      (await post(request(body, { 'x-csrf-token': 'wrong' }))).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid path, path/body mismatch, or weak If-Match', async () => {
    fetchMock.mockReset();
    expect((await post(request(), 'not-a-uuid')).status).toBe(400);
    expect((await post(request({ ...body, entryId: revisionId }))).status).toBe(
      422,
    );
    expect((await post(request(body, { 'if-match': 'W/"2"' }))).status).toBe(
      400,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an If-Match that disagrees with expectedVersion', async () => {
    fetchMock.mockReset();
    // Same status as the Worker's version disagreement (BE03b:230): 422.
    expect((await post(request(body, { 'if-match': '"3"' }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a forged successful upstream response', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...resource, entryId: revisionId }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions`,
        },
      }),
    );
    expect((await post()).status).toBe(502);
  });

  it('refuses a collection Location when the upstream created a revision', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions`,
        },
      }),
    );
    expect((await post()).status).toBe(502);
  });
});
