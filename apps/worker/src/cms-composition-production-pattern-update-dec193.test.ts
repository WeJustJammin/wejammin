import {
  ApiErrorSchema,
  CompositionUpdateResourceSchema,
  type CompositionUpdateRequest,
} from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPupHarness,
  sentOf,
} from './cms-composition-production-pattern-update.test-support';
import {
  PU_ENTRY_ETAG,
  PU_REQUEST_ID,
  PU_UPDATE_PATH,
  puDiffPath,
  resolvedAcceptBody,
  resolvedAcceptResource,
  structuralDiffResource,
} from './cms-composition/pattern-update.test-support';

/* Real production dependency and route; only the Supabase fetch is replaced.
 * No resolver, storage, registry or atomicity behavior is inferred here. */
const KEY = 'pattern-update-0001';
const outcomes = [
  ['structural yours, active detached', 'yours'],
  ['removed-root theirs, retired linked', 'theirs'],
] as const;

const post = (
  harness: ReturnType<typeof createPupHarness>,
  body: CompositionUpdateRequest,
) =>
  harness.request(PU_UPDATE_PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': KEY,
      'if-match': '"7"',
    },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DEC-193 production Worker update adapter', () => {
  it.each(outcomes)(
    '[DEC193-WUP-01] serves %s with prior provenance after one exact RPC',
    async (_scenario, choice) => {
      const body = resolvedAcceptBody(choice);
      const value = resolvedAcceptResource(choice);
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(value, { headers: { etag: PU_ENTRY_ETAG } }),
      );
      const response = await post(createPupHarness(fetchImpl), body);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const { url, init, p_request } = sentOf(fetchImpl);
      expect(url).toBe(
        'https://supabase.example.test/rest/v1/rpc/cms_apply_pattern_update',
      );
      expect(init.method).toBe('POST');
      const headers = new Headers(init.headers);
      expect(headers.get('x-operation-id')).toBe('CMS-03C-15');
      expect(headers.get('x-idempotency-key')).toBe(KEY);
      expect(headers.get('if-match')).toBe('"7"');
      expect(Object.keys(p_request).sort()).toEqual(
        [
          'action',
          'context',
          'correlationId',
          'expectedVersion',
          'idempotencyKey',
          'ifMatch',
          'instances',
          'targetPatternVersion',
        ].sort(),
      );
      expect(p_request).toMatchObject({
        ...body,
        ifMatch: '7',
        idempotencyKey: KEY,
        correlationId: PU_REQUEST_ID,
      });
      expect(p_request.instances).toEqual(body.instances);
      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe(PU_ENTRY_ETAG);
      expect(await response.json()).toEqual(value);
    },
  );

  it('[DEC193-WUP-02] refuses a removed-root retirement pinned to the target', async () => {
    const value = {
      items: resolvedAcceptResource('theirs').items.map((row) => ({
        ...row,
        patternVersion: 2,
      })),
    };
    expect(CompositionUpdateResourceSchema.parse(value)).toEqual(value);
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(value, { headers: { etag: PU_ENTRY_ETAG } }),
    );
    const response = await post(
      createPupHarness(fetchImpl),
      resolvedAcceptBody('theirs'),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      requestId: PU_REQUEST_ID,
      details: {},
    });
  });

  it('[DEC193-WUP-03] passes the exact typed structural diff through one read RPC', async () => {
    const value = structuralDiffResource();
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(value));
    const response = await createPupHarness(fetchImpl).request(puDiffPath());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sentOf(fetchImpl).url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_get_instance_update_diff',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(await response.json()).toEqual(value);
  });
});
