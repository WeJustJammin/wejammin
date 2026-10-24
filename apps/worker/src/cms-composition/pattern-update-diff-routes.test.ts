import {
  ApiErrorSchema,
  CmsCompositionRefusalDetailsSchema,
  CompositionUpdateDiffResourceSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import {
  diffResource,
  emptyDiff,
  PU_INSTANCE_ID,
  PU_ORIGIN,
  puDiffPath,
  puId,
} from './pattern-update.test-support';

/**
 * CMS-03C-14 (BE03c 176, 399, 1267, 1367, 1475): the three-way diff of one instance. The path is a UUID and no query
 * key is allowed; an instance with no newer version is a 200 with an empty diff; the diff must be the requested
 * instance's; the strong ETag is the instance `version`.
 */
describe('CMS-03C-14 update-diff route', () => {
  it('serves the strict diff with the quoted instance-version ETag', async () => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(puDiffPath());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(
      CompositionUpdateDiffResourceSchema.parse(await response.json()),
    ).toEqual(diffResource());
    expect(harness.readUpdateDiff.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03C-14',
      instanceId: PU_INSTANCE_ID,
    });
  });

  it('an instance with no newer version is a 200 with an empty diff, not an error', async () => {
    const harness = createPatternUpdateHarness({
      readUpdateDiff: async () => ({ ok: true, value: emptyDiff() }),
    });
    const response = await harness.request(puDiffPath());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      paths: [],
      collisionCount: 0,
      bulkEligible: false,
    });
  });

  it.each([
    ['a malformed instance id', puDiffPath('not-a-uuid'), 400],
    ['any query key', `${puDiffPath()}?debug=1`, 400],
    ['an empty query key', `${puDiffPath()}?x=`, 400],
  ])('%s is $2 before any quota or port', async (_name, path, status) => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(path);
    expect(response.status).toBe(status);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INVALID_REQUEST',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.readUpdateDiff).not.toHaveBeenCalled();
  });

  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'pattern-update-0001' }, 400],
    ['an If-Match', { 'if-match': '"3"' }, 400],
    ['a request media type', { 'content-type': 'application/json' }, 415],
    ['a declared body', { 'content-length': '5' }, 400],
  ])('a read carrying %s is $2', async (_name, headers, status) => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(puDiffPath(), { headers });
    expect(response.status).toBe(status);
    expect(harness.readUpdateDiff).not.toHaveBeenCalled();
  });

  it('a malformed path is answered after authentication, never before', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'U',
        message: 'u',
      }),
    });
    expect((await harness.request(puDiffPath('nope'))).status).toBe(401);
  });

  it.each([
    [404, 'COMPOSITION_NOT_FOUND', {}],
    [403, 'COMPOSITION_FORBIDDEN', { reasonCode: 'capability_missing' }],
    [422, 'COMPOSITION_VALIDATION_FAILED', { reasonCode: 'diff_too_large' }],
  ] as const)('publishes %i %s', async (status, code, details) => {
    const harness = createPatternUpdateHarness({
      readUpdateDiff: async () =>
        failure(status, { ...details, violations: [{ path: '/instanceId' }] }),
    });
    const response = await harness.request(puDiffPath());
    expect(response.status).toBe(status);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe(code);
    expect(body.details).toEqual(details);
    if (status !== 404)
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
  });

  it('a diff of another instance is a local 502, never shown', async () => {
    const harness = createPatternUpdateHarness({
      readUpdateDiff: async () => ({
        ok: true,
        value: diffResource({
          instance: { ...diffResource().instance, id: puId(101) },
        }),
      }),
    });
    const response = await harness.request(puDiffPath());
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
  });

  it('a diff outside the strict contract is a local 502', async () => {
    const harness = createPatternUpdateHarness({
      readUpdateDiff: async () => ({
        ok: true,
        value: { ...diffResource(), collisionCount: 4 },
      }),
    });
    expect((await harness.request(puDiffPath())).status).toBe(502);
  });

  it('the instance id is passed as received and the comparison ignores its case', async () => {
    const upper = PU_INSTANCE_ID.toUpperCase();
    const harness = createPatternUpdateHarness();
    const response = await harness.request(puDiffPath(upper));
    expect(response.status).toBe(200);
    expect(harness.readUpdateDiff.mock.calls[0]?.[0].instanceId).toBe(upper);
  });

  it('answers the preflight: allowed origin 204, bad origin 403, bad id 400', async () => {
    const harness = createPatternUpdateHarness();
    const allowed = await harness.request(puDiffPath(), { method: 'OPTIONS' });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    const denied = await harness.request(puDiffPath(), {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
    const bad = await harness.request(puDiffPath('nope'), {
      method: 'OPTIONS',
    });
    expect(bad.status).toBe(400);
    const deniedBad = await harness.request(puDiffPath('nope'), {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(deniedBad.status).toBe(403);
  });
});
