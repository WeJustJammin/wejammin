import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  activateBody,
  activationRequest,
} from './governed-activation.test-support';
import {
  decidedReview,
  decisionBody,
  decisionRequest,
  governedHarness,
  jsonReply,
  sqlRefusal,
} from './governed-review-ops.test-support';
import { OPERATIONS } from './governed-review-ops-table.test-support';
import {
  designerSession,
  reviewResource,
  submitBody,
  submitRequest,
} from './governed-review-submit.test-support';
import {
  CMS_COMPOSITION_LOG_FIELDS,
  metricKeyConforms,
} from './observability-registry';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] The governed review routes emit their Slice 12 counters, their trace and their
 * allowlisted log members through the production telemetry closure: one request event per request, carrying
 * closed labels only.
 */

const capture = () => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    { sink: (line) => lines.push(line) },
  );
  const events = (): Record<string, unknown>[] =>
    lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter(
        (line) => line.eventName === 'cms.composition.governed_review.request',
      );
  const invalidations = (): Record<string, unknown>[] =>
    lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter(
        (line) =>
          line.eventName ===
          'cms.composition.governed_review.request.invalidated',
      );
  return { lines, logger, events, invalidations };
};

const metricsOf = (event: Record<string, unknown> | undefined) =>
  (event?.metrics ?? {}) as Record<string, number>;

const OPERATION = Object.fromEntries(
  OPERATIONS.map((row) => [row.id, row]),
) as Record<string, (typeof OPERATIONS)[number]>;

describe('CMS-03C-06 emits cms_governed_review_total', () => {
  it.each(['template_version', 'pattern_version', 'taxonomy_version'] as const)(
    'counts a committed %s submit once, with its subject kind and the success outcome',
    async (subjectKind) => {
      const seen = capture();
      const harness = governedHarness({
        tuning: { logger: seen.logger },
        reply: () => jsonReply(reviewResource(subjectKind)),
      });
      const response = await harness.send(
        submitRequest(submitBody(subjectKind)),
      );
      expect(response.status).toBe(201);
      expect(metricsOf(seen.events()[0])).toEqual({
        [`cms_governed_review_total{outcome="success",subject_kind="${subjectKind}"}`]: 1,
      });
    },
  );

  it('counts a refused submit under its outcome and the canonical counters of its published domain', async () => {
    const seen = capture();
    const harness = governedHarness({
      tuning: { logger: seen.logger },
      reply: () =>
        sqlRefusal('canonical_source_unavailable', '{"domain":"rights"}'),
    });
    const response = await harness.send(
      submitRequest(submitBody('taxonomy_version')),
    );
    expect(response.status).toBe(422);
    expect(metricsOf(seen.events()[0])).toEqual({
      'cms_governed_review_total{outcome="invalid",subject_kind="taxonomy_version"}': 1,
      'cms_canonical_match_total{domain="rights",outcome="source_unavailable"}': 1,
      'cms_canonical_source_unavailable_total{domain="rights"}': 1,
    });
  });

  it('counts nothing for a submit whose body never decoded', async () => {
    const seen = capture();
    const harness = governedHarness({
      tuning: { logger: seen.logger },
      reply: () => jsonReply(reviewResource()),
    });
    const response = await harness.send(
      submitRequest({ subjectKind: 'not_a_kind' }),
    );
    expect(response.status).toBe(422);
    expect(seen.events()[0]?.metrics).toBeUndefined();
  });
});

describe('CMS-03C-07 emits cms_governed_decision_total and the invalidation counter', () => {
  it.each(['approve', 'reject'] as const)(
    'counts a recorded %s decision once',
    async (decision) => {
      const seen = capture();
      const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
      const harness = row.harness({
        tuning: { logger: seen.logger },
        reply: () =>
          jsonReply(
            decidedReview(decision === 'reject' ? 'rejected' : 'approved'),
          ),
      });
      const response = await harness.send(
        decisionRequest(decisionBody({ decision })),
      );
      expect(response.status).toBe(200);
      expect(metricsOf(seen.events()[0])).toEqual({
        [`cms_governed_decision_total{decision="${decision}",outcome="success"}`]: 1,
      });
    },
  );

  it('counts a committed dependency_changed refusal as a conflicting decision, and the invalidation in its own event', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({
      tuning: { logger: seen.logger },
      reply: () =>
        jsonReply({
          kind: 'refusal',
          reasonCode: 'dependency_changed',
          details: {},
        }),
    });
    const response = await harness.send(decisionRequest());
    expect(response.status).toBe(409);
    expect(metricsOf(seen.events()[0])).toEqual({
      'cms_governed_decision_total{decision="approve",outcome="conflict"}': 1,
    });
    expect(metricsOf(seen.invalidations()[0])).toEqual({
      'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
    });
  });

  it('counts a denied decision without an invalidation', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({
      tuning: { logger: seen.logger },
      reply: () => sqlRefusal('NOT_FOUND'),
    });
    expect((await harness.send(decisionRequest())).status).toBe(404);
    expect(metricsOf(seen.events()[0])).toEqual({
      'cms_governed_decision_total{decision="approve",outcome="denied"}': 1,
    });
  });
});

describe('CMS-03C-09 keeps its activation counter and adds the invalidation counter', () => {
  it('counts a committed dependency_changed refusal in the activation counter and, in its own event, the invalidation counter', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-09'] as (typeof OPERATIONS)[number];
    const harness = row.harness({
      tuning: { logger: seen.logger },
      reply: () =>
        jsonReply({
          kind: 'refusal',
          reasonCode: 'dependency_changed',
          details: {},
        }),
    });
    expect((await harness.send(activationRequest(activateBody()))).status).toBe(
      409,
    );
    expect(metricsOf(seen.events()[0])).toEqual({
      'cms_governed_activation_total{action="activate",outcome="conflict",subject_kind="unknown"}': 1,
    });
    expect(metricsOf(seen.invalidations()[0])).toEqual({
      'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
    });
  });
});

describe('governed review request traces and log members', () => {
  it('lists the stages a committed decision really entered, in the BE03c order', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({ tuning: { logger: seen.logger } });
    expect((await harness.send(decisionRequest())).status).toBe(200);
    expect(seen.events()[0]?.traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.refetch',
      'cms.composition.idempotency',
      'cms.composition.rpc',
      'cms.composition.audit_outbox',
    ]);
  });

  it('lists only validation for a request refused before any session was resolved', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({ tuning: { logger: seen.logger } });
    const request = decisionRequest();
    request.headers.set('origin', 'https://evil.example.test');
    expect((await harness.send(request)).status).toBe(403);
    expect(seen.events()[0]?.traceSteps).toEqual([
      'cms.composition.validation',
    ]);
  });

  it('lists no audit/outbox for a refused command and no idempotency for a read', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const refused = row.harness({
      tuning: { logger: seen.logger },
      reply: () => sqlRefusal('NOT_FOUND'),
    });
    await refused.send(decisionRequest());
    expect(seen.events()[0]?.traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.refetch',
      'cms.composition.idempotency',
      'cms.composition.rpc',
    ]);
    const read = capture();
    const detail = (
      OPERATION['CMS-03C-10'] as (typeof OPERATIONS)[number]
    ).harness({ tuning: { logger: read.logger } });
    expect(
      (
        await detail.send(
          (OPERATION['CMS-03C-10'] as (typeof OPERATIONS)[number]).request(),
        )
      ).status,
    ).toBe(200);
    const steps = read.events()[0]?.traceSteps as string[];
    expect(steps).toContain('cms.composition.rpc');
    expect(steps).not.toContain('cms.composition.idempotency');
    expect(steps).not.toContain('cms.composition.audit_outbox');
  });

  it('carries the published error code, retryability, dependency class and acting-context class', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({
      tuning: { logger: seen.logger },
      reply: () => jsonReply({ code: 'PGRST000' }, 503),
    });
    expect((await harness.send(decisionRequest())).status).toBe(503);
    expect(seen.events()[0]).toMatchObject({
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      retryable: true,
      dependency: 'cms_composition',
      actingContextClass: 'party',
      outcome: 'failure',
    });
  });

  it('writes only allowlisted members and no request, session or provider text', async () => {
    const seen = capture();
    const row = OPERATION['CMS-03C-07'] as (typeof OPERATIONS)[number];
    const harness = row.harness({
      tuning: { logger: seen.logger },
      reply: () => sqlRefusal('NOT_FOUND', 'private provider Gérant secret'),
    });
    await harness.send(
      decisionRequest(
        decisionBody({ reason: 'Secret reason text about Gérant secret.' }),
      ),
    );
    for (const line of seen.lines) {
      for (const key of Object.keys(JSON.parse(line) as object))
        expect(CMS_COMPOSITION_LOG_FIELDS).toContain(key);
      for (const secret of [
        'Secret reason',
        'Gérant',
        'private provider',
        'sb_secret_synthetic',
        designerSession.userId,
        designerSession.actingPartyId,
      ])
        expect(line).not.toContain(secret);
    }
  });

  it('emits only registered metric keys with closed label values across every command', async () => {
    const seen = capture();
    for (const [id, make] of [
      ['CMS-03C-07', () => decisionRequest()],
      ['CMS-03C-09', () => activationRequest(activateBody())],
    ] as const) {
      const row = OPERATION[id] as (typeof OPERATIONS)[number];
      await row
        .harness({
          tuning: { logger: seen.logger },
          reply: () =>
            jsonReply({
              kind: 'refusal',
              reasonCode: 'dependency_changed',
              details: {},
            }),
        })
        .send(make());
    }
    const keys = [...seen.events(), ...seen.invalidations()].flatMap((event) =>
      Object.keys(metricsOf(event)),
    );
    expect(keys.length).toBeGreaterThan(2);
    for (const key of keys) expect(metricKeyConforms(key)).toBe(true);
  });
});
