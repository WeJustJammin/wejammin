import { describe, expect, it } from 'vitest';

import {
  appendRequest,
  createRequest,
  fetchFailing,
  postgrestRaise,
  resolveRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';
import { json } from './cms-editorial-production.test-support';
import {
  appendedRevisionId,
  createResource,
  resolvedRevisionId,
  resource,
  baseRevisionId,
  theirsRevisionId,
  conflictId,
} from './cms-editorial/route-fixtures.test-support';
import {
  REQUEST_TOTAL,
  ok,
  recorder,
} from './cms-editorial-production-telemetry.test-support';

/**
 * BE03b "Observability" (:1437-1446) through the real route -> production
 * adapter chain. A recording sink replaces the logger, so these tests read the
 * exact event a production sink receives: metric names and closed labels, the
 * stages that really ran, the retryability derived from the published error,
 * and the absence of any identifier, value or credential.
 */

describe('request metrics and attributes', () => {
  it('[P2-S10-AC-009] [P2-S10-AC-007] a created revision names the BE03b metrics, stages, SLO and a safe entry hash', async () => {
    const sink = recorder();
    const fetchImpl = fetchFailing(ok(resource(appendedRevisionId, '2')));
    const response = await appendRequest(
      wiredApp(fetchImpl, { telemetry: sink.telemetry }),
    );
    expect(response.status).toBe(201);
    await sink.settled();
    const [event] = sink.events;
    expect(event).toMatchObject({
      operationId: 'CMS-03B-01',
      outcome: 'success',
      status: 201,
      actorClass: 'human',
      actingContextClass: 'party',
      rateClass: 'cms-entry-write',
      rateLimit: 120,
      deadlineMs: 15_000,
      eventType: 'cms.entry.revision-created.v1',
      retryable: false,
      entityVersion: '2',
      traceSteps: [
        'cms.admission',
        'cms.authority',
        'cms.rate_limit',
        'cms.rpc',
        'cms.response',
      ],
    });
    expect(event?.slo).toMatchObject({ tier: 2, commandP95Ms: 1_200 });
    expect(event?.entityIdHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(event?.metrics).toMatchObject({
      [REQUEST_TOTAL('CMS-03B-01', 'success')]: 1,
      cms_revision_created_total: 1,
      changed_paths: 1,
      request_status: 201,
      slo_command_p95_ms: 1_200,
    });
    expect(event?.metrics).toHaveProperty('cms_editorial_latency_ms');
    expect(event?.metrics).not.toHaveProperty('cms_editorial_error_total');
  });

  it('[P2-S10-AC-015] a resolved conflict also counts the closed conflict', async () => {
    const sink = recorder();
    const resolved = {
      ...resource(resolvedRevisionId, '3', '3'),
      parentRevisionIds: [baseRevisionId, theirsRevisionId],
      conflictId,
    };
    const response = await resolveRequest(
      wiredApp(fetchFailing(ok(resolved)), { telemetry: sink.telemetry }),
    );
    expect(response.status).toBe(201);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      [REQUEST_TOTAL('CMS-03B-02', 'success')]: 1,
      cms_revision_created_total: 1,
      cms_conflict_closed_total: 1,
      choices: 1,
    });
    expect(sink.events[0]?.rateClass).toBe('cms-entry-conflict');
  });

  it('[P2-S10-AC-066] a created entry counts cms_entry_create_total and the revision', async () => {
    const sink = recorder();
    const response = await createRequest(
      wiredApp(fetchFailing(ok(createResource)), {
        telemetry: sink.telemetry,
      }),
    );
    expect(response.status).toBe(201);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      'cms_entry_create_total{outcome="success"}': 1,
      cms_revision_created_total: 1,
    });
    expect(sink.events[0]?.metrics).not.toHaveProperty(
      'cms_entry_create_replayed_total',
    );
  });

  it('[P2-S10-AC-066] a reused idempotency key counts the create conflict', async () => {
    const sink = recorder();
    const response = await createRequest(
      wiredApp(
        fetchFailing(() => postgrestRaise('IDEMPOTENCY_MISMATCH')),
        { telemetry: sink.telemetry },
      ),
    );
    expect(response.status).toBe(409);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      'cms_entry_create_total{outcome="conflict"}': 1,
      cms_entry_create_conflict_total: 1,
      'cms_editorial_conflict_total{operation="CMS-03B-10",reason="IDEMPOTENCY_MISMATCH"}': 1,
      'cms_editorial_error_total{code="CONFLICT",operation="CMS-03B-10"}': 1,
    });
    expect(sink.events[0]?.retryable).toBe(false);
  });

  it('[P2-S10-AC-015] a committed same-field conflict counts the open record', async () => {
    const sink = recorder();
    const committed = {
      kind: 'conflict',
      code: 'VERSION_MISMATCH',
      details: {
        expectedVersion: '1',
        currentVersion: '2',
        conflictHash: 'b'.repeat(64),
      },
    };
    const response = await appendRequest(
      wiredApp(fetchFailing(ok(committed)), { telemetry: sink.telemetry }),
    );
    expect(response.status).toBe(409);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      cms_conflict_open_total: 1,
      cms_conflict_records_created_total: 1,
      'cms_editorial_conflict_total{operation="CMS-03B-01",reason="VERSION_MISMATCH"}': 1,
    });
  });

  it('[P2-S10-AC-005] a validation refusal counts cms_revision_validation_failed_total', async () => {
    const sink = recorder();
    const response = await appendRequest(
      wiredApp(
        fetchFailing(() => postgrestRaise('rich_text_not_canonical')),
        { telemetry: sink.telemetry },
      ),
    );
    expect(response.status).toBe(422);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      [REQUEST_TOTAL('CMS-03B-01', 'invalid')]: 1,
      cms_revision_validation_failed_total: 1,
      'cms_editorial_error_total{code="VALIDATION_FAILED",operation="CMS-03B-01"}': 1,
    });
  });

  it('[P2-S10-AC-007] a rate refusal never reaches the RPC, counts rate_limited and is retryable', async () => {
    const sink = recorder();
    const fetchImpl = fetchFailing(ok({}));
    const app = wiredApp(fetchImpl, {
      telemetry: sink.telemetry,
      rateLimit: async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 4_102_444_800,
        },
      }),
    });
    const response = await appendRequest(app);
    expect(response.status).toBe(429);
    await sink.settled();
    const [event] = sink.events;
    expect(event?.traceSteps).toEqual([
      'cms.admission',
      'cms.authority',
      'cms.rate_limit',
      'cms.response',
    ]);
    expect(event?.retryable).toBe(true);
    expect(event?.metrics).toMatchObject({
      [REQUEST_TOTAL('CMS-03B-01', 'rate_limited')]: 1,
      cms_editorial_rate_limited_total: 1,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-008] a session refusal reports only the stages entered', async () => {
    const sink = recorder();
    const app = wiredApp(fetchFailing(ok({})), {
      telemetry: sink.telemetry,
      resolveSession: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
    });
    const response = await appendRequest(app);
    expect(response.status).toBe(401);
    await sink.settled();
    expect(sink.events[0]?.traceSteps).toEqual([
      'cms.admission',
      'cms.authority',
      'cms.response',
    ]);
    expect(sink.events[0]?.actingContextClass).toBe('none');
    expect(sink.events[0]?.metrics).toMatchObject({
      [REQUEST_TOTAL('CMS-03B-01', 'denied')]: 1,
    });
  });

  it('[P2-S10-AC-008] a scrubbed 500 and a dependency 503 derive retryability from the published error', async () => {
    const sink = recorder();
    const internal = await appendRequest(
      wiredApp(
        fetchFailing(() => postgrestRaise('INTERNAL_ERROR')),
        { telemetry: sink.telemetry },
      ),
    );
    expect(internal.status).toBe(500);
    const unavailable = await appendRequest(
      wiredApp(
        fetchFailing(() => json({}, 503)),
        { telemetry: sink.telemetry },
      ),
    );
    expect(unavailable.status).toBe(503);
    await sink.settled(2);
    const byStatus = new Map(sink.events.map((e) => [e.status, e]));
    expect(byStatus.get(500)).toMatchObject({
      outcome: 'failure',
      retryable: false,
      errorCode: 'INTERNAL_ERROR',
    });
    expect(byStatus.get(503)).toMatchObject({
      outcome: 'failure',
      retryable: true,
      dependency: 'cms_editorial',
    });
  });
});

describe('idempotent replay marker', () => {
  it('[P2-S10-AC-064] counts a replayed create as a replay, not a second creation, and never forwards the marker', async () => {
    const sink = recorder();
    const response = await createRequest(
      wiredApp(
        fetchFailing(ok(createResource, { 'x-cms-idempotent-replay': 'true' })),
        { telemetry: sink.telemetry },
      ),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('x-cms-idempotent-replay')).toBeNull();
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      'cms_entry_create_total{outcome="success"}': 1,
      cms_entry_create_replayed_total: 1,
    });
    expect(sink.events[0]?.metrics).not.toHaveProperty(
      'cms_revision_created_total',
    );
  });

  it('only the exact value true marks a replay', async () => {
    const sink = recorder();
    await createRequest(
      wiredApp(
        fetchFailing(ok(createResource, { 'x-cms-idempotent-replay': 'TRUE' })),
        { telemetry: sink.telemetry },
      ),
    );
    await sink.settled();
    expect(sink.events[0]?.metrics).not.toHaveProperty(
      'cms_entry_create_replayed_total',
    );
    expect(sink.events[0]?.metrics).toHaveProperty(
      'cms_revision_created_total',
    );
  });
});
