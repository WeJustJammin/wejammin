import {
  ApiErrorSchema,
  CompositionUpdateResourceSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import { KEY, post } from './pattern-update-post.test-support';
import {
  acceptBody,
  acceptResource,
  detachBody,
  detachResource,
  PU_ENTRY_ETAG,
  PU_REQUEST_ID,
  PU_UPDATE_PATH,
  puId,
} from './pattern-update.test-support';

/**
 * CMS-03C-15 (BE03c 177, 215, 400, 1268, 1476) admission and success: accept or detach 1-32 linked instances. The strong
 * If-Match is the entry aggregate version and equals the body `expectedVersion`; the answer is exactly `{ items }` bound
 * to the request with the committed entry version as the ETag. Refusal relay is in `pattern-update-refusals.test.ts`.
 */
describe('CMS-03C-15 pattern-update route', () => {
  it('accepts: 200 { items } with the committed entry ETag and the exact precondition at the port', async () => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(PU_ENTRY_ETAG);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      CompositionUpdateResourceSchema.parse(await response.json()),
    ).toEqual(acceptResource(1));
    expect(harness.applyUpdate.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03C-15',
      requestId: PU_REQUEST_ID,
      body: acceptBody(1),
      ifMatch: '7',
      idempotencyKey: KEY,
    });
  });

  it('detaches 2 instances and accepts 32 in one request', async () => {
    const detach = createPatternUpdateHarness({
      applyUpdate: async () => ({
        ok: true,
        value: detachResource(2),
        etag: PU_ENTRY_ETAG,
      }),
    });
    expect((await post(detach, { body: detachBody(2) })).status).toBe(200);
    const bulk = createPatternUpdateHarness({
      applyUpdate: async () => ({
        ok: true,
        value: acceptResource(32),
        etag: PU_ENTRY_ETAG,
      }),
    });
    expect((await post(bulk, { body: acceptBody(32) })).status).toBe(200);
  });

  it('defaults an absent choices list to empty before the port', async () => {
    const harness = createPatternUpdateHarness();
    const body = {
      ...acceptBody(1),
      instances: [{ instanceId: puId(100), expectedVersion: '3' }],
    };
    await post(harness, { body });
    expect(harness.applyUpdate.mock.calls[0]?.[0].body).toEqual(acceptBody(1));
  });

  it('forwards a single-instance accept with its choices', async () => {
    const choices = [{ path: '/hero', choice: 'yours' as const }];
    const body = {
      ...acceptBody(1),
      instances: [{ instanceId: puId(100), expectedVersion: '3', choices }],
    };
    const harness = createPatternUpdateHarness();
    expect((await post(harness, { body })).status).toBe(200);
    expect(harness.applyUpdate.mock.calls[0]?.[0].body).toEqual(body);
  });

  it.each([
    ['an unknown member', { ...acceptBody(1), actorId: puId(5) }, '/actorId'],
    [
      'a missing action',
      { instances: acceptBody(1).instances, expectedVersion: '7' },
      '/action',
    ],
    [
      'an action outside the enum',
      { ...acceptBody(1), action: 'merge' },
      '/action',
    ],
    [
      'an accept without a target',
      { ...acceptBody(1), targetPatternVersion: undefined },
      '/targetPatternVersion',
    ],
    [
      'a detach with a target',
      { ...detachBody(1), targetPatternVersion: 2 },
      '/targetPatternVersion',
    ],
    ['no instances', { ...acceptBody(1), instances: [] }, '/instances'],
    ['33 instances', acceptBody(33), '/instances'],
    [
      'a malformed instance id',
      {
        ...acceptBody(1),
        instances: [{ instanceId: 'x', expectedVersion: '3' }],
      },
      '/instances/0/instanceId',
    ],
    [
      'a repeated instance',
      {
        ...acceptBody(1),
        instances: [acceptBody(2).instances[0], acceptBody(2).instances[0]],
      },
      '/instances/1/instanceId',
    ],
    [
      'choices on a bulk request',
      {
        ...acceptBody(2),
        instances: [
          {
            ...acceptBody(2).instances[0]!,
            choices: [{ path: '/a', choice: 'yours' }],
          },
          acceptBody(2).instances[1],
        ],
      },
      '/instances/0/choices',
    ],
    [
      'a repeated choice path',
      {
        ...acceptBody(1),
        instances: [
          {
            instanceId: puId(100),
            expectedVersion: '3',
            choices: [
              { path: '/a', choice: 'yours' },
              { path: '/a', choice: 'theirs' },
            ],
          },
        ],
      },
      '/instances/0/choices/1/path',
    ],
    [
      'a non-numeric instance version',
      {
        ...acceptBody(1),
        instances: [{ instanceId: puId(100), expectedVersion: 'x' }],
      },
      '/instances/0/expectedVersion',
    ],
  ])(
    '%s is 422 naming %s, before any quota or port',
    async (_name, body, pointer) => {
      const harness = createPatternUpdateHarness();
      const response = await post(harness, { body });
      expect(response.status).toBe(422);
      const parsed = ApiErrorSchema.parse(await response.json());
      expect(parsed.code).toBe('COMPOSITION_VALIDATION_FAILED');
      expect(JSON.stringify(parsed.details)).toContain(pointer);
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.applyUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['text that is not JSON', 'not json', 400],
    ['an empty body', '', 400],
    ['a JSON scalar', '7', 422],
  ])('%s is $2', async (_name, raw, status) => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, { raw });
    expect(response.status).toBe(status);
    expect(harness.applyUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['any query key', { path: `${PU_UPDATE_PATH}?debug=1` }, 400],
    [
      'a media type other than JSON',
      { headers: { 'content-type': 'text/plain' } },
      415,
    ],
    ['a missing Idempotency-Key', { headers: { 'idempotency-key': '' } }, 400],
    [
      'a short Idempotency-Key',
      { headers: { 'idempotency-key': 'short' } },
      400,
    ],
    ['a weak If-Match', { headers: { 'if-match': 'W/"7"' } }, 400],
    ['an unquoted If-Match', { headers: { 'if-match': '7' } }, 400],
    [
      'an If-Match for another entry version',
      { headers: { 'if-match': '"8"' } },
      400,
    ],
    [
      'an origin that is not allowed',
      { headers: { origin: 'https://evil.example.test' } },
      403,
    ],
    [
      'a session cookie without the CSRF token',
      { headers: { cookie: 'wj_session_ref=ref-1' } },
      403,
    ],
  ])('%s is $2 and starts nothing', async (_name, options, status) => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, options);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.applyUpdate).not.toHaveBeenCalled();
  });

  it('a 415 names the JSON allowlist', async () => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, {
      headers: { 'content-type': 'text/plain' },
    });
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
      allowedMediaTypes: ['application/json'],
    });
  });

  it('a missing If-Match header is 400', async () => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(PU_UPDATE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': KEY },
      body: JSON.stringify(acceptBody(1)),
    });
    expect(response.status).toBe(400);
  });

  it('a streamed body over 262,144 bytes that declared no length is 400', async () => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, {
      body: { ...acceptBody(1), pad: 'x'.repeat(300_000) },
    });
    expect(response.status).toBe(400);
    expect(harness.applyUpdate).not.toHaveBeenCalled();
  });

  it('a declared length over the ceiling is 400 before the body is read', async () => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, {
      headers: { 'content-length': String(256 * 1024 + 1) },
    });
    expect(response.status).toBe(400);
  });

  it('a hostile cookie pair with a matching CSRF token passes the gate', async () => {
    const harness = createPatternUpdateHarness();
    const response = await post(harness, {
      headers: {
        cookie: 'wj_session_ref=ref-1; wj_csrf=tok',
        'x-csrf-token': 'tok',
      },
    });
    expect(response.status).toBe(200);
  });
});
