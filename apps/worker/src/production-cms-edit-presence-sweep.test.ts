import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcManualReviewError } from './async-runtime-support';
import {
  CMS_EDIT_PRESENCE_SWEEP_LIMIT,
  runProductionCmsEditPresenceSweep,
} from './production-cms-edit-presence-sweep';

const secret = 'sb_secret_edit_presence_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://edit-presence.example.supabase.co',
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

/*
 * BE03b EditPresence: the advisory lease is two minutes wide and "expires
 * without blocking another editor". FE03 keeps EditPresence physical-only, so
 * lapse is recorded by this service-role Worker sweep and never by a browser
 * command.
 */
describe('scheduled CMS edit-presence expiry sweep', () => {
  it('calls the protected platform_api RPC once with the bounded batch and logs only counts', async () => {
    const fetchImpl = stubFetch(() => Response.json({ expiredLeases: 3 }));
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await runProductionCmsEditPresenceSweep(bindings);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://edit-presence.example.supabase.co/rest/v1/rpc/cms_expire_edit_presence_leases',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: secret,
    });
    expect(init?.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(String(init?.body))).toEqual({
      p_batch: CMS_EDIT_PRESENCE_SWEEP_LIMIT,
    });
    expect(CMS_EDIT_PRESENCE_SWEEP_LIMIT).toBe(500);
    const logged = JSON.stringify(consoleInfo.mock.calls);
    expect(logged).toContain('cms_edit_presence_sweep.completed');
    expect(logged).toContain('"expiredLeases":3');
    expect(logged).not.toContain(secret);
  });

  it('[P2-S10-AC-051] publishes cms_presence_active when the sweep reports the active lease gauge', async () => {
    stubFetch(() => Response.json({ expiredLeases: 2, activeLeases: 17 }));
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await runProductionCmsEditPresenceSweep(bindings);

    const completed = consoleInfo.mock.calls
      .map(([line]) => line as { eventName: string; metrics?: object })
      .find((line) => line.eventName === 'cms_edit_presence_sweep.completed');
    expect(completed?.metrics).toEqual({
      expiredLeases: 2,
      cms_presence_active: 17,
    });
  });

  it('omits cms_presence_active when the RPC reports no gauge', async () => {
    stubFetch(() => Response.json({ expiredLeases: 2 }));
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await runProductionCmsEditPresenceSweep(bindings);

    const completed = consoleInfo.mock.calls
      .map(([line]) => line as { eventName: string; metrics?: object })
      .find((line) => line.eventName === 'cms_edit_presence_sweep.completed');
    expect(completed?.metrics).toEqual({ expiredLeases: 2 });
  });

  it('accepts an empty sweep and a full batch', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    stubFetch(() => Response.json({ expiredLeases: 0 }));
    await expect(
      runProductionCmsEditPresenceSweep(bindings),
    ).resolves.toBeUndefined();

    stubFetch(() =>
      Response.json({ expiredLeases: CMS_EDIT_PRESENCE_SWEEP_LIMIT }),
    );
    await expect(
      runProductionCmsEditPresenceSweep(bindings),
    ).resolves.toBeUndefined();
  });

  it('requests a retry without leaking the upstream body when the RPC is unavailable', async () => {
    stubFetch(() => new Response(`postgres-error:${secret}`, { status: 503 }));
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await expect(runProductionCmsEditPresenceSweep(bindings)).rejects.toThrow(
      'CMS edit-presence sweep requested retry',
    );

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain('cms_edit_presence_sweep.failed');
    expect(logged).toContain('DEPENDENCY_UNAVAILABLE');
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('postgres-error');
  });

  it.each([
    ['an array', []],
    ['an extra key', { expiredLeases: 0, extra: true }],
    ['a missing count', {}],
    ['a negative count', { expiredLeases: -1 }],
    ['a fractional count', { expiredLeases: 1.5 }],
    [
      'a count above the batch',
      { expiredLeases: CMS_EDIT_PRESENCE_SWEEP_LIMIT + 1 },
    ],
    ['a string count', { expiredLeases: '2' }],
    ['a negative gauge', { expiredLeases: 0, activeLeases: -1 }],
    ['a fractional gauge', { expiredLeases: 0, activeLeases: 1.5 }],
    ['a string gauge', { expiredLeases: 0, activeLeases: '4' }],
    ['the review-sweep shape', { invalidatedReviews: 0 }],
  ])('requests a retry on a malformed response (%s)', async (_label, body) => {
    stubFetch(() => Response.json(body));
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await expect(runProductionCmsEditPresenceSweep(bindings)).rejects.toThrow(
      'CMS edit-presence sweep requested retry',
    );
    expect(JSON.stringify(consoleError.mock.calls)).toContain(
      'DEPENDENCY_INVALID_RESPONSE',
    );
  });

  it('records a manual-review failure and rethrows it for a non-JSON body', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    await expect(
      runProductionCmsEditPresenceSweep(bindings),
    ).rejects.toBeInstanceOf(AsyncRpcManualReviewError);
    expect(JSON.stringify(consoleError.mock.calls)).toContain(
      'cms_edit_presence_sweep.manual_review_required',
    );
  });
});
