import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@wejammin/observability/logging';

import { evaluateAccessibilityGate } from './cms-editorial/a11y-structural';
import { cleanInput } from './cms-editorial/a11y-structural/a11y-structural.test-support';
import {
  commandCases,
  readCases,
} from './cms-editorial/workflow-harness.test-support';
import { previewVerificationDenial } from '@wejammin/contracts';
import { createPreviewTokenVerifier } from './cms-editorial-production-preview-verifier';
import { logQualityGateRun } from './cms-editorial-production-quality-gate';
import { productionCmsEditorialTelemetry } from './cms-editorial-production-telemetry';
import {
  ORIGIN,
  raised,
  rpcEdge,
  workflowApp,
  workflowResources,
} from './cms-editorial-production-workflow.test-support';
import { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';
import { json } from './cms-editorial-production.test-support';

/*
 * The shared logger validates every event against a strict schema (lowercase
 * label names, safe-code values) and silently REJECTS one that does not fit, so
 * a metric the routes build but the schema refuses would vanish. These tests
 * run the real logger over every Slice 11 event the Worker writes.
 */

const realLogger = () => {
  const lines: string[] = [];
  const diagnostics: string[] = [];
  const logger = createLogger(
    { environment: 'test', release: 'slice-11', service: 'wejammin-api' },
    {
      sink: (line) => lines.push(line),
      onDiagnostic: (code) => diagnostics.push(code),
    },
  );
  const events = () =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, lines, diagnostics, events };
};

describe('route telemetry through the production sink', () => {
  it('writes every command and read event without a single rejected event', async () => {
    const log = realLogger();
    const handlers: Record<string, () => Response> = {};
    for (const [operationId, resource] of Object.entries(workflowResources))
      handlers[
        CMS_EDITORIAL_RPC[operationId as keyof typeof CMS_EDITORIAL_RPC]
      ] = () => json(resource);
    const edge = rpcEdge(handlers);
    const app = workflowApp(edge.fetchImpl, {
      logger: log.logger,
      telemetry: productionCmsEditorialTelemetry(log.logger),
    });
    for (const testCase of commandCases)
      await app.request(testCase.path, {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': 'idempotency-key-0001',
          'if-match': '"2"',
        },
        body: JSON.stringify(testCase.body),
      });
    for (const testCase of readCases)
      await app.request(testCase.path, { headers: { origin: ORIGIN } });
    expect(log.diagnostics).toEqual([]);
    const metrics = log
      .events()
      .filter((event) => event.eventName === 'cms.editorial.request')
      .map((event) => event.metrics as Record<string, number>);
    expect(metrics).toHaveLength(commandCases.length + readCases.length);
    expect(
      metrics.some(
        (entry) =>
          entry[
            'cms_review_submitted_total{outcome="success",risk_class="ordinary"}'
          ] === 1,
      ),
    ).toBe(true);
    expect(
      metrics.some(
        (entry) =>
          entry[
            'cms_review_assignment_total{action="create",outcome="success"}'
          ] === 1,
      ),
    ).toBe(true);
  });

  it('writes refusal events (step-up, typed preflight failure, outage) without rejection', async () => {
    const log = realLogger();
    const edge = rpcEdge({
      cms_publish_revision: () =>
        raised('preflight_failed', {
          preflight: [
            {
              category: 'accessibility',
              outcome: 'failed',
              reasonCode: 'blocking_finding',
            },
          ],
        }),
    });
    const app = workflowApp(edge.fetchImpl, {
      logger: log.logger,
      telemetry: productionCmsEditorialTelemetry(log.logger),
    });
    const publish = commandCases.find(
      (item) => item.operationId === 'CMS-03B-09',
    )!;
    const send = (app2: typeof app) =>
      app2.request(publish.path, {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': 'idempotency-key-0001',
          'if-match': '"2"',
        },
        body: JSON.stringify(publish.body),
      });
    expect((await send(app)).status).toBe(422);
    const stale = workflowApp(edge.fetchImpl, {
      logger: log.logger,
      telemetry: productionCmsEditorialTelemetry(log.logger),
      resolveSession: async () => ({
        ok: true as const,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: null,
          capabilities: ['cms.publisher'],
          mfaFresh: false,
        },
      }),
    });
    expect((await send(stale)).status).toBe(401);
    expect(log.diagnostics).toEqual([]);
    const metrics = log
      .events()
      .filter((event) => event.eventName === 'cms.editorial.request')
      .map((event) => event.metrics as Record<string, number>);
    expect(
      metrics[0]![
        'cms_preflight_result_total{category="accessibility",outcome="failed",phase="publish"}'
      ],
    ).toBe(1);
  });
});

describe('gate and verifier events through the real logger', () => {
  const identity = {
    operationId: 'CMS-03B-05',
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };

  it('writes the gate event for a healthy and a failed run', async () => {
    const log = realLogger();
    logQualityGateRun(
      log.logger,
      identity,
      await evaluateAccessibilityGate({
        load: async () => ({ ok: true, input: cleanInput() }),
      }),
    );
    logQualityGateRun(
      log.logger,
      identity,
      await evaluateAccessibilityGate({
        load: async () => ({
          ok: false,
          retryable: false,
          reason: 'target_unreadable',
        }),
      }),
    );
    expect(log.diagnostics).toEqual([]);
    expect(log.events().map((event) => event.outcome)).toEqual([
      'success',
      'failure',
    ]);
  });

  it('writes the verifier counters and the circuit warning', async () => {
    const log = realLogger();
    const verify = createPreviewTokenVerifier({
      environment: {
        SUPABASE_URL: 'https://supabase.example.test',
        SUPABASE_SECRET_KEY: 'sb_secret_logging_test_only',
      },
      fetchImpl: vi.fn(async () =>
        json({ code: 'XX000' }, 503),
      ) as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: log.logger,
    });
    const denied = await verify({
      token: 'A'.repeat(43),
      actorPersonId: '123e4567-e89b-42d3-a456-426614174000',
      actingContextVersion: 'c'.repeat(64),
      route: '/music',
      locale: 'en-US',
      audience: 'members',
    });
    expect(denied).toEqual(previewVerificationDenial());
    expect(log.diagnostics).toEqual([]);
    expect(log.events().map((event) => event.eventName)).toEqual([
      'cms.preview.verify.circuit_open',
      'cms.preview.verify',
    ]);
  });
});
