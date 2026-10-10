import { describe, expect, it } from 'vitest';

import { cases } from './workflow-telemetry-redaction-cases.test-support';
import {
  CONTENT_SECRET_REASON,
  DEPENDENCY_HASH,
  UPSTREAM_TEXT,
  policyOf,
  redactionFindings,
  run,
  sha256Of,
} from './workflow-telemetry-redaction.test-support';
import type { CmsEditorialTelemetryEvent } from './types';
import { entryId, reviewId } from './workflow-fixtures.test-support';

/*
 * BE03b "Observability" and the redaction clause of CMS-03B-06, CMS-03B-07 and
 * CMS-03B-09 (P2-S11-AC-016, AC-022, AC-034): the one telemetry event of a
 * command carries only declared closed labels. It never carries an identifier,
 * a decision reason, a schedule instant, a hash, a person, a party, the
 * idempotency key or any upstream text, on success or on any refusal. The
 * CMS-03B-05 and CMS-03B-18 twins live in `workflow-command-facts.test.ts` and
 * `workflow-telemetry.test.ts`.
 */

describe.each(cases)('$operationId telemetry redaction', (operation) => {
  const policy = policyOf(operation.operationId);

  it.each(operation.scenarios)(
    'logs only closed labels for $title',
    async (scenario) => {
      const { event, response } = await run(operation, scenario);
      expect(response.status).toBe(scenario.status);
      expect(event).toMatchObject({
        operationId: operation.operationId,
        status: scenario.status,
        actorClass: 'human',
        rateClass: policy.rateClass,
        eventType: policy.eventType,
      });
      // Closed members, closed metric families, the published code, no secret.
      expect(
        redactionFindings(
          event,
          operation,
          response.status >= 400
            ? ((await response.json()) as { code: string }).code
            : null,
        ),
      ).toEqual([]);
    },
  );

  it('keeps the entry hash as the only identity of an accepted command', async () => {
    const { event } = await run(operation, operation.scenarios[0]!);
    expect(event.entityIdHash).toBe(`sha256:${await sha256Of(entryId)}`);
    expect(event.entityVersion).toBeUndefined();
  });

  it('logs no entry hash for a refusal, which names no entry', async () => {
    const refused = operation.scenarios.find(
      (scenario) => scenario.refusal !== undefined,
    )!;
    const { event } = await run(operation, refused);
    expect(event.entityIdHash).toBeUndefined();
  });
});

describe('the redaction check', () => {
  const decision = cases[0]!;
  const clean = async () => (await run(decision, decision.scenarios[0]!)).event;

  it('reports a leaked identifier, reason, upstream text, extra member, free-form label and foreign code', async () => {
    const event = await clean();
    expect(redactionFindings(event, decision, null)).toEqual([]);
    const leaky = {
      ...event,
      reviewId,
      errorCode: 'FORBIDDEN',
      metrics: {
        ...event.metrics,
        [`cms_review_decision_total{decision="${CONTENT_SECRET_REASON}",outcome="success"}`]: 1,
        [`cms_editorial_error_total{code="X",operation="${UPSTREAM_TEXT}"}`]: 1,
      },
    } as unknown as CmsEditorialTelemetryEvent;
    const findings = redactionFindings(leaky, decision, null);
    expect(findings).toEqual(
      expect.arrayContaining([
        'event member reviewId',
        'error code FORBIDDEN',
        `metric cms_review_decision_total{decision="${CONTENT_SECRET_REASON}",outcome="success"}`,
        'leaks the review id',
        'leaks the decision reason',
        'leaks the upstream text',
        'leaks the PII email',
      ]),
    );
  });

  it('rejects a preflight family on an operation that evaluates none', async () => {
    const event = await clean();
    const widened = {
      ...event,
      metrics: {
        ...event.metrics,
        'cms_preflight_result_total{category="contract",outcome="failed",phase="publish"}': 1,
      },
    } as CmsEditorialTelemetryEvent;
    expect(redactionFindings(widened, decision, null)).toEqual([
      'metric cms_preflight_result_total{category="contract",outcome="failed",phase="publish"}',
    ]);
  });
});

describe('CMS-03B-06 decision labels', () => {
  const decision = cases[0]!;

  it('counts the decision from the validated request and never from the reason', async () => {
    const approval = await run(decision, decision.scenarios[0]!);
    const rejection = await run(decision, decision.scenarios[1]!);
    expect(approval.event.metrics).toMatchObject({
      'cms_review_decision_total{decision="approve",outcome="success"}': 1,
    });
    expect(rejection.event.metrics).toMatchObject({
      'cms_review_decision_total{decision="reject",outcome="success"}': 1,
    });
  });

  it('counts only the closed invalidation reason for a committed dependency_changed refusal', async () => {
    const changed = decision.scenarios.find((scenario) =>
      scenario.title.includes('dependency_changed'),
    )!;
    const { event } = await run(decision, changed);
    expect(event.metrics).toMatchObject({
      'cms_review_invalidated_total{reason="dependency_changed"}': 1,
    });
    expect(JSON.stringify(event)).not.toContain(DEPENDENCY_HASH);
  });
});

describe('CMS-03B-07 and CMS-03B-09 preflight labels', () => {
  it('counts a refused schedule preflight by category, outcome and phase without its reason', async () => {
    const schedule = cases[1]!;
    const failed = schedule.scenarios.find(
      (scenario) => scenario.title === 'a failed preflight',
    )!;
    const { event } = await run(schedule, failed);
    expect(event.metrics).toMatchObject({
      'cms_preflight_result_total{category="contract",outcome="failed",phase="schedule"}': 1,
      'cms_preflight_result_total{category="schema",outcome="passed",phase="schedule"}': 1,
    });
    expect(JSON.stringify(event)).not.toContain('value_invalid');
  });

  it('counts a refused publish preflight by category, outcome and phase without its reason', async () => {
    const publish = cases[2]!;
    const failed = publish.scenarios.find(
      (scenario) => scenario.title === 'a failed preflight',
    )!;
    const { event } = await run(publish, failed);
    expect(event.metrics).toMatchObject({
      'cms_preflight_result_total{category="accessibility",outcome="failed",phase="publish"}': 1,
    });
    expect(JSON.stringify(event)).not.toContain('blocking_finding');
  });

  it('counts a separation_of_duties refusal by operation only', async () => {
    for (const operation of cases) {
      const refused = operation.scenarios.find((scenario) =>
        scenario.title.includes('separation_of_duties'),
      )!;
      const { event } = await run(operation, refused);
      expect(event.metrics).toMatchObject({
        [`cms_separation_of_duties_refusal_total{operation="${operation.operationId}"}`]: 1,
      });
    }
  });

  it('counts a lineage conflict as a bare counter', async () => {
    const publish = cases[2]!;
    const conflict = publish.scenarios.find((scenario) =>
      scenario.title.includes('publication_conflict'),
    )!;
    const { event } = await run(publish, conflict);
    expect(event.metrics).toMatchObject({
      cms_publication_lineage_conflict_total: 1,
    });
  });
});
