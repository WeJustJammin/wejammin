import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  CMS_COMPOSITION_LOG_ATTRIBUTES,
  CMS_COMPOSITION_LOG_FIELDS,
  CMS_COMPOSITION_TRACE_STAGES,
} from './observability-registry';
import {
  compositionRequestLog,
  observeRequest,
} from './observability-observation';
import { noteFacts, noteRefusal, noteStage } from './observability-facts';

/*
 * [P2-S12-AC-264] BE03c Observability: "Structured scrubbed logs are keyed by operation ID, requestId, traceId,
 * correlationId, actor/acting-context class, safe aggregate ID/hash, version, outcome, error code, duration,
 * dependency class, and retryability. No content, locale text, target name, token, raw rule, or capability graph
 * is logged." and "Traces cover validation -> principal/assignment -> registry/projection refetch ->
 * idempotency -> RPC/SQL -> audit/outbox -> consumer refetch."
 */

const REQUEST_ID = 'd1200000-0000-4000-8000-0000000000a1';
const TRACEPARENT_ID = 'abcdef0123456789abcdef0123456789';

const request = (headers: Record<string, string> = {}): Request =>
  new Request('https://api.example.test/x', { headers });

const STEP = Object.fromEntries(
  CMS_COMPOSITION_TRACE_STAGES.map((entry) => [entry.stage, entry.step]),
) as Record<(typeof CMS_COMPOSITION_TRACE_STAGES)[number]['stage'], string>;

describe('[P2-S12-AC-264] the trace stage vocabulary', () => {
  it('lists the seven BE03c stages in their spec order, each with one owner and one step name', () => {
    expect(CMS_COMPOSITION_TRACE_STAGES.map((entry) => entry.stage)).toEqual([
      'validation',
      'principal_assignment',
      'registry_refetch',
      'idempotency',
      'rpc',
      'audit_outbox',
      'consumer_refetch',
    ]);
    expect(
      new Set(CMS_COMPOSITION_TRACE_STAGES.map((entry) => entry.step)).size,
    ).toBe(7);
    for (const entry of CMS_COMPOSITION_TRACE_STAGES) {
      expect(entry.step).toMatch(/^cms\.composition\.[a-z_]+$/u);
      expect(['route', 'port', 'sql_commit', 'consumer']).toContain(
        entry.observedBy,
      );
    }
  });
});

describe('[P2-S12-AC-264] request traces', () => {
  it('records validation for every request and nothing it never reached', () => {
    const req = request();
    expect(
      observeRequest(req, REQUEST_ID, 'CMS-03C-07', 403).traceSteps,
    ).toEqual([STEP.validation]);
  });

  it('records the stages a request entered in the canonical order, whatever order they were noted in', () => {
    const req = request();
    noteStage(req, 'rpc');
    noteStage(req, 'principal_assignment');
    noteStage(req, 'idempotency');
    noteStage(req, 'registry_refetch');
    expect(
      observeRequest(req, REQUEST_ID, 'CMS-03C-07', 409).traceSteps,
    ).toEqual([
      STEP.validation,
      STEP.principal_assignment,
      STEP.registry_refetch,
      STEP.idempotency,
      STEP.rpc,
    ]);
  });

  it('adds audit/outbox only for a committed write: an idempotent command answered below 400', () => {
    const write = request();
    noteStage(write, 'idempotency');
    noteStage(write, 'rpc');
    expect(
      observeRequest(write, REQUEST_ID, 'CMS-03C-07', 200).traceSteps,
    ).toContain(STEP.audit_outbox);
    for (const status of [400, 409, 503]) {
      const refused = request();
      noteStage(refused, 'idempotency');
      noteStage(refused, 'rpc');
      expect(
        observeRequest(refused, REQUEST_ID, 'CMS-03C-07', status).traceSteps,
      ).not.toContain(STEP.audit_outbox);
    }
    const read = request();
    noteStage(read, 'rpc');
    expect(
      observeRequest(read, REQUEST_ID, 'CMS-03C-10', 200).traceSteps,
    ).not.toContain(STEP.audit_outbox);
  });
});

describe('[P2-S12-AC-264] request observation members', () => {
  it('keys the event by the trace id of a valid traceparent and by the request id otherwise', () => {
    const traced = request({
      traceparent: `00-${TRACEPARENT_ID}-0123456789abcdef-01`,
    });
    expect(observeRequest(traced, REQUEST_ID, 'CMS-03C-07', 200).traceId).toBe(
      TRACEPARENT_ID,
    );
    for (const bad of ['garbage', '00-xyz-01', '00-ABCDEF-01']) {
      const untraced = request({ traceparent: bad });
      expect(
        observeRequest(untraced, REQUEST_ID, 'CMS-03C-07', 200).traceId,
      ).toBe(REQUEST_ID);
    }
  });

  it('keys the event by a safe x-correlation-id and by the request id when it is absent or unsafe', () => {
    expect(
      observeRequest(
        request({ 'x-correlation-id': 'corr-0001' }),
        REQUEST_ID,
        'CMS-03C-07',
        200,
      ).correlationId,
    ).toBe('corr-0001');
    for (const bad of [
      'has space',
      'a'.repeat(201),
      '-lead',
      'Gérant secret',
    ]) {
      expect(
        observeRequest(
          request({ 'x-correlation-id': bad }),
          REQUEST_ID,
          'CMS-03C-07',
          200,
        ).correlationId,
      ).toBe(REQUEST_ID);
    }
    expect(
      observeRequest(request(), REQUEST_ID, 'CMS-03C-07', 200).correlationId,
    ).toBe(REQUEST_ID);
  });

  it('carries the published error code only when it has the catalog shape', () => {
    const published = request();
    noteRefusal(
      published,
      409,
      { reasonCode: 'dependency_changed' },
      'GOVERNED_REVIEW_VERSION_CONFLICT',
    );
    expect(
      observeRequest(published, REQUEST_ID, 'CMS-03C-07', 409).errorCode,
    ).toBe('GOVERNED_REVIEW_VERSION_CONFLICT');
    const hostile = request();
    noteRefusal(hostile, 409, {}, 'Term "Gérant secret" overlaps');
    expect(
      observeRequest(hostile, REQUEST_ID, 'CMS-03C-07', 409).errorCode,
    ).toBeUndefined();
    expect(
      observeRequest(request(), REQUEST_ID, 'CMS-03C-07', 200).errorCode,
    ).toBeUndefined();
  });

  it.each([
    [200, false, undefined],
    [403, false, undefined],
    [409, false, undefined],
    [429, true, undefined],
    [500, false, undefined],
    [502, false, 'cms_composition'],
    [503, true, 'cms_composition'],
    [504, true, 'cms_composition'],
  ] as const)(
    'answers status %i with retryable %s and dependency %s',
    (status, retryable, dependency) => {
      const observation = observeRequest(
        request(),
        REQUEST_ID,
        'CMS-03C-07',
        status,
      );
      expect(observation.retryable).toBe(retryable);
      expect(observation.dependency).toBe(dependency);
    },
  );

  it('reports the acting context class of the verified session, never an identifier', () => {
    const none = request();
    expect(
      observeRequest(none, REQUEST_ID, 'CMS-03C-07', 200).actingContextClass,
    ).toBe('none');
    const party = request();
    noteFacts(party, { actingContext: 'party' });
    expect(
      observeRequest(party, REQUEST_ID, 'CMS-03C-07', 200).actingContextClass,
    ).toBe('party');
  });

  it('carries the counters of its operation and nothing else', () => {
    const req = request();
    noteFacts(req, { decision: 'approve' });
    expect(observeRequest(req, REQUEST_ID, 'CMS-03C-07', 200).metrics).toEqual({
      'cms_governed_decision_total{decision="approve",outcome="success"}': 1,
    });
    expect(
      observeRequest(request(), REQUEST_ID, 'CMS-03C-10', 200).metrics,
    ).toEqual({});
  });
});

const capture = () => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    { sink: (line) => lines.push(line) },
  );
  return { lines, logger };
};

describe('[P2-S12-AC-264] the structured request log', () => {
  const event = (req: Request, status: number) => ({
    operationId: 'CMS-03C-07',
    requestId: REQUEST_ID,
    status,
    outcome: (status < 400
      ? 'success'
      : status < 500
        ? 'rejected'
        : 'failure') as 'success' | 'rejected' | 'failure',
    actorClass: 'human' as const,
    durationMs: 12,
    observation: observeRequest(req, REQUEST_ID, 'CMS-03C-07', status),
  });

  it('is accepted by the strict logger and keeps the existing request members', () => {
    const { lines, logger } = capture();
    const req = request({ 'x-correlation-id': 'corr-0001' });
    noteFacts(req, { decision: 'reject', actingContext: 'party' });
    noteStage(req, 'principal_assignment');
    noteStage(req, 'idempotency');
    noteStage(req, 'rpc');
    expect(
      logger.info(
        compositionRequestLog(event(req, 200), {
          eventName: 'cms.composition.governed_review.request',
          operation: 'cms.composition.governed_review.decide',
        }),
        { samplingClass: 'always' },
      ),
    ).toBe('written');
    const line = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      eventName: 'cms.composition.governed_review.request',
      operation: 'cms.composition.governed_review.decide',
      requestId: REQUEST_ID,
      correlationId: 'corr-0001',
      traceId: REQUEST_ID,
      actingContextClass: 'party',
      outcome: 'success',
      durationMs: 12,
      retryable: false,
      attributes: {
        actor_class: 'human',
        status: 200,
        runbook: 'cms-composition',
      },
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
        'cms.composition.audit_outbox',
      ],
      metrics: {
        'cms_governed_decision_total{decision="reject",outcome="success"}': 1,
      },
    });
  });

  it('writes only allowlisted members, even when every fact is hostile', () => {
    const { lines, logger } = capture();
    const req = request({
      'x-correlation-id': 'Gérant secret',
      traceparent: 'Gérant secret',
      authorization: 'Bearer secret-token-value',
    });
    noteRefusal(
      req,
      422,
      {
        reasonCode: 'canonical_overlap',
        domain: 'role',
        canonicalId: 'd1200000-0000-4000-8000-000000000002',
        message: 'Gérant secret',
        violations: [{ path: '/label', message: 'Gérant secret' }],
        label: 'Gérant secret',
        locale: 'fr-FR',
        token: 'secret-token-value',
        capabilities: ['cms.owner'],
      },
      'VALIDATION_FAILED',
    );
    logger.info(
      compositionRequestLog(event(req, 422), {
        eventName: 'cms.composition.taxonomy.request',
        operation: 'cms.composition.taxonomy.act',
      }),
      { samplingClass: 'always', highRisk: true },
    );
    const text = lines[0] as string;
    const line = JSON.parse(text) as Record<string, unknown>;
    expect(
      Object.keys(line).filter(
        (key) => !CMS_COMPOSITION_LOG_FIELDS.includes(key),
      ),
    ).toEqual([]);
    expect(Object.keys(line.attributes as object).sort()).toEqual(
      [...CMS_COMPOSITION_LOG_ATTRIBUTES].sort(),
    );
    for (const secret of [
      'Gérant',
      'secret',
      'fr-FR',
      'cms.owner',
      'canonicalId',
      'd1200000-0000-4000-8000-000000000002',
    ])
      expect(text).not.toContain(secret);
  });

  it('lists exactly the BE03c log keys and the logger envelope as its allowlist', () => {
    expect([...CMS_COMPOSITION_LOG_FIELDS].sort()).toEqual(
      [
        'actingContextClass',
        'actorClass',
        'attributes',
        'correlationId',
        'dependency',
        'durationMs',
        'entityIdHash',
        'entityType',
        'entityVersion',
        'environment',
        'errorCode',
        'eventName',
        'metrics',
        'operation',
        'outcome',
        'release',
        'requestId',
        'retryable',
        'service',
        'severity',
        'timestamp',
        'traceId',
        'traceSteps',
      ].sort(),
    );
  });
});
