import {
  ApiErrorSchema,
  CompositionUpdateRequestSchema,
  CompositionUpdateResourceSchema,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { validUpdateResource } from './pattern-update-answers';
import { KEY, post } from './pattern-update-post.test-support';
import type { CmsPatternUpdateDependencies } from './pattern-update-ports';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import {
  PU_ENTRY_ETAG,
  PU_REQUEST_ID,
  puDiffPath,
  resolvedAcceptBody,
  resolvedAcceptResource,
  structuralDiffResource,
} from './pattern-update.test-support';

/* BE03c:1487: resolved detached trees and retired roots retain their prior pin.
 * These test real answer guards and route serialization, not SQL resolution. */
const outcomes = [
  ['structural yours, active detached', 'yours'],
  ['removed-root theirs, retired linked', 'theirs'],
] as const;

const wrongTargetPin = () => ({
  items: resolvedAcceptResource('theirs').items.map((row) => ({
    ...row,
    patternVersion: 2,
  })),
});

describe('DEC-193 Worker update answer binding', () => {
  it.each(outcomes)(
    '[DEC193-WU-01] accepts %s with its prior positive provenance pin',
    (_scenario, choice) => {
      const body = resolvedAcceptBody(choice);
      const value = resolvedAcceptResource(choice);
      expect(CompositionUpdateRequestSchema.parse(body)).toEqual(body);
      expect(CompositionUpdateResourceSchema.parse(value)).toEqual(value);
      expect(value.items[0]).toMatchObject({
        state: choice === 'yours' ? 'active' : 'retired',
        linkMode: choice === 'yours' ? 'detached' : 'linked',
        patternVersion: 1,
      });
      expect(validUpdateResource(value, PU_ENTRY_ETAG, body)).toBe(true);
    },
  );

  it('[DEC193-WU-02] refuses a retired root pinned to the target that removed it', () => {
    const value = wrongTargetPin();
    expect(CompositionUpdateResourceSchema.parse(value)).toEqual(value);
    expect(
      validUpdateResource(value, PU_ENTRY_ETAG, resolvedAcceptBody('theirs')),
    ).toBe(false);
  });
});

describe('DEC-193 Worker update routes', () => {
  it.each(outcomes)(
    '[DEC193-WU-03] serves %s with the exact body and committed ETag',
    async (_scenario, choice) => {
      const body = resolvedAcceptBody(choice);
      const value = resolvedAcceptResource(choice);
      const applyUpdate = vi.fn<CmsPatternUpdateDependencies['applyUpdate']>(
        async () => ({ ok: true, value, etag: PU_ENTRY_ETAG }),
      );
      const response = await post(createPatternUpdateHarness({ applyUpdate }), {
        body,
      });
      expect(applyUpdate).toHaveBeenCalledTimes(1);
      expect(applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ body, ifMatch: '7', idempotencyKey: KEY }),
        expect.any(AbortSignal),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe(PU_ENTRY_ETAG);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual(value);
    },
  );

  it('[DEC193-WU-04] hides a removed-root retirement with the erroneous target pin', async () => {
    const applyUpdate = vi.fn<CmsPatternUpdateDependencies['applyUpdate']>(
      async () => ({ ok: true, value: wrongTargetPin(), etag: PU_ENTRY_ETAG }),
    );
    const response = await post(createPatternUpdateHarness({ applyUpdate }), {
      body: resolvedAcceptBody('theirs'),
    });
    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      requestId: PU_REQUEST_ID,
      details: {},
    });
  });

  it('[DEC193-WU-05] preserves typed structural diff values, slotPath and newRoots', async () => {
    const value = structuralDiffResource();
    const readUpdateDiff = vi.fn<
      CmsPatternUpdateDependencies['readUpdateDiff']
    >(async () => ({ ok: true, value }));
    const response = await createPatternUpdateHarness({
      readUpdateDiff,
    }).request(puDiffPath());
    expect(readUpdateDiff).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(await response.json()).toEqual(value);
  });
});
