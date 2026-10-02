import { describe, expect, it, vi } from 'vitest';

import { forwardCmsTemplateDefineMutation } from './cms-composition-platform-mutation';
import {
  BODY,
  PARTY_ID,
  RESOURCE,
  cookie,
  request,
  success,
} from './cms-composition-platform-mutation-test-support';

describe('CMS-11 first-party template mutation boundary', () => {
  it('forwards only validated JSON and allowlisted session headers to the named Worker route', async () => {
    const fetch = vi.fn(async (sent: Request) => {
      expect(sent).toBeInstanceOf(Request);
      return success();
    });
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch,
    });
    expect(response.status).toBe(201);
    const received = await response.json();
    expect(received).toEqual(RESOURCE);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(1);
    const sent = fetch.mock.calls[0]?.[0] as Request;
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/templates/versions',
    );
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('origin')).toBeNull();
    expect(sent.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(sent.headers.get('x-csrf-token')).toBe('csrf-token-123');
    expect(sent.headers.get('idempotency-key')).toBe('template-create-0001');
    expect(await sent.json()).toEqual(BODY);
    expect(JSON.stringify(received)).not.toContain('private');
  });

  it('forwards a matching strong successor validator exactly once', async () => {
    const fetch = vi.fn(async (sent: Request) => {
      expect(sent).toBeInstanceOf(Request);
      return success({ ...RESOURCE, version: '2', templateVersion: 2 }, '"2"');
    });
    const response = await forwardCmsTemplateDefineMutation(
      request({ ...BODY, expectedVersion: '1' }, { 'if-match': '"1"' }),
      { fetch },
    );
    expect(response.status).toBe(201);
    const sent = fetch.mock.calls[0]?.[0] as Request;
    expect(sent.headers.get('if-match')).toBe('"1"');
    expect((await sent.json()) as Record<string, unknown>).toMatchObject({
      expectedVersion: '1',
    });
  });

  it('rejects cross-site, CSRF, media, header, and authority failures without an upstream call', async () => {
    const fetch = vi.fn(async () => success());
    const missingKey = request();
    missingKey.headers.delete('idempotency-key');
    const cases: readonly [Request, number, string][] = [
      [
        request(BODY, { origin: 'https://evil.example.test' }),
        403,
        'TEMPLATE_FORBIDDEN',
      ],
      [request(BODY, { 'x-csrf-token': 'wrong' }), 403, 'TEMPLATE_FORBIDDEN'],
      [
        request(BODY, { 'content-type': 'text/plain' }),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      ],
      [request(BODY, { 'idempotency-key': 'short' }), 400, 'INVALID_REQUEST'],
      [request(BODY, { 'idempotency-key': '' }), 400, 'INVALID_REQUEST'],
      [missingKey, 400, 'INVALID_REQUEST'],
      [request(BODY, { 'if-match': 'W/"1"' }), 400, 'INVALID_REQUEST'],
      [
        request({ ...BODY, ownerId: PARTY_ID }),
        422,
        'TEMPLATE_VALIDATION_FAILED',
      ],
      [request({ ...BODY, expectedVersion: '1' }), 400, 'INVALID_REQUEST'],
    ];
    for (const [incoming, status, code] of cases) {
      const result = await forwardCmsTemplateDefineMutation(incoming, {
        fetch,
      });
      expect(result.status).toBe(status);
      expect(await result.json()).toMatchObject({
        code,
        requestId: '50000000-0000-4000-8000-000000000005',
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bounds inbound bytes before parsing and rejects malformed JSON', async () => {
    const fetch = vi.fn(async () => success());
    const oversized = request({ ...BODY, audience: 'x'.repeat(270_000) });
    expect(
      (await forwardCmsTemplateDefineMutation(oversized, { fetch })).status,
    ).toBe(400);
    const malformed = new Request(
      'https://app.example.test/api/v1/cms/templates/versions',
      {
        method: 'POST',
        headers: {
          origin: 'https://app.example.test',
          cookie,
          'x-csrf-token': 'csrf-token-123',
          'content-type': 'application/json',
          'idempotency-key': 'template-create-0001',
        },
        body: '{',
      },
    );
    expect(
      (await forwardCmsTemplateDefineMutation(malformed, { fetch })).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
