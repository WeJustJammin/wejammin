import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProductionAsyncEntrypoint, type WorkerBindings } from './index';
import handler from './index';

const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'a2ec4803',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Worker scheduled operational boundaries', () => {
  it('exports validated queue and wired scheduled production entrypoints', async () => {
    const retry = vi.fn();
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        if (String(input).includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return Response.json({ deletedCount: 0, hasMore: false });
        if (
          String(input).includes(
            '/rest/v1/rpc/cms_sweep_expired_review_authority',
          )
        )
          return Response.json({ invalidatedReviews: 0 });
        if (
          String(input).includes('/rest/v1/rpc/cms_expire_edit_presence_leases')
        )
          return Response.json({ expiredLeases: 0 });
        return Response.json([], { status: 200 });
      },
    );
    vi.stubGlobal('fetch', fetchImpl);
    const asyncBindings = {
      ...bindings,
      PLATFORM_JOBS: { send: vi.fn() },
    } as never;
    const executionContext = { waitUntil: vi.fn() } as never;

    await handler.queue(
      {
        messages: [
          { ack: vi.fn(), attempts: 1, body: {}, id: 'message-1', retry },
        ],
        queue: 'platform-jobs-staging',
      } as never,
      asyncBindings,
      executionContext,
    );
    expect(retry).toHaveBeenCalledOnce();
    await handler.scheduled(
      { cron: '* * * * *', scheduledTime: 1_756_560_000_000 } as never,
      asyncBindings,
      executionContext,
    );
    // The outbox sweep, the idempotency expiry sweep, the [P2-S09-AC-1135]
    // reviewer-authority expiry sweep, the BE03b advisory edit-presence expiry
    // sweep, the Slice 11 publication schedule claim (CMS-03B-20, nothing due
    // here) and the [P2-S09-AC-908] reconciling-age gauge sample each make one
    // protected RPC per tick.
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(
      fetchImpl.mock.calls
        .map(([input]) => String(input).split('/rest/v1/rpc/')[1])
        .sort(),
    ).toEqual([
      'auth_mfa_reconciling_age',
      'claim_outbox_batch',
      'cms_claim_due_publication_schedules',
      'cms_expire_edit_presence_leases',
      'cms_sweep_expired_review_authority',
      'idempotency_expiry_sweep',
    ]);
    expect(createProductionAsyncEntrypoint(fetchImpl)).toHaveProperty(
      'scheduled',
      expect.any(Function),
    );
  });

  it('attempts production operational alerts when the outbox sweep requests retry', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const target = String(input);
        if (target.includes('/rest/v1/rpc/claim_outbox_batch')) {
          return new Response('outbox unavailable', { status: 503 });
        }
        if (target.includes('/rest/v1/rpc/idempotency_expiry_sweep')) {
          return Response.json({ deletedCount: 0, hasMore: false });
        }
        if (
          target.includes('/rest/v1/rpc/cms_get_operational_state_snapshot')
        ) {
          return Response.json({});
        }
        if (target.endsWith('/graphql')) {
          return Response.json({
            data: {
              viewer: {
                accounts: [
                  { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
                ],
              },
            },
          });
        }
        if (target.includes('/workers/observability/telemetry/query')) {
          return Response.json({
            result: { events: { events: [] } },
            success: true,
          });
        }
        throw new Error(`unexpected URL: ${target}`);
      });
    vi.stubGlobal('fetch', fetchImpl);
    const asyncBindings = {
      ...bindings,
      APP_ENVIRONMENT: 'production',
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      CLOUDFLARE_OBSERVABILITY_API_TOKEN: 'observability-token',
      CLOUDFLARE_PLATFORM_DLQ_ID: 'dlq-id',
      PLATFORM_ALERT_EMAIL: { send: vi.fn() },
      PLATFORM_JOBS: { send: vi.fn() },
    } as never;

    await expect(
      handler.scheduled(
        { cron: '* * * * *', scheduledTime: 1_756_560_000_000 } as never,
        asyncBindings,
        { waitUntil: vi.fn() } as never,
      ),
    ).rejects.toThrow('Outbox sweep requested retry');

    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes('/workers/observability/telemetry/query'),
      ),
    ).toHaveLength(1);
  });

  it('propagates an operational alert failure after a completed sweep without double invocation', async () => {
    let releaseSweep!: (response: Response) => void;
    const sweepResponse = new Promise<Response>((resolve) => {
      releaseSweep = resolve;
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const target = String(input);
        if (target.includes('/rest/v1/rpc/claim_outbox_batch')) {
          return sweepResponse;
        }
        if (target.includes('/rest/v1/rpc/idempotency_expiry_sweep')) {
          return Response.json({ deletedCount: 0, hasMore: false });
        }
        if (
          target.includes('/rest/v1/rpc/cms_sweep_expired_review_authority')
        ) {
          return Response.json({ invalidatedReviews: 0 });
        }
        if (target.includes('/rest/v1/rpc/cms_expire_edit_presence_leases')) {
          return Response.json({ expiredLeases: 0 });
        }
        if (
          target.includes('/rest/v1/rpc/cms_claim_due_publication_schedules')
        ) {
          return Response.json([]);
        }
        if (
          target.includes('/rest/v1/rpc/cms_get_operational_state_snapshot')
        ) {
          return new Response('alert unavailable', { status: 503 });
        }
        throw new Error(`unexpected URL: ${target}`);
      });
    vi.stubGlobal('fetch', fetchImpl);
    const asyncBindings = {
      ...bindings,
      APP_ENVIRONMENT: 'production',
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      CLOUDFLARE_OBSERVABILITY_API_TOKEN: 'observability-token',
      CLOUDFLARE_PLATFORM_DLQ_ID: 'dlq-id',
      PLATFORM_ALERT_EMAIL: { send: vi.fn() },
      PLATFORM_JOBS: { send: vi.fn() },
    } as never;

    const scheduled = handler.scheduled(
      { cron: '* * * * *', scheduledTime: 1_756_560_000_000 } as never,
      asyncBindings,
      { waitUntil: vi.fn() } as never,
    );

    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes(
          '/rest/v1/rpc/cms_get_operational_state_snapshot',
        ),
      ),
    ).toHaveLength(1);

    releaseSweep(Response.json([]));
    await expect(scheduled).rejects.toThrow(
      'Operational provider request failed (HTTP 503)',
    );

    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes('/rest/v1/rpc/claim_outbox_batch'),
      ),
    ).toHaveLength(1);
    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes(
          '/rest/v1/rpc/cms_get_operational_state_snapshot',
        ),
      ),
    ).toHaveLength(1);
    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes('/rest/v1/rpc/auth_mfa_reconciling_age'),
      ),
    ).toHaveLength(1);
    // The six earlier jobs plus the Slice 11 publication schedule claim.
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });
});
