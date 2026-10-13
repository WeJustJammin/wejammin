import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@wejammin/observability/logging';

import {
  blockingInput,
  cleanInput,
} from './cms-editorial/a11y-structural/a11y-structural.test-support';
import type { CmsEditorialQualityGateInput } from './cms-editorial/types';
import {
  QUALITY_GATE_MAX_RESPONSE_BYTES,
  loadQualityGateInput,
  logQualityGateRun,
} from './cms-editorial-production-quality-gate';
import {
  CORRELATION_ID,
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  REVISION_ID,
  USER_ID,
  compose,
  environment,
  json,
} from './cms-editorial-production.test-support';
import { raised } from './cms-editorial-production-workflow.test-support';

/*
 * The Worker side of quality_gate_evaluate: a read-only service RPC load, a
 * fresh checker run inside its 2,000 ms budget, and verified evidence or none.
 * A hidden, absent or unreadable revision is one indistinguishable outcome.
 */

const configuration = {
  baseUrl: 'https://supabase.example.test',
  secret: environment.SUPABASE_SECRET_KEY,
  maxResponseBytes: 256 * 1024,
  now: () => Date.parse('2026-10-08T12:00:00Z'),
};
const identity = {
  operationId: 'CMS-03B-05',
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
};
const load = (fetchImpl: typeof fetch, signal = new AbortController().signal) =>
  loadQualityGateInput(
    { ...configuration, fetchImpl },
    { phase: 'submit', revisionId: REVISION_ID },
    identity,
    signal,
  );
const edge = (response: () => Response | Promise<Response>) =>
  vi.fn(async () => response()) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;

describe('loading the checker input', () => {
  it('posts the server-built request to the read-only RPC and returns the input', async () => {
    const fetchImpl = edge(() => json(cleanInput()));
    const result = await load(fetchImpl);
    expect(result).toEqual({ ok: true, input: cleanInput() });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_load_quality_gate_input',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      'X-Operation-Id': 'CMS-03B-05',
      'X-Request-Id': REQUEST_ID,
      'X-Correlation-Id': CORRELATION_ID,
    });
    expect(JSON.parse(String(init.body))).toEqual({
      p_request: { phase: 'submit', revisionId: REVISION_ID },
    });
  });

  it('treats a hidden, absent or rejected revision as one unreadable target', async () => {
    for (const response of [
      () => raised('NOT_FOUND'),
      () => raised('capability_missing'),
      () => json({ code: 'PGRST', message: 'x' }, 400),
      () => json({}, 404),
    ])
      expect(await load(edge(response))).toEqual({
        ok: false,
        retryable: false,
        reason: 'target_unreadable',
      });
  });

  it('treats a database or transport fault as a retryable dependency outage', async () => {
    for (const response of [
      () => json({}, 500),
      () => json({}, 503),
      () => json({}, 504),
      () => {
        throw new TypeError('network down');
      },
    ])
      expect(await load(edge(response))).toEqual({
        ok: false,
        retryable: true,
        reason: 'dependency_unavailable',
      });
  });

  it('treats an invalid or oversize success payload as unreadable', async () => {
    const oversize = new Response('{}', {
      headers: {
        'content-type': 'application/json',
        'content-length': String(QUALITY_GATE_MAX_RESPONSE_BYTES + 1),
      },
    });
    for (const response of [
      () => new Response('{}', { headers: { 'content-type': 'text/html' } }),
      () =>
        new Response('{not json', {
          headers: { 'content-type': 'application/json' },
        }),
      () => oversize,
    ])
      expect(await load(edge(response))).toMatchObject({
        ok: false,
        reason: 'target_unreadable',
      });
  });

  it('stops waiting when the gate budget aborts', async () => {
    const controller = new AbortController();
    const pending = load(
      edge(() => new Promise<Response>(() => undefined)),
      controller.signal,
    );
    controller.abort();
    expect(await pending).toMatchObject({
      ok: false,
      reason: 'dependency_unavailable',
    });
  });

  it('allows a larger payload than an ordinary RPC envelope', async () => {
    const big = { ...cleanInput(), padding: 'x'.repeat(300_000) };
    const result = await load(edge(() => json(big)));
    expect(result.ok).toBe(true);
  });
});

describe('the composed browser gate', () => {
  const session = {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: true,
  };
  const gateInputFor = (
    phase: CmsEditorialQualityGateInput['phase'],
    revisionId: string | null,
    entryId: string | null,
  ): CmsEditorialQualityGateInput => ({
    phase,
    requestId: REQUEST_ID,
    request: new Request('https://api.example.test/x', {
      headers: { 'x-correlation-id': CORRELATION_ID },
    }),
    session,
    entryId,
    revisionId,
  });
  const logger = () => {
    const info = vi.fn();
    return { logger: { info } as unknown as Logger, info };
  };

  it('returns verified healthy evidence and logs the run without content', async () => {
    const recorder = logger();
    const fetchImpl = edge(() => json(cleanInput()));
    const gate = compose(fetchImpl, { logger: recorder.logger }).qualityGate;
    const proof = await gate(
      gateInputFor('submit', REVISION_ID, ENTRY_ID),
      new AbortController().signal,
    );
    expect(proof).toMatchObject({
      category: 'accessibility',
      outcome: 'healthy',
      blockingCount: 0,
    });
    const [details] = recorder.info.mock.calls[0] as [Record<string, unknown>];
    expect(details).toMatchObject({
      eventName: 'cms.editorial.accessibility_gate',
      operation: 'cms.editorial.CMS-03B-05',
      outcome: 'success',
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
      attributes: { checker_state: 'healthy' },
      metrics: { blocking_findings: 0 },
    });
    expect(JSON.stringify(details)).not.toContain(ENTRY_ID);
  });

  it('returns blocked evidence for a revision with a blocking finding', async () => {
    const recorder = logger();
    const gate = compose(
      edge(() => json(blockingInput())),
      {
        logger: recorder.logger,
      },
    ).qualityGate;
    const proof = await gate(
      gateInputFor('schedule', REVISION_ID, null),
      new AbortController().signal,
    );
    expect(proof).toMatchObject({ outcome: 'blocked' });
    expect(proof!.blockingCount).toBeGreaterThan(0);
  });

  it('returns no proof for an unreadable or unavailable revision and logs the failure', async () => {
    for (const [phase, response, code] of [
      ['publish', () => raised('NOT_FOUND'), 'TARGET_UNREADABLE'],
      ['workflow_read', () => json({}, 503), 'CHECKER_DEPENDENCY_UNAVAILABLE'],
    ] as const) {
      const recorder = logger();
      const gate = compose(edge(response), {
        logger: recorder.logger,
      }).qualityGate;
      expect(
        await gate(
          gateInputFor(phase, null, ENTRY_ID),
          new AbortController().signal,
        ),
      ).toBeNull();
      const [details] = recorder.info.mock.calls.at(-1) as [
        Record<string, unknown>,
      ];
      expect(details).toMatchObject({
        outcome: 'failure',
        retryable: true,
        attributes: { checker_state: 'failed', failure_code: code },
      });
    }
  });

  it('sends only the named members and the server-derived context', async () => {
    const fetchImpl = edge(() => json(cleanInput()));
    const gate = compose(fetchImpl, { logger: logger().logger }).qualityGate;
    await gate(
      gateInputFor('publish', REVISION_ID, ENTRY_ID),
      new AbortController().signal,
    );
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(body.p_request).sort()).toEqual([
      'context',
      'entryId',
      'phase',
      'revisionId',
    ]);
    expect(body.p_request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
    });
    expect((init.headers as Record<string, string>)['X-Operation-Id']).toBe(
      'CMS-03B-09',
    );
  });
});

describe('gate log event', () => {
  it('is a redacted event with only the closed state, duration and counts', () => {
    const info = vi.fn();
    logQualityGateRun({ info } as unknown as Logger, identity, {
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
      durationMs: 2000,
      evaluatedAt: '2026-10-08T12:00:02.000Z',
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        durationMs: 2000,
        attributes: {
          checker_state: 'failed',
          failure_code: 'CHECKER_TIMEOUT',
        },
        metrics: { cms_a11y_checker_duration_ms: 2000 },
      }),
      { samplingClass: 'always', highRisk: true },
    );
  });
});
