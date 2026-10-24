import {
  ApiErrorSchema,
  CmsCompositionRefusalDetailsSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import type { CmsPatternUpdateDependencies } from './pattern-update-ports';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import { KEY, post } from './pattern-update-post.test-support';
import {
  acceptResource,
  PU_ENTRY_ETAG,
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_UPDATE_PATH,
  puId,
  updateRow,
} from './pattern-update.test-support';

/**
 * CMS-03C-15 (BE03c 1268, 1304) refusal relay: typed reasons, version conflicts, producer pointers, idempotent replay and
 * the CORS preflight of the command route.
 */
describe('CMS-03C-15 pattern-update refusals', () => {
  it.each([
    [403, 'capability_missing', 'COMPOSITION_FORBIDDEN'],
    [409, 'revision_not_editable', 'COMPOSITION_VERSION_CONFLICT'],
    [409, 'diff_has_collisions', 'COMPOSITION_VERSION_CONFLICT'],
    [422, 'pattern_version_not_active', 'COMPOSITION_VALIDATION_FAILED'],
    [422, 'pattern_incompatible', 'COMPOSITION_VALIDATION_FAILED'],
    [422, 'nested_pattern_not_active', 'COMPOSITION_VALIDATION_FAILED'],
  ] as const)(
    'publishes %i %s with exactly its reasonCode',
    async (status, token, code) => {
      const harness = createPatternUpdateHarness({
        applyUpdate: async () =>
          failure(status, {
            reasonCode: token,
            expectedVersion: '1',
            currentVersion: '2',
            violations: [{ path: '/targetPatternVersion', code: 'invalid' }],
            secret: 'private',
          }),
      });
      const response = await post(harness);
      expect(response.status).toBe(status);
      const body = ApiErrorSchema.parse(await response.json());
      expect(body.code).toBe(code);
      expect(body.details).toEqual({ reasonCode: token });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
    },
  );

  it('a stale entry or instance version is the plain conflict with the version pair only', async () => {
    const harness = createPatternUpdateHarness({
      applyUpdate: async () =>
        failure(409, {
          expectedVersion: '7',
          currentVersion: '9',
          instanceId: puId(100),
          conflict: 'VERSION_MISMATCH',
        }),
    });
    const response = await post(harness);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'COMPOSITION_VERSION_CONFLICT',
      message:
        'COMPOSITION_VERSION_CONFLICT: composition operation rejected or unavailable.',
      requestId: PU_REQUEST_ID,
      details: { expectedVersion: '7', currentVersion: '9' },
    });
  });

  it('a refusal the producer pointed at the request is relayed as pointer-shaped violations', async () => {
    const harness = createPatternUpdateHarness({
      applyUpdate: async () =>
        failure(422, {
          violations: [
            {
              path: '/instances/0/choices',
              code: 'invalid',
              message: 'private prose',
            },
          ],
        }),
    });
    const response = await post(harness);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
      violations: [
        {
          path: '/instances/0/choices',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  const wrong =
    (
      overrides: Partial<ReturnType<typeof updateRow>>,
      count = 1,
    ): CmsPatternUpdateDependencies['applyUpdate'] =>
    async () => ({
      ok: true,
      value: {
        items: Array.from({ length: count }, (_, i) => updateRow(i, overrides)),
      },
      etag: PU_ENTRY_ETAG,
    });

  it.each([
    ['a row not pinned to the target', wrong({ patternVersion: 5 })],
    ['a row of another instance version', wrong({ version: '9' })],
    ['a detached row for an accept', wrong({ linkMode: 'detached' })],
    ['a draft row', wrong({ state: 'draft' })],
    [
      'the wrong number of rows',
      async () => ({
        ok: true as const,
        value: acceptResource(2),
        etag: PU_ENTRY_ETAG,
      }),
    ],
    [
      'the wrong entry version',
      async () => ({
        ok: true as const,
        value: acceptResource(1),
        etag: '"9"',
      }),
    ],
    [
      'no ETag',
      (async () => ({ ok: true, value: acceptResource(1) })) as never,
    ],
    [
      'a body outside the contract',
      (async () => ({
        ok: true,
        value: { items: [] },
        etag: PU_ENTRY_ETAG,
      })) as never,
    ],
    ['a non-envelope', (async () => 'nope') as never],
  ])(
    'an answer with %s is a local 502, never a body',
    async (_name, applyUpdate) => {
      const harness = createPatternUpdateHarness({ applyUpdate });
      const response = await post(harness);
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('a replayed key answers the stored body and ETag identically', async () => {
    const harness = createPatternUpdateHarness();
    const first = await post(harness);
    const second = await post(harness);
    expect(second.status).toBe(200);
    expect(second.headers.get('etag')).toBe(first.headers.get('etag'));
    expect(await second.json()).toEqual(await first.clone().json());
    expect(
      harness.applyUpdate.mock.calls.map(([input]) => input.idempotencyKey),
    ).toEqual([KEY, KEY]);
  });

  it('answers the preflight for an allowed human origin only', async () => {
    const harness = createPatternUpdateHarness();
    const allowed = await harness.request(PU_UPDATE_PATH, {
      method: 'OPTIONS',
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    const denied = await harness.request(PU_UPDATE_PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
  });
});
