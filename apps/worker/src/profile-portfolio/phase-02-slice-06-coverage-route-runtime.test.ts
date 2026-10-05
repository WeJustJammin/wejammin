import { describe, expect, it, vi } from 'vitest';

import { createProfilePortfolioRouteRuntime } from './route-runtime';
import { emphasisBodySchema } from './route-registration';
import {
  PARTY_ID,
  bindings,
  createProfilePortfolioApp,
  jsonRequest,
} from './phase-02-slice-06.test-support';

describe('Phase 2 Slice 06 direct route runtime coverage', () => {
  it('supports a command policy that does not require If-Match', async () => {
    const harness = createProfilePortfolioApp();
    const runtime = createProfilePortfolioRouteRuntime(harness.dependencies);
    const request = jsonRequest(
      'PUT',
      `/api/v1/profiles/${PARTY_ID}/emphasis`,
      { surface: 'public', defaultFilter: null, orderedRefs: [] },
      { ifMatch: null },
    );
    const context = {
      req: {
        raw: request,
        url: request.url,
        header: (name: string) => request.headers.get(name) ?? undefined,
      },
      env: bindings,
      get: vi.fn((name: string) =>
        name === 'requestId' || name === 'correlationId'
          ? '11111111-1111-4111-8111-111111111111'
          : undefined,
      ),
      header: vi.fn(),
      json: vi.fn(
        (body: Record<string, unknown>, status: number) =>
          new Response(JSON.stringify(body), { status }),
      ),
      set: vi.fn(),
      res: undefined,
    } as never;

    await expect(
      runtime.command(
        context,
        'PRF-PROF-04',
        'putEmphasis',
        { ok: true, value: { partyId: PARTY_ID } },
        emphasisBodySchema,
        false,
      ),
    ).resolves.toHaveProperty('status', 200);
  });
});
