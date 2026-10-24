import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcManualReviewError } from './async-runtime-support';
import {
  CMS_TAXONOMY_MERGE_RECONCILE_RPC,
  runProductionCmsTaxonomyMergeReconcileSweep,
} from './cms-taxonomy-merge-reconcile-sweep';

/*
 * DEC-194 / BE03c "Merge convergence recovery": the scheduled tick of the bounded recovery sweep. One protected
 * platform_api RPC with no argument per tick; the answer is exactly `{ requested }` (a count, no ids); the database
 * owns every bound (15 minutes, 3 generations, one request per failed job), so this module only drives the call.
 */

const secret = 'sb_secret_taxonomy_merge_reconcile_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://merge-reconcile.example.supabase.co',
} as unknown as AsyncWorkerBindings;

const stubFetch = (respond: () => Response | Promise<Response>) => {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => respond());
  vi.stubGlobal('fetch', fetchImpl);
  return fetchImpl;
};

/** Everything the tick logged, as one string. */
const logs = () => {
  const sinks = [
    vi.spyOn(console, 'info').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  return () => JSON.stringify(sinks.flatMap((sink) => sink.mock.calls));
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scheduled CMS taxonomy merge convergence recovery sweep', () => {
  it('names the BE03c wrapper', () => {
    expect(CMS_TAXONOMY_MERGE_RECONCILE_RPC).toBe(
      'cms_reconcile_taxonomy_merge_converge',
    );
  });

  it('calls the protected platform_api RPC once with an empty argument object and logs only the count', async () => {
    const fetchImpl = stubFetch(() => Response.json({ requested: 3 }));
    const logged = logs();

    await runProductionCmsTaxonomyMergeReconcileSweep(bindings);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://merge-reconcile.example.supabase.co/rest/v1/rpc/cms_reconcile_taxonomy_merge_converge',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: secret,
    });
    expect(init?.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(String(init?.body))).toEqual({});
    expect(logged()).toContain('cms_taxonomy_merge_reconcile_sweep.completed');
    expect(logged()).toContain(
      '"cms_taxonomy_merge_reconcile_requested_total":3',
    );
    expect(logged()).not.toContain(secret);
  });

  it('accepts an empty sweep and logs a zero count', async () => {
    stubFetch(() => Response.json({ requested: 0 }));
    const logged = logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).resolves.toBeUndefined();
    expect(logged()).toContain(
      '"cms_taxonomy_merge_reconcile_requested_total":0',
    );
  });

  it('accepts the largest SQL integer', async () => {
    stubFetch(() => Response.json({ requested: 2_147_483_647 }));
    logs();
    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).resolves.toBeUndefined();
  });

  it('requests a retry without leaking the upstream body when the RPC is unavailable', async () => {
    stubFetch(() => new Response(`postgres-error:${secret}`, { status: 503 }));
    const logged = logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).rejects.toThrow('CMS taxonomy merge reconcile sweep requested retry');

    expect(logged()).toContain('cms_taxonomy_merge_reconcile_sweep.failed');
    expect(logged()).toContain('DEPENDENCY_UNAVAILABLE');
    expect(logged()).not.toContain(secret);
    expect(logged()).not.toContain('postgres-error');
  });

  it('treats the typed CONFLICT refusal as an unavailable dependency to retry', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: 'P0001', message: 'CONFLICT' }), {
          headers: { 'content-type': 'application/json' },
          status: 400,
        }),
    );
    const logged = logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).rejects.toThrow('CMS taxonomy merge reconcile sweep requested retry');
    expect(logged()).toContain('DEPENDENCY_UNAVAILABLE');
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an array holding the answer', [{ requested: 1 }]],
    ['a bare number', 1],
    ['a string', 'requested'],
    ['an empty object', {}],
    ['an extra key', { requested: 1, extra: true }],
    ['a job id beside the count', { requested: 1, jobIds: [] }],
    ['a renamed count', { count: 1 }],
    ['a null count', { requested: null }],
    ['a string count', { requested: '1' }],
    ['a boolean count', { requested: true }],
    ['a negative count', { requested: -1 }],
    ['a fractional count', { requested: 1.5 }],
    ['a count above the SQL integer range', { requested: 2_147_483_648 }],
    ['an exponent count beyond safe integers', { requested: 1e21 }],
  ])('requests a retry on a malformed response (%s)', async (_label, body) => {
    stubFetch(() => Response.json(body));
    const logged = logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).rejects.toThrow('CMS taxonomy merge reconcile sweep requested retry');
    expect(logged()).toContain('DEPENDENCY_INVALID_RESPONSE');
    expect(logged()).toContain('cms_taxonomy_merge_reconcile_sweep.failed');
  });

  it('records a manual-review failure and rethrows it for a non-JSON body', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));
    const logged = logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).rejects.toBeInstanceOf(AsyncRpcManualReviewError);
    expect(logged()).toContain(
      'cms_taxonomy_merge_reconcile_sweep.manual_review_required',
    );
    expect(logged()).toContain('MANUAL_REVIEW');
  });

  it('never calls the RPC twice in one tick, even when it answers a retryable failure', async () => {
    const fetchImpl = stubFetch(
      () => new Response('unavailable', { status: 503 }),
    );
    logs();

    await expect(
      runProductionCmsTaxonomyMergeReconcileSweep(bindings),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
