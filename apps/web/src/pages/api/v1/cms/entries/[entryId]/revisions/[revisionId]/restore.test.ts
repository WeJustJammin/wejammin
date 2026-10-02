import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './restore';

const origin = 'https://app.example.test';
const entryId = '123e4567-e89b-42d3-a456-426614174000';
const sourceRevisionId = '123e4567-e89b-42d3-a456-426614174001';
const migrationChainId = '123e4567-e89b-42d3-a456-426614174002';
const restoredRevisionId = '123e4567-e89b-42d3-a456-426614174003';
const route = `/api/v1/cms/entries/${entryId}/revisions/${sourceRevisionId}/restore`;
const body = {
  entryId,
  revisionId: sourceRevisionId,
  migrationChainId,
  expectedVersion: '2',
};
const resource = {
  id: restoredRevisionId,
  version: '3',
  createdAt: '2026-09-27T00:00:00Z',
  updatedAt: '2026-09-27T00:00:00Z',
  state: 'draft',
  entryId,
  revisionNumber: '3',
  schemaVersionId: migrationChainId,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [sourceRevisionId],
  validationState: 'valid',
  conflictId: null,
};
const request = (
  payload: unknown = body,
  extra: Record<string, string> = {},
): Request =>
  new Request(origin + route, {
    method: 'POST',
    headers: {
      origin,
      cookie:
        'wj_session_ref=opaque; wj_csrf=csrf-token-123; stray=never-forward',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'revision-restore-0001',
      'if-match': '"2"',
      'content-type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(payload),
  });
const post = (
  input: Request = request(),
  ids: { entryId?: string; revisionId?: string } = {
    entryId,
    revisionId: sourceRevisionId,
  },
) =>
  POST({ request: input, params: ids } as unknown as Parameters<
    typeof POST
  >[0]);

describe('first-party CMS revision restore endpoint (CMS-03B-04)', () => {
  it('forwards a valid restore through the private binding and verifies the new draft', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions/${restoredRevisionId}`,
        },
      }),
    );
    expect(prerender).toBe(false);
    const response = await post();
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe('https://platform-api.internal' + route);
    expect(forwarded.headers.get('if-match')).toBe('"2"');
    expect(forwarded.headers.get('idempotency-key')).toBe(
      'revision-restore-0001',
    );
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_session_ref=opaque; wj_csrf=csrf-token-123',
    );
  });

  it('rejects forged origin, CSRF, malformed path, and weak CAS before forwarding', async () => {
    fetchMock.mockReset();
    expect(
      (await post(request(body, { origin: 'https://evil.example.test' })))
        .status,
    ).toBe(403);
    expect(
      (await post(request(body, { 'x-csrf-token': 'wrong' }))).status,
    ).toBe(403);
    expect(
      (await post(request(), { entryId, revisionId: 'invalid' })).status,
    ).toBe(400);
    expect((await post(request(body, { 'if-match': 'W/"2"' }))).status).toBe(
      400,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects path/body disagreement, unknown authority, and stale header/body pairing', async () => {
    fetchMock.mockReset();
    expect(
      (await post(request({ ...body, revisionId: restoredRevisionId }))).status,
    ).toBe(422);
    expect((await post(request({ ...body, ownerId: entryId }))).status).toBe(
      422,
    );
    expect((await post(request(body, { 'if-match': '"3"' }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a forged upstream success instead of presenting a restored draft', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...resource, state: 'published' }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions/${restoredRevisionId}`,
        },
      }),
    );
    expect((await post()).status).toBe(502);
  });
});
