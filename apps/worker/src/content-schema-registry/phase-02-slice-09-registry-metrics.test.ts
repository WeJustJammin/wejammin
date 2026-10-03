/**
 * BE03a Observability for the original A01-A08 operations: each request emits
 * the declared per-operation counters through the telemetry sink as labelled
 * metrics (`name{label="value"}`, labels alphabetical). Label values come only
 * from closed sets. The database-side gauges (migration, activation age,
 * outbox, queue) are produced where the data lives and are proven in the
 * database and consumer suites.
 */
import { describe, expect, it } from 'vitest';

import {
  jsonRequest,
  makeHarness,
  mutationPath,
  releaseRequest,
  type Harness,
} from './phase-02-slice-09-worker-test-support';
import {
  error,
  ok,
  validActivation,
  validBlock,
  validDraft,
  validField,
  validLifecycle,
  validRelation,
} from './phase-02-slice-09-test-values';
import type { TelemetryEvent } from './types';

const registryMetrics = (harness: Harness): Record<string, number> => {
  const event = harness.telemetry.mock.calls.at(-1)?.[0] as TelemetryEvent;
  return Object.fromEntries(
    Object.entries(event.metrics ?? {}).filter(
      ([name]) =>
        name.startsWith('cms_definition_') ||
        name.startsWith('cms_block_') ||
        name.startsWith('cms_release_'),
    ),
  );
};

type Case = readonly [
  operation: string,
  send: (harness: Harness) => Promise<Response>,
  port: keyof Harness['ports'],
];

const human = (path: string, body: unknown, ifMatch = true) =>
  jsonRequest(path, body, ifMatch ? { 'if-match': '"1"' } : {});

const HUMAN: readonly Case[] = [
  [
    'CMS-03A-01',
    (h) =>
      Promise.resolve(
        h.app.request(human('/api/v1/cms/content-types', validDraft, false)),
      ),
    'createTypeDraft',
  ],
  [
    'CMS-03A-02',
    (h) =>
      Promise.resolve(h.app.request(human(mutationPath.field, validField))),
    'addFieldDefinition',
  ],
  [
    'CMS-03A-03',
    (h) =>
      Promise.resolve(
        h.app.request(human(mutationPath.relation, validRelation)),
      ),
    'bindRelation',
  ],
  [
    'CMS-03A-04',
    (h) =>
      Promise.resolve(
        h.app.request(human(mutationPath.activate, validActivation)),
      ),
    'activateSchema',
  ],
];

describe('BE03a A01-A04 per-operation definition metrics', () => {
  it.each(HUMAN)(
    '[P2-S09-AC-208] %s emits request, latency, error and conflict counters with closed labels',
    async (operation, send, port) => {
      const success = makeHarness();
      expect((await send(success)).status).toBeLessThan(300);
      expect(registryMetrics(success)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="success"}`]: 1,
        cms_definition_latency_ms: 0,
      });

      const forbidden = makeHarness();
      forbidden.ports[port]?.mockResolvedValueOnce(
        error(403, 'FORBIDDEN', 'no', { reasonCode: 'CAPABILITY_REQUIRED' }),
      );
      expect((await send(forbidden)).status).toBe(403);
      expect(registryMetrics(forbidden)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="denied"}`]: 1,
        [`cms_definition_error_total{code="FORBIDDEN",operation="${operation}"}`]: 1,
        cms_definition_latency_ms: 0,
      });

      const conflict = makeHarness();
      conflict.ports[port]?.mockResolvedValueOnce(
        error(409, 'CONFLICT', 'stale', { conflict: 'VERSION_MISMATCH' }),
      );
      expect((await send(conflict)).status).toBe(409);
      expect(registryMetrics(conflict)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="conflict"}`]: 1,
        [`cms_definition_error_total{code="CONFLICT",operation="${operation}"}`]: 1,
        [`cms_definition_conflict_total{operation="${operation}",reason="VERSION_MISMATCH"}`]: 1,
        cms_definition_latency_ms: 0,
      });

      const unnamed = makeHarness();
      unnamed.ports[port]?.mockResolvedValueOnce(
        error(409, 'IDEMPOTENCY_CONFLICT', 'replayed', {}),
      );
      expect((await send(unnamed)).status).toBe(409);
      expect(registryMetrics(unnamed)).toMatchObject({
        [`cms_definition_conflict_total{operation="${operation}",reason="IDEMPOTENCY_MISMATCH"}`]: 1,
      });

      const down = makeHarness();
      down.ports[port]?.mockResolvedValueOnce(
        error(503, 'DEPENDENCY_UNAVAILABLE', 'down', {}),
      );
      expect((await send(down)).status).toBe(503);
      expect(registryMetrics(down)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="failed"}`]: 1,
        [`cms_definition_error_total{code="DEPENDENCY_UNAVAILABLE",operation="${operation}"}`]: 1,
        cms_definition_latency_ms: 0,
      });
    },
  );

  it('[P2-S09-AC-208] never labels a metric with request text or an identifier', async () => {
    const harness = makeHarness();
    harness.ports.createTypeDraft.mockResolvedValueOnce(
      error(422, 'secret-code-with-private-text', 'x', {}),
    );
    await harness.app.request(
      human('/api/v1/cms/content-types', validDraft, false),
    );
    const names = Object.keys(registryMetrics(harness)).join('\n');
    expect(names).not.toContain('secret');
    expect(names).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
  });
});

describe('BE03a A05 and A08 release block metrics', () => {
  const register = (harness: Harness) =>
    harness.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock),
    );
  const advance = (harness: Harness) =>
    harness.app.request(
      releaseRequest(mutationPath.lifecycle, validLifecycle, {
        'if-match': '"1"',
      }),
    );

  it('[P2-S09-AC-208] A05 counts a block registration and the nonce claim outcome', async () => {
    const accepted = makeHarness();
    expect((await register(accepted)).status).toBe(201);
    expect(registryMetrics(accepted)).toEqual({
      'cms_definition_request_total{operation="CMS-03A-05",outcome="success"}': 1,
      cms_definition_latency_ms: 0,
      cms_block_registration_total: 1,
      'cms_release_nonce_claim_total{outcome="claimed"}': 1,
    });

    const refused = makeHarness();
    refused.ports.registerBlock.mockResolvedValueOnce(
      error(401, 'WEBHOOK_REJECTED', 'Release authentication failed.', {}),
    );
    expect((await register(refused)).status).toBe(401);
    const metrics = registryMetrics(refused);
    expect(metrics).toMatchObject({
      'cms_release_nonce_claim_total{outcome="rejected"}': 1,
      'cms_definition_error_total{code="WEBHOOK_REJECTED",operation="CMS-03A-05"}': 1,
    });
    expect(metrics).not.toHaveProperty('cms_block_registration_total');
  });

  it('[P2-S09-AC-208] A08 counts a lifecycle advance and the nonce claim outcome', async () => {
    const accepted = makeHarness();
    expect((await advance(accepted)).status).toBe(201);
    expect(registryMetrics(accepted)).toEqual({
      'cms_definition_request_total{operation="CMS-03A-08",outcome="success"}': 1,
      cms_definition_latency_ms: 0,
      cms_block_lifecycle_advance_total: 1,
      'cms_release_nonce_claim_total{outcome="claimed"}': 1,
    });

    const refused = makeHarness();
    refused.ports.advanceBlockLifecycle.mockResolvedValueOnce(
      error(409, 'CONFLICT', 'replay', { conflict: 'INVALID_TRANSITION' }),
    );
    expect((await advance(refused)).status).toBe(409);
    const metrics = registryMetrics(refused);
    expect(metrics).not.toHaveProperty('cms_block_lifecycle_advance_total');
    expect(metrics).not.toHaveProperty(
      'cms_release_nonce_claim_total{outcome="claimed"}',
    );
  });
});

describe('BE03a rate-limited A01-A08 requests', () => {
  it('[P2-S09-AC-208] a limiter refusal emits cms_definition_rate_limited_total with the operation request outcome', async () => {
    const harness = makeHarness({
      rate: ok({
        allowed: false,
        limit: 30,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    });
    const response = await harness.app.request(
      human('/api/v1/cms/content-types', validDraft, false),
    );
    expect(response.status).toBe(429);
    expect(registryMetrics(harness)).toEqual({
      'cms_definition_request_total{operation="CMS-03A-01",outcome="rate_limited"}': 1,
      'cms_definition_error_total{code="RATE_LIMITED",operation="CMS-03A-01"}': 1,
      cms_definition_rate_limited_total: 1,
      cms_definition_latency_ms: 0,
    });

    const release = makeHarness({
      rate: ok({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    });
    const refused = await release.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock),
    );
    expect(refused.status).toBe(429);
    expect(registryMetrics(release)).toMatchObject({
      cms_definition_rate_limited_total: 1,
    });
  });
});
