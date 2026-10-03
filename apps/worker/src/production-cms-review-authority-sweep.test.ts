import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcManualReviewError } from './async-runtime-support';
import {
  CMS_REVIEW_AUTHORITY_SWEEP_LIMIT,
  runProductionCmsReviewAuthoritySweep,
} from './production-cms-review-authority-sweep';

const secret = 'sb_secret_review_authority_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://review-authority.example.supabase.co',
} as unknown as AsyncWorkerBindings;

const stubFetch = (respond: () => Response | Promise<Response>) => {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => respond());
  vi.stubGlobal('fetch', fetchImpl);
  return fetchImpl;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scheduled CMS review authority sweep', () => {
  it('[P2-S09-AC-1135] calls the protected platform_api RPC once with the bounded batch and logs only counts', async () => {
    const fetchImpl = stubFetch(() => Response.json({ invalidatedReviews: 3 }));
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await runProductionCmsReviewAuthoritySweep(bindings);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://review-authority.example.supabase.co/rest/v1/rpc/cms_sweep_expired_review_authority',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: secret,
    });
    expect(init?.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(String(init?.body))).toEqual({
      p_batch: CMS_REVIEW_AUTHORITY_SWEEP_LIMIT,
    });
    expect(CMS_REVIEW_AUTHORITY_SWEEP_LIMIT).toBe(64);
    const logged = JSON.stringify(consoleInfo.mock.calls);
    expect(logged).toContain('cms_review_authority_sweep.completed');
    expect(logged).toContain('"invalidatedReviews":3');
    expect(logged).not.toContain(secret);
  });

  it('[P2-S09-AC-1135] accepts an empty sweep', async () => {
    stubFetch(() => Response.json({ invalidatedReviews: 0 }));
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(
      runProductionCmsReviewAuthoritySweep(bindings),
    ).resolves.toBeUndefined();
  });

  it('[P2-S09-AC-1135] requests a retry without leaking the upstream body when the RPC is unavailable', async () => {
    stubFetch(() => new Response(`postgres-error:${secret}`, { status: 503 }));
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await expect(
      runProductionCmsReviewAuthoritySweep(bindings),
    ).rejects.toThrow('CMS review authority sweep requested retry');

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain('cms_review_authority_sweep.failed');
    expect(logged).toContain('DEPENDENCY_UNAVAILABLE');
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('postgres-error');
  });

  it.each([
    ['an array', []],
    ['an extra key', { invalidatedReviews: 0, extra: true }],
    ['a missing count', {}],
    ['a negative count', { invalidatedReviews: -1 }],
    ['a fractional count', { invalidatedReviews: 1.5 }],
    [
      'a count above the batch',
      { invalidatedReviews: CMS_REVIEW_AUTHORITY_SWEEP_LIMIT + 1 },
    ],
    ['a string count', { invalidatedReviews: '2' }],
  ])(
    '[P2-S09-AC-1135] requests a retry on a malformed response (%s)',
    async (_label, body) => {
      stubFetch(() => Response.json(body));
      const consoleError = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);

      await expect(
        runProductionCmsReviewAuthoritySweep(bindings),
      ).rejects.toThrow('CMS review authority sweep requested retry');
      expect(JSON.stringify(consoleError.mock.calls)).toContain(
        'DEPENDENCY_INVALID_RESPONSE',
      );
    },
  );

  it('[P2-S09-AC-1135] records a manual-review failure and rethrows it for a non-JSON body', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await expect(
      runProductionCmsReviewAuthoritySweep(bindings),
    ).rejects.toBeInstanceOf(AsyncRpcManualReviewError);
    expect(JSON.stringify(consoleError.mock.calls)).toContain(
      'cms_review_authority_sweep.manual_review_required',
    );
  });
});
