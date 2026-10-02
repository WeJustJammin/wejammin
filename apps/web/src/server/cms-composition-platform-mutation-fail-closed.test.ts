import { describe, expect, it, vi } from 'vitest';

import { forwardCmsTemplateDefineMutation } from './cms-composition-platform-mutation';
import {
  ACTOR_ID,
  RESOURCE,
  request,
  success,
} from './cms-composition-platform-mutation-test-support';

describe('CMS-11 first-party template mutation boundary', () => {
  it('rejects an undeclared query before the protected template write', async () => {
    const base = request();
    const withQuery = new Request(`${base.url}?ownerId=${ACTOR_ID}`, base);
    const fetch = vi.fn(async () => success());

    const response = await forwardCmsTemplateDefineMutation(withQuery, {
      fetch,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'INVALID_REQUEST',
      details: {},
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed success status, resource, ETag, or digest without disclosure', async () => {
    const badResponses = [
      new Response(JSON.stringify(RESOURCE), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"1"' },
      }),
      success({ ...RESOURCE, ownerId: ACTOR_ID }),
      success(RESOURCE, 'W/"1"'),
      success({ ...RESOURCE, blockRegistryDigest: 'b'.repeat(64) }),
      success({ ...RESOURCE, templateKey: 'wrong' }),
      new Response('x'.repeat(270_000), {
        status: 201,
        headers: { etag: '"1"' },
      }),
    ];
    for (const upstream of badResponses) {
      const response = await forwardCmsTemplateDefineMutation(request(), {
        fetch: vi.fn(async () => upstream),
      });
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
    }
  });

  it('fails closed when the service binding is missing or throws', async () => {
    const missing = await forwardCmsTemplateDefineMutation(request(), null);
    expect(missing.status).toBe(503);
    const thrown = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () => {
        throw new Error('private');
      }),
    });
    expect(thrown.status).toBe(503);
    expect(JSON.stringify(await thrown.json())).not.toContain('private');
  });

  it('fails closed for wrong methods, invalid bindings, and non-Response upstream results', async () => {
    const getRequest = new Request(
      'https://app.example.test/api/v1/cms/templates/versions',
      {
        method: 'GET',
        headers: { origin: 'https://app.example.test' },
      },
    );
    expect(
      (
        await forwardCmsTemplateDefineMutation(getRequest, {
          fetch: vi.fn(async () => success()),
        })
      ).status,
    ).toBe(400);
    expect(
      (await forwardCmsTemplateDefineMutation(request(), { fetch: 'private' }))
        .status,
    ).toBe(503);
    expect(
      (
        await forwardCmsTemplateDefineMutation(request(), {
          fetch: vi.fn(async () => 'private'),
        })
      ).status,
    ).toBe(503);
  });
});
