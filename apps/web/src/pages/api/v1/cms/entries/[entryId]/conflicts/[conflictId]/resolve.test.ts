import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './resolve';

const origin = 'https://app.example.test';
const entryId = '123e4567-e89b-42d3-a456-426614174000';
const conflictId = '123e4567-e89b-42d3-a456-426614174001';
const revisionId = '123e4567-e89b-42d3-a456-426614174002';
const parentId = '123e4567-e89b-42d3-a456-426614174003';
const instant = '2026-09-26T00:00:00Z';
const body = {
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path: `/fields/${revisionId}`, choice: 'theirs' }],
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
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [parentId, conflictId],
  validationState: 'valid',
  conflictId,
};
const route = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}/resolve`;
const request = (
  payload: unknown = body,
  extra: Record<string, string> = {},
): Request =>
  new Request(origin + route, {
    method: 'POST',
    headers: {
      origin,
      cookie: 'wj_session_ref=opaque; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'conflict-resolve-0001',
      'if-match': '"2"',
      'content-type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(payload),
  });
const post = (
  input: Request = request(),
  ids: { entryId?: string; conflictId?: string } = { entryId, conflictId },
) =>
  POST({ request: input, params: ids } as unknown as Parameters<
    typeof POST
  >[0]);

describe('first-party CMS conflict resolution endpoint (CMS-03B-02)', () => {
  it('forwards a valid resolution and verifies the two-parent revision', async () => {
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
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe('https://platform-api.internal' + route);
    expect(forwarded.headers.get('if-match')).toBe('"2"');
    expect(forwarded.headers.get('idempotency-key')).toBe(
      'conflict-resolve-0001',
    );
  });

  it('rejects forged origin, CSRF, path, and precondition before the Worker', async () => {
    fetchMock.mockReset();
    expect(
      (await post(request(body, { origin: 'https://evil.example.test' })))
        .status,
    ).toBe(403);
    expect(
      (await post(request(body, { 'x-csrf-token': 'wrong' }))).status,
    ).toBe(403);
    expect(
      (await post(request(), { entryId, conflictId: 'invalid' })).status,
    ).toBe(400);
    expect((await post(request(body, { 'if-match': 'W/"2"' }))).status).toBe(
      400,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects path/body disagreement and repeated or invalid choices', async () => {
    fetchMock.mockReset();
    expect(
      (await post(request({ ...body, conflictId: revisionId }))).status,
    ).toBe(422);
    expect(
      (
        await post(
          request({
            ...body,
            choices: [body.choices[0], body.choices[0]],
          }),
        )
      ).status,
    ).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses upstream success with mismatched conflict or missing parents', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...resource, parentRevisionIds: [] }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          etag: '"3"',
          location: `/api/v1/cms/entries/${entryId}/revisions/${revisionId}`,
        },
      }),
    );
    expect((await post()).status).toBe(502);
  });
});
