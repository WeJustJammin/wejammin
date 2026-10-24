import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsPatternInstanceDependencies } from './cms-composition-production-pattern';
import { environment } from './cms-editorial-production.test-support';
import { createCmsPatternInstanceApp } from './cms-composition/pattern-instance-routes';
import {
  httpPlacementRequest,
  productionPlacementInput,
} from './cms-composition/pattern-placement-dependencies.test-support';
import { PLACEMENT_ORIGIN } from './cms-composition/pattern-placement.test-support';

/**
 * CMS-03C-02 composed seam (review-hardening-3 finding 5): a private-RPC fetch double answers a platform
 * raise, the real production adapter maps it, and the real route publishes it. No layer is handed its
 * neighbour's exact shape, so a drift between adapter output and route filter fails here.
 */
const rpcRaise = (token: string, detail: string | null) =>
  Response.json(
    { code: 'P0001', message: token, details: detail, hint: null },
    { status: 400 },
  );

const answer = async (raise: Response) => {
  const rpc = vi.fn(async () => raise);
  const dependencies = createProductionCmsPatternInstanceDependencies({
    environment,
    fetchImpl: rpc as unknown as typeof fetch,
    humanOrigins: [PLACEMENT_ORIGIN],
    // The shared limiter is a separate service; the seam under test is RPC raise to wire answer.
    rateLimit: async (input) => ({
      ok: true,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000,
      },
    }),
    resolveSession: async () => ({
      ok: true,
      value: productionPlacementInput().session,
    }),
  });
  const response = await createCmsPatternInstanceApp(dependencies).request(
    httpPlacementRequest(),
  );
  return {
    rpc,
    response,
    body: (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    },
  };
};

describe('CMS-03C-02 fetch double to production adapter to route', () => {
  it('publishes revision_not_editable as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode (FE03 1112)', async () => {
    const { rpc, response, body } = await answer(
      rpcRaise('revision_not_editable', '["/revisionId"]'),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(409);
    expect(body.code).toBe('COMPOSITION_VERSION_CONFLICT');
    expect(body.details).toEqual({ reasonCode: 'revision_not_editable' });
    expect(
      CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
    ).toBe(true);
  });

  it('publishes pattern_nodes_exceeded as 422 COMPOSITION_VALIDATION_FAILED at /patternId with no reasonCode (BE03c 378)', async () => {
    const { response, body } = await answer(
      rpcRaise('pattern_nodes_exceeded', '["/secret-pointer"]'),
    );
    expect(response.status).toBe(422);
    expect(body.code).toBe('COMPOSITION_VALIDATION_FAILED');
    expect(body.details).toEqual({
      violations: [
        {
          path: '/patternId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('secret-pointer');
  });
});
