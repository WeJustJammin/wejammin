import { describe, expect, it, vi } from 'vitest';

import { createProductionOperationalAlertDependencies } from './operational-alert-production';

const environment = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'release-sha',
  CMS_HUMAN_ORIGINS: 'https://app.wejamm.in',
  CMS_RELEASE_ORIGINS: 'https://release.wejamm.in',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_URL: 'https://project.supabase.co',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_OBSERVABILITY_API_TOKEN: 'observability-token',
  CLOUDFLARE_PLATFORM_DLQ_ID: 'dlq-id',
  PLATFORM_ALERT_EMAIL: { send: vi.fn().mockResolvedValue({}) },
} as const;

const runInput = {
  environment: 'production',
  release: 'release-sha',
  scheduledAt: '2026-09-05T12:00:00.000Z',
} as const;

const providerMessageId = 'cloudflare-email-message-0001' as const;

const nativeFetch = (input: {
  database?: unknown;
  logs?: unknown;
  queue?: unknown;
}) =>
  vi.fn<typeof fetch>().mockImplementation((url) => {
    const target = String(url);
    if (target.includes('cms_get_operational_state_snapshot'))
      return Promise.resolve(
        Response.json(input.database === undefined ? {} : input.database),
      );
    if (target.includes('/workers/observability/telemetry/query'))
      return Promise.resolve(
        Response.json(
          input.logs === undefined
            ? { result: { events: { events: [] } } }
            : input.logs,
        ),
      );
    if (target.endsWith('/graphql'))
      return Promise.resolve(
        Response.json(input.queue === undefined ? {} : input.queue),
      );
    throw new Error(`unexpected URL: ${target}`);
  });

describe('production operational alert dependencies', () => {
  it('loads bounded native measurements and keeps tokens out of requests and receipts', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((url) => {
      const target = String(url);
      if (target.includes('cms_get_operational_state_snapshot'))
        return Promise.resolve(
          Response.json({
            activationBlockedMs: 1,
            outboxAgeMs: 2,
            reviewOpenAgeMs: 700_000_000,
          }),
        );
      if (target.includes('/workers/observability/telemetry/query'))
        return Promise.resolve(
          Response.json({ result: { events: { events: [] } } }),
        );
      if (target.endsWith('/graphql'))
        return Promise.resolve(
          Response.json({
            data: {
              viewer: {
                accounts: [
                  { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
                ],
              },
            },
          }),
        );
      throw new Error(`unexpected URL: ${target}`);
    });
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      fetchImpl,
    );

    await expect(dependencies.loadSnapshot(runInput)).resolves.toMatchObject({
      activationBlockedMs: 1,
      conflictWindowMs: 300_000,
      dlqDepth: 0,
      outboxAgeMs: 2,
      reviewOpenAgeMs: 700_000_000,
    });

    const requests = fetchImpl.mock.calls.map(([url, init]) => ({
      body: String(init?.body ?? ''),
      headers: JSON.stringify(init?.headers ?? {}),
      url: String(url),
    }));
    expect(
      requests.find((request) => request.url.includes('supabase'))?.headers,
    ).not.toContain('Bearer sb_secret_test');
    expect(
      requests.find((request) => request.url.includes('telemetry/query'))
        ?.headers,
    ).toContain('Bearer observability-token');
    expect(
      JSON.parse(
        requests.find((request) => request.url.includes('telemetry/query'))
          ?.body ?? '{}',
      ),
    ).toMatchObject({ parameters: { limit: 2_000 } });
    const queueRequest = JSON.parse(
      requests.find((request) => request.url.endsWith('/graphql'))?.body ??
        '{}',
    ) as { query?: string; variables?: Record<string, unknown> };
    expect(queueRequest.query).toContain('queueBacklogAdaptiveGroups(limit: 1');
    expect(queueRequest.query).not.toContain('orderBy');
    expect(queueRequest.variables).toMatchObject({ queueId: 'dlq-id' });
    expect(JSON.stringify(requests)).not.toContain('admin.wejammin@gmail.com');
  });

  it('accepts the documented Queue Analytics success envelope with null errors', async () => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({
        logs: { result: { events: { events: [] } }, success: true },
        queue: {
          data: {
            viewer: {
              accounts: [
                { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
              ],
            },
          },
          errors: null,
        },
      }),
    );

    await expect(dependencies.loadSnapshot(runInput)).resolves.toMatchObject({
      dlqDepth: 0,
    });
  });

  it('reports a safe HTTP status when a provider rejects a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((url) => {
      const target = String(url);
      if (target.includes('cms_get_operational_state_snapshot'))
        return Promise.resolve(Response.json({}));
      if (target.endsWith('/graphql'))
        return Promise.resolve(Response.json({}));
      if (target.includes('/workers/observability/telemetry/query'))
        return Promise.resolve(
          Response.json(
            { errors: [{ message: 'sensitive provider detail' }] },
            { status: 400 },
          ),
        );
      throw new Error(`unexpected URL: ${target}`);
    });
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      fetchImpl,
    );

    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      'Operational provider request failed (HTTP 400)',
    );
  });

  it('claims, sends a redacted platform.on_call email, and hashes completion evidence server-side', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          claimId: '019c0000-0000-7000-8000-000000000001',
          claimed: true,
        }),
      )
      .mockResolvedValueOnce(Response.json(true));
    const bindings = {
      ...environment,
      PLATFORM_ALERT_EMAIL: {
        send: vi.fn().mockResolvedValue({ messageId: providerMessageId }),
      },
    };
    const dependencies = createProductionOperationalAlertDependencies(
      bindings,
      fetchImpl,
      { randomUuid: () => '019c0000-0000-7000-8000-000000000002' },
    );
    const alert = {
      code: 'dlq_nonempty',
      observed: 1,
      route: 'platform.on_call',
      runbook: 'content-schema-registry',
      threshold: 0,
    } as const;
    const input = runInput;

    const claim = await dependencies.claim(alert, input);
    expect(claim).toMatchObject({ claimed: true });
    if (!claim.claimed) throw new Error('expected claim');
    const receipt = await dependencies.deliver({
      alert,
      claimId: claim.claimId,
      environment: 'production',
      redacted: true,
      release: 'release-sha',
      scheduledAt: input.scheduledAt,
    });
    expect(receipt).toEqual({
      receiptId: '019c0000-0000-7000-8000-000000000002',
      providerMessageId,
    });
    await dependencies.complete({
      alert,
      claimId: claim.claimId,
      claimToken: claim.claimToken,
      deliveredAt: '2026-09-05T12:00:01.000Z',
      receiptId: receipt.receiptId,
      providerMessageId: receipt.providerMessageId,
    });

    const sent = bindings.PLATFORM_ALERT_EMAIL.send.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      from: 'platform.on-call@alerts.wejamm.in',
      subject: '[WeJammin] dlq_nonempty',
      to: 'admin.wejammin@gmail.com',
    });
    expect(sent).not.toHaveProperty('headers');
    expect(JSON.stringify(sent)).not.toMatch(
      /observability-token|sb_secret_test|authorization|cookie|requestBody/iu,
    );
    expect(fetchImpl.mock.calls[1]?.[1]?.body).not.toContain(
      'admin.wejammin@gmail.com',
    );
    expect(fetchImpl.mock.calls[1]?.[1]?.body).toContain(providerMessageId);
  });

  it.each([
    undefined,
    null,
    {},
    { messageId: '' },
    { messageId: 'contains space' },
    { messageId: 'contains\nnewline' },
    { messageId: `<${'x'.repeat(509)}@c>` },
  ])('rejects a malformed provider send result: %j', async (result) => {
    const dependencies = createProductionOperationalAlertDependencies(
      {
        ...environment,
        PLATFORM_ALERT_EMAIL: { send: vi.fn().mockResolvedValue(result) },
      },
      vi.fn<typeof fetch>(),
    );

    await expect(
      dependencies.deliver({
        alert: {
          code: 'dlq_nonempty',
          observed: 1,
          route: 'platform.on_call',
          runbook: 'content-schema-registry',
          threshold: 0,
        },
        claimId: '019c0000-0000-7000-8000-000000000001',
        environment: 'production',
        redacted: true,
        release: 'release-sha',
        scheduledAt: runInput.scheduledAt,
      }),
    ).rejects.toThrow('Invalid operational alert delivery response');
  });

  it('redacts provider send failures', async () => {
    const providerFailure = new Error(
      'provider-private detail token=secret-provider-token',
    );
    const dependencies = createProductionOperationalAlertDependencies({
      ...environment,
      PLATFORM_ALERT_EMAIL: {
        send: vi.fn().mockRejectedValue(providerFailure),
      },
    });

    const rejection = dependencies.deliver({
      alert: {
        code: 'dlq_nonempty',
        observed: 1,
        route: 'platform.on_call',
        runbook: 'content-schema-registry',
        threshold: 0,
      },
      claimId: '019c0000-0000-7000-8000-000000000001',
      environment: 'production',
      redacted: true,
      release: 'release-sha',
      scheduledAt: runInput.scheduledAt,
    });

    await expect(rejection).rejects.toThrow(
      'Operational alert delivery failed',
    );
    await expect(rejection).rejects.not.toThrow(
      /provider-private|secret-provider-token/u,
    );
  });

  it.each([
    new Response('{}', { status: 503 }),
    new Response('{}', { headers: { 'content-length': '2000001' } }),
    new Response('x'.repeat(2_000_001)),
  ])('rejects failed or oversized provider responses', async (response) => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      vi.fn<typeof fetch>().mockResolvedValue(response),
    );
    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      /provider request failed|response too large/u,
    );
  });

  it.each([undefined, '1'])(
    'bounds provider streams when content-length is %s or lies low',
    async (contentLength) => {
      let pulls = 0;
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          if (pulls > 2) return new Promise<never>(() => undefined);
          controller.enqueue(new Uint8Array(1_000_001));
        },
        cancel() {
          cancelled = true;
        },
      });
      const headers = new Headers({ 'content-type': 'application/json' });
      if (contentLength !== undefined)
        headers.set('content-length', contentLength);
      const dependencies = createProductionOperationalAlertDependencies(
        environment,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(stream, { headers })),
        { providerTimeoutMs: 100 },
      );

      await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
        'Operational provider response too large',
      );
      expect(pulls).toBeLessThanOrEqual(3);
      expect(cancelled).toBe(true);
    },
    1_000,
  );

  it('aborts a provider response whose body stalls before the absolute deadline', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise<never>(() => undefined);
      },
      cancel() {
        cancelled = true;
      },
    });
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(stream, {
          headers: { 'content-type': 'application/json' },
        }),
      ),
      { providerTimeoutMs: 20 },
    );

    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      'Operational provider request timed out',
    );
    expect(cancelled).toBe(true);
  }, 1_000);

  it.each([new Uint8Array([0xff]), new TextEncoder().encode('{broken')])(
    'rejects malformed provider response bodies without raw parser details',
    async (body) => {
      const dependencies = createProductionOperationalAlertDependencies(
        environment,
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(body, {
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );

      await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
        'Invalid operational provider response',
      );
    },
  );

  it('redacts provider fetch failures', async () => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new Error('provider-private token=secret-provider-token'),
        ),
    );

    const rejection = dependencies.loadSnapshot(runInput);
    await expect(rejection).rejects.toThrow(
      'Operational provider request failed',
    );
    await expect(rejection).rejects.not.toThrow(
      /provider-private|secret-provider-token/u,
    );
  });

  it.each([
    null,
    { result: { events: { events: [] } }, success: false },
    { result: { events: { events: [] } }, success: 'true' },
    { success: true, result: null },
    { success: true, result: { events: null } },
    { success: true, result: { events: { events: null } } },
  ])('rejects malformed Workers Logs payloads', async (logs) => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({
        logs,
        queue: {
          data: {
            viewer: {
              accounts: [
                { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
              ],
            },
          },
        },
      }),
    );
    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      'Invalid Workers Logs response',
    );
  });

  it.each([{ result: {} }, { result: { events: {} } }])(
    'accepts an empty Workers Logs result when optional event fields are omitted',
    async (logs) => {
      const dependencies = createProductionOperationalAlertDependencies(
        environment,
        nativeFetch({
          logs,
          queue: {
            data: {
              viewer: {
                accounts: [
                  { queueBacklogAdaptiveGroups: [{ avg: { messages: 0 } }] },
                ],
              },
            },
          },
        }),
      );

      await expect(dependencies.loadSnapshot(runInput)).resolves.toMatchObject({
        dlqDepth: 0,
      });
    },
  );

  it.each([
    null,
    {},
    { data: {} },
    { data: { viewer: {} } },
    { data: { viewer: { accounts: [] } } },
    { data: { viewer: { accounts: [{}] } } },
    {
      data: {
        viewer: { accounts: [{ queueBacklogAdaptiveGroups: [] }] },
      },
    },
    {
      data: {
        viewer: { accounts: [{ queueBacklogAdaptiveGroups: [{}] }] },
      },
    },
    {
      data: {
        viewer: {
          accounts: [
            { queueBacklogAdaptiveGroups: [{ avg: { messages: 'bad' } }] },
          ],
        },
      },
    },
    {
      data: {
        viewer: {
          accounts: [
            { queueBacklogAdaptiveGroups: [{ avg: { messages: NaN } }] },
          ],
        },
      },
    },
  ])('omits an unavailable Queue backlog measurement', async (queue) => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({
        logs: {
          result: { events: { events: [null, {}] } },
          success: true,
        },
        queue,
      }),
    );
    await expect(
      dependencies.loadSnapshot(runInput),
    ).resolves.not.toHaveProperty('dlqDepth');
  });

  it('normalizes a negative Queue backlog and omits absent database ages', async () => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({
        queue: {
          data: {
            viewer: {
              accounts: [
                { queueBacklogAdaptiveGroups: [{ avg: { messages: -1 } }] },
              ],
            },
          },
        },
      }),
    );
    await expect(dependencies.loadSnapshot(runInput)).resolves.toMatchObject({
      dlqDepth: 0,
    });
  });

  it('fails closed when Queue Analytics returns GraphQL errors', async () => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({
        queue: {
          data: { viewer: { accounts: [] } },
          errors: [{ message: 'invalid aggregation ordering' }],
        },
      }),
    );

    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      'Invalid Queue analytics response',
    );
  });

  it('rejects a non-object database snapshot', async () => {
    const dependencies = createProductionOperationalAlertDependencies(
      environment,
      nativeFetch({ database: [] }),
    );
    await expect(dependencies.loadSnapshot(runInput)).rejects.toThrow(
      'Invalid operational snapshot',
    );
  });

  it('rejects invalid claims and unsuccessful completion acknowledgements', async () => {
    const alert = {
      code: 'dlq_nonempty',
      observed: 1,
      route: 'platform.on_call',
      runbook: 'content-schema-registry',
      threshold: 0,
    } as const;
    const unclaimed = createProductionOperationalAlertDependencies(
      environment,
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(null)),
    );
    await expect(unclaimed.claim(alert, runInput)).resolves.toEqual({
      claimed: false,
    });

    const malformed = createProductionOperationalAlertDependencies(
      environment,
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ claimed: true }))
        .mockResolvedValueOnce(Response.json(false)),
      { randomUuid: () => '019c0000-0000-7000-8000-000000000002' },
    );
    await expect(malformed.claim(alert, runInput)).rejects.toThrow(
      'Invalid operational alert claim',
    );
    await expect(
      malformed.complete({
        alert,
        claimId: '019c0000-0000-7000-8000-000000000001',
        claimToken: '019c0000-0000-7000-8000-000000000002',
        deliveredAt: '2026-09-05T12:00:01.000Z',
        receiptId: '019c0000-0000-7000-8000-000000000003',
        providerMessageId,
      }),
    ).rejects.toThrow('Operational alert completion failed');
  });
});
