import { describe, expect, it, vi } from 'vitest';

import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import {
  bindingWith,
  errorCode,
  jsonResponse,
  maxBodyBytes,
  observedStream,
  oversizeStreamTotal,
  paddedCreateBody,
  post,
  postStream,
  validCreateBody,
  validCreateResource,
  uuid,
  uuid2,
} from './cms-editorial-platform-proxies-hardening-test-support';

/*
 * Hardening for the CMS-03B-10 create proxy: a supplied If-Match refused
 * rather than dropped, the locked 256 KiB cap applied before any contract
 * parse, and a 201 accepted only as a strict resource whose Location resolves
 * to the entry it names. Base cases live in
 * cms-editorial-platform-proxies.test.ts.
 */

describe('cms-editorial create proxy header tuple (CMS-03B-10)', () => {
  it('refuses a supplied If-Match instead of silently dropping it', async () => {
    const handler = vi.fn(async () =>
      jsonResponse(validCreateResource, {
        status: 201,
        headers: { location: '/api/v1/cms/entries/' + uuid },
      }),
    );
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody, { 'if-match': '"99"' }),
      bindingWith(handler),
    );
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('INVALID_REQUEST');
    expect(handler).not.toHaveBeenCalled();
  });

  it('still accepts the documented create header tuple', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(validCreateResource, {
          status: 201,
          headers: { location: '/api/v1/cms/entries/' + uuid },
        }),
      ),
    );
    expect(response.status).toBe(201);
  });
});

describe('cms-editorial create proxy bounded body (CMS-03B-10)', () => {
  it('accepts an under-cap declared length as proof the cap is not blanket', async () => {
    const handler = vi.fn(async () =>
      jsonResponse(validCreateResource, {
        status: 201,
        headers: { location: '/api/v1/cms/entries/' + uuid },
      }),
    );
    const underCap = paddedCreateBody(maxBodyBytes - 4_096);
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(underCap, { 'content-length': String(underCap.length) }),
      bindingWith(handler),
    );
    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses an oversize declared body before the contract parse', async () => {
    const handler = vi.fn(async () => jsonResponse({}, { status: 201 }));
    const overCap = paddedCreateBody(maxBodyBytes);
    expect(overCap.length).toBeGreaterThan(maxBodyBytes);
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(overCap, { 'content-length': String(overCap.length) }),
      bindingWith(handler),
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses an oversize streaming body and cancels the source', async () => {
    const handler = vi.fn(async () => jsonResponse({}, { status: 201 }));
    const source = observedStream(oversizeStreamTotal);
    const response = await forwardCmsEditorialEntryCreateMutation(
      postStream(source.stream),
      bindingWith(handler),
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    expect(source.wasCancelled()).toBe(true);
  });
});

describe('cms-editorial create proxy 201 validation (CMS-03B-10)', () => {
  it('relays a 201 only when the resource is strict and Location names it', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(validCreateResource, {
          status: 201,
          headers: { location: '/api/v1/cms/entries/' + uuid, etag: '"1"' },
        }),
      ),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(validCreateResource);
  });

  it('refuses a 201 whose Location names a different entry', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(validCreateResource, {
          status: 201,
          headers: { location: '/api/v1/cms/entries/' + uuid2 },
        }),
      ),
    );
    expect(response.status).toBe(502);
  });

  it('refuses a weak create ETag instead of relaying an unverifiable 201', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(validCreateResource, {
          status: 201,
          headers: {
            location: '/api/v1/cms/entries/' + uuid,
            etag: 'W/"1"',
          },
        }),
      ),
    );
    expect(response.status).toBe(502);
  });

  it('refuses a cross-origin create Location', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(validCreateResource, {
          status: 201,
          headers: {
            location: 'https://evil.example.test/api/v1/cms/entries/' + uuid,
          },
        }),
      ),
    );
    expect(response.status).toBe(502);
  });

  it('refuses a 201 whose body is not the strict create resource', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(
          { ...validCreateResource, authority: 'cms.design' },
          { status: 201, headers: { location: '/api/v1/cms/entries/' + uuid } },
        ),
      ),
    );
    expect(response.status).toBe(502);
  });
});
