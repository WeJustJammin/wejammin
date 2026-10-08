import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncRpcManualReviewError } from './async-runtime-support';
import handler from './index';

const secret = 'sb_secret_scheduled_test_only';
const rawFailureMarker = 'postgres-error-body-must-not-leak';
const controller = {
  cron: '* * * * *',
  noRetry: vi.fn(),
  scheduledTime: 1_756_560_000_000,
} as never;

const productionBindings = () =>
  ({
    APP_ENVIRONMENT: 'production',
    APP_RELEASE: 'test-release',
    CLOUDFLARE_ACCOUNT_ID: 'cf-account-test',
    CLOUDFLARE_OBSERVABILITY_API_TOKEN: 'cf-observability-test-secret',
    CLOUDFLARE_PLATFORM_DLQ_ID: 'cf-dlq-test',
    PLATFORM_ALERT_EMAIL: { send: vi.fn(async () => undefined) },
    PLATFORM_JOBS: { send: vi.fn(async () => undefined) },
    SUPABASE_SECRET_KEY: secret,
    SUPABASE_URL: 'https://scheduled.example.supabase.co',
  }) as never;

const operationalResponse = (url: string): Response | undefined => {
  // The [P2-S09-AC-1135] reviewer-authority sweep shares every scheduled tick.
  if (url.includes('/rest/v1/rpc/cms_sweep_expired_review_authority'))
    return Response.json({ invalidatedReviews: 0 });
  // The BE03b advisory edit-presence expiry sweep also shares every tick.
  if (url.includes('/rest/v1/rpc/cms_expire_edit_presence_leases'))
    return Response.json({ expiredLeases: 0 });
  if (url.includes('/rest/v1/rpc/cms_get_operational_state_snapshot'))
    return Response.json({});
  if (url.endsWith('/graphql'))
    return Response.json({
      data: {
        viewer: {
          accounts: [
            { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
          ],
        },
      },
    });
  if (url.includes('/workers/observability/telemetry/query'))
    return Response.json({ result: { events: { events: [] } }, success: true });
  return undefined;
};

const asLogRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scheduled idempotency expiry sweep', () => {
  it('calls the service RPC once and does not block outbox or operational alerts', async () => {
    let releaseSweep!: (response: Response) => void;
    const sweepResponse = new Promise<Response>((resolve) => {
      releaseSweep = resolve;
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/claim_outbox_batch'))
          return Response.json([]);
        if (url.includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return sweepResponse;
        return operationalResponse(url) ?? Response.json({});
      });
    vi.stubGlobal('fetch', fetchImpl);
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const scheduled = handler.scheduled(controller, productionBindings(), {
      waitUntil: vi.fn(),
    } as never);

    await vi.waitFor(() => {
      expect(
        fetchImpl.mock.calls.filter(([input]) =>
          String(input).includes('/rest/v1/rpc/claim_outbox_batch'),
        ),
      ).toHaveLength(1);
      expect(
        fetchImpl.mock.calls.filter(([input]) =>
          String(input).includes('/workers/observability/telemetry/query'),
        ),
      ).toHaveLength(1);
    });

    const expiryCalls = fetchImpl.mock.calls.filter(([input]) =>
      String(input).includes('/rest/v1/rpc/idempotency_expiry_sweep'),
    );
    expect(expiryCalls).toHaveLength(1);
    const sweepInit = expiryCalls[0]?.[1];
    expect(sweepInit?.method).toBe('POST');
    expect(sweepInit?.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: secret,
    });
    expect(sweepInit?.headers).not.toHaveProperty('authorization');
    const requestBody = JSON.parse(String(sweepInit?.body)) as {
      p_correlation_id?: unknown;
      p_limit?: unknown;
    };
    expect(requestBody.p_limit).toBe(64);
    expect(requestBody.p_correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );

    releaseSweep(Response.json({ deletedCount: 7, hasMore: true }));
    await scheduled;

    const sweepLog = consoleInfo.mock.calls
      .map(([value]) => asLogRecord(value))
      .find((value) => value?.operation === 'idempotency_expiry_sweep');
    expect(sweepLog).toMatchObject({
      attributes: { hasMore: true, limit: 64 },
      correlationId: requestBody.p_correlation_id,
      eventName: 'idempotency_expiry_sweep.completed',
      metrics: { deletedCount: 7 },
      operation: 'idempotency_expiry_sweep',
      outcome: 'success',
    });
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(secret);
    expect(expiryCalls).toHaveLength(1);
  });

  it('logs only safe failure codes and fails the scheduled event without blocking other work', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/claim_outbox_batch'))
          return Response.json([]);
        if (url.includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return new Response(`${rawFailureMarker}:${secret}`, { status: 503 });
        return operationalResponse(url) ?? Response.json({});
      });
    vi.stubGlobal('fetch', fetchImpl);
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const rejection = await handler
      .scheduled(controller, productionBindings(), {
        waitUntil: vi.fn(),
      } as never)
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toMatchObject({
      message: 'Idempotency expiry sweep requested retry',
    });
    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes('/rest/v1/rpc/claim_outbox_batch'),
      ),
    ).toHaveLength(1);
    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes('/rest/v1/rpc/idempotency_expiry_sweep'),
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
        String(input).includes('/workers/observability/telemetry/query'),
      ),
    ).toHaveLength(1);

    const sweepLog = consoleInfo.mock.calls
      .map(([value]) => asLogRecord(value))
      .find((value) => value?.operation === 'idempotency_expiry_sweep');
    expect(sweepLog).toMatchObject({
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      eventName: 'idempotency_expiry_sweep.failed',
      operation: 'idempotency_expiry_sweep',
      outcome: 'retry',
      retryable: true,
      severity: 'ERROR',
    });
    const visibleOutput = JSON.stringify({
      rejection,
      logs: consoleInfo.mock.calls,
    });
    expect(visibleOutput).not.toContain(secret);
    expect(visibleOutput).not.toContain('cf-observability-test-secret');
    expect(visibleOutput).not.toContain(rawFailureMarker);
  });

  it('records malformed RPC responses for manual review without retrying', async () => {
    const malformedResponseBody = `${rawFailureMarker}:${secret}`;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/claim_outbox_batch'))
          return Response.json([]);
        if (url.includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return new Response(malformedResponseBody, { status: 200 });
        return operationalResponse(url) ?? Response.json({});
      });
    vi.stubGlobal('fetch', fetchImpl);
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const rejection = await handler
      .scheduled(controller, productionBindings(), {
        waitUntil: vi.fn(),
      } as never)
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toBeInstanceOf(AsyncRpcManualReviewError);
    expect(rejection).toMatchObject({
      code: 'MANUAL_REVIEW',
      disposition: 'manual_review',
      message: 'Supabase RPC response requires manual review.',
      name: 'AsyncRpcManualReviewError',
      reason: 'malformed_json',
      retryable: false,
    });
    const sweepLog = consoleInfo.mock.calls
      .map(([value]) => asLogRecord(value))
      .find((value) => value?.operation === 'idempotency_expiry_sweep');
    expect(sweepLog).toMatchObject({
      attributes: { reason: 'malformed_json' },
      errorCode: 'MANUAL_REVIEW',
      eventName: 'idempotency_expiry_sweep.manual_review_required',
      operation: 'idempotency_expiry_sweep',
      outcome: 'failure',
      retryable: false,
      severity: 'ERROR',
    });
    const visibleOutput = JSON.stringify({
      rejection: String(rejection),
      logs: consoleInfo.mock.calls,
    });
    expect(visibleOutput).not.toContain(secret);
    expect(visibleOutput).not.toContain(malformedResponseBody);
  });

  it('rejects a valid RPC result above the bounded batch limit', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/claim_outbox_batch'))
          return Response.json([]);
        if (url.includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return Response.json({ deletedCount: 65, hasMore: true });
        return operationalResponse(url) ?? Response.json({});
      });
    vi.stubGlobal('fetch', fetchImpl);
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const rejection = await handler
      .scheduled(controller, productionBindings(), {
        waitUntil: vi.fn(),
      } as never)
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toMatchObject({
      message: 'Idempotency expiry sweep requested retry',
    });
    const sweepLog = consoleInfo.mock.calls
      .map(([value]) => asLogRecord(value))
      .find((value) => value?.operation === 'idempotency_expiry_sweep');
    expect(sweepLog).toMatchObject({
      errorCode: 'DEPENDENCY_INVALID_RESPONSE',
      eventName: 'idempotency_expiry_sweep.failed',
      operation: 'idempotency_expiry_sweep',
      outcome: 'retry',
      retryable: true,
      severity: 'ERROR',
    });
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(
      'deletedCount',
    );
  });

  it('rejects a successful RPC response that violates the strict result shape', async () => {
    const extraField = 'response-field-must-not-be-logged';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/claim_outbox_batch'))
          return Response.json([]);
        if (url.includes('/rest/v1/rpc/idempotency_expiry_sweep'))
          return Response.json({ deletedCount: 1, hasMore: false, extraField });
        return operationalResponse(url) ?? Response.json({});
      });
    vi.stubGlobal('fetch', fetchImpl);
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const rejection = await handler
      .scheduled(controller, productionBindings(), {
        waitUntil: vi.fn(),
      } as never)
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toMatchObject({
      message: 'Idempotency expiry sweep requested retry',
    });
    const sweepLog = consoleInfo.mock.calls
      .map(([value]) => asLogRecord(value))
      .find((value) => value?.operation === 'idempotency_expiry_sweep');
    expect(sweepLog).toMatchObject({
      errorCode: 'DEPENDENCY_INVALID_RESPONSE',
      eventName: 'idempotency_expiry_sweep.failed',
      operation: 'idempotency_expiry_sweep',
      outcome: 'retry',
      retryable: true,
      severity: 'ERROR',
    });
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(extraField);
  });
});
