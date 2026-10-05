/**
 * BE03a observability evidence: the review, assignment, grant and dry-run
 * lifecycle metrics named in the spec are emitted per request through the
 * telemetry sink as labelled counters, and neither the telemetry event nor
 * the structured log carries a reviewer, grantor or subject identifier.
 */
import { describe, expect, it } from 'vitest';

import {
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  assignRevokeBody,
  decisionResource,
  reviewResource,
} from './phase-02-slice-09-dec108-test-values';
import { productionTelemetry } from './production-telemetry';
import { error, ok } from './phase-02-slice-09-test-values';
import type { TelemetryEvent } from './types';

const lifecycle = (event: TelemetryEvent): Record<string, number> =>
  Object.fromEntries(
    Object.entries(event.metrics ?? {}).filter(([name]) =>
      name.startsWith('cms_'),
    ),
  );

const run = async (
  operationId: EvidenceOperationId,
  options: Parameters<typeof harnessFor>[1] = {},
  request: Parameters<typeof requestFor>[1] = {},
) => {
  const op = opFor(operationId);
  const harness = harnessFor(op, options);
  const response = await harness.app.request(requestFor(op, request));
  const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
  return { op, response, event, harness };
};

describe('BE03a review lifecycle metrics', () => {
  it('[P2-S09-AC-690] emits cms_schema_review_pending_total{riskClass} when a review is submitted, cms_schema_review_decision_total{decision} when a decision is recorded and cms_schema_review_age while a review is open', async () => {
    const submitted = await run('CMS-03A-11');
    expect(lifecycle(submitted.event)).toEqual({
      'cms_schema_review_pending_total{riskClass="ordinary"}': 1,
    });
    const approve = await run('CMS-03A-12');
    expect(lifecycle(approve.event)).toEqual({
      'cms_schema_review_decision_total{decision="approve"}': 1,
    });
    const reject = await run('CMS-03A-12', {
      port: ok({ ...decisionResource, decision: 'reject' }),
    });
    expect(lifecycle(reject.event)).toEqual({
      'cms_schema_review_decision_total{decision="reject"}': 1,
    });
    const read = await run('CMS-03A-13', { port: ok(reviewResource) });
    const age = lifecycle(read.event).cms_schema_review_age;
    const submittedAtMs = Date.parse(reviewResource.submittedAt);
    expect(age).toBe(Math.max(0, (1_788_345_600_000 - submittedAtMs) / 1000));
    const refused = await run('CMS-03A-12', {
      port: error(409, 'CONFLICT', 'stale', {}),
    });
    expect(lifecycle(refused.event)).toEqual({});
  });
});

describe('BE03a assignment, grant and dry-run metrics', () => {
  it('[P2-S09-AC-691] emits cms_schema_review_assignment_total{action,outcome} for assignments and cms_capability_grant_total{action,outcome} for grants', async () => {
    const created = await run('CMS-03A-14');
    expect(lifecycle(created.event)).toEqual({
      'cms_schema_review_assignment_total{action="create",outcome="success"}': 1,
    });
    const revoked = await run('CMS-03A-14', {}, { body: assignRevokeBody });
    expect(lifecycle(revoked.event)).toEqual({
      'cms_schema_review_assignment_total{action="revoke",outcome="success"}': 1,
    });
    const denied = await run('CMS-03A-14', {
      port: error(403, 'FORBIDDEN', 'no', { reasonCode: 'OWNER_REQUIRED' }),
    });
    expect(lifecycle(denied.event)).toEqual({
      'cms_schema_review_assignment_total{action="create",outcome="denied"}': 1,
    });
    const conflict = await run('CMS-03A-14', {
      port: error(409, 'CONFLICT', 'stale', {}),
    });
    expect(lifecycle(conflict.event)).toEqual({
      'cms_schema_review_assignment_total{action="create",outcome="conflict"}': 1,
    });
    const failed = await run('CMS-03A-14', {
      port: error(503, 'DEPENDENCY_UNAVAILABLE', 'down', {}),
    });
    expect(lifecycle(failed.event)).toEqual({
      'cms_schema_review_assignment_total{action="create",outcome="failed"}': 1,
    });
    for (const [operationId, action] of [
      ['CMS-03A-15', 'granted'],
      ['CMS-03A-16', 'renewed'],
      ['CMS-03A-17', 'revoked'],
    ] as const) {
      const success = await run(operationId);
      expect(lifecycle(success.event)).toEqual({
        [`cms_capability_grant_total{action="${action}",outcome="success"}`]: 1,
      });
      const refused = await run(operationId, {
        port: error(403, 'FORBIDDEN', 'no', { reasonCode: 'OWNER_REQUIRED' }),
      });
      expect(lifecycle(refused.event)).toEqual({
        [`cms_capability_grant_total{action="${action}",outcome="denied"}`]: 1,
      });
    }
  });

  it('[P2-S09-AC-692] emits cms_schema_dry_run_total{state,classification} for every dry-run attempt', async () => {
    const queued = await run('CMS-03A-10');
    expect(lifecycle(queued.event)).toEqual({
      'cms_schema_dry_run_total{classification="additive",state="queued"}': 1,
    });
  });
});

describe('BE03a metric privacy', () => {
  it('[P2-S09-AC-695] logs and metrics never include reviewer, grantor, reviewerPersonId or subjectPersonId identifiers', async () => {
    const infos: unknown[] = [];
    const sink = productionTelemetry({
      info: (value: unknown) => infos.push(value),
    } as never);
    for (const operationId of [
      'CMS-03A-12',
      'CMS-03A-14',
      'CMS-03A-15',
      'CMS-03A-16',
      'CMS-03A-17',
    ] as const) {
      const { event, op, response } = await run(operationId);
      expect(response.status).toBe(op.status);
      sink(event);
    }
    const text = JSON.stringify(infos);
    expect(infos.length).toBeGreaterThan(0);
    expect(text).toContain('cms_capability_grant_total');
    for (const identifier of [
      'reviewerPersonId',
      'subjectPersonId',
      'grantorPersonId',
    ])
      expect(text).not.toContain(identifier);
    const subjectUuid = (
      opFor('CMS-03A-15').body as { subjectPersonId: string }
    ).subjectPersonId;
    const reviewerUuid = (
      opFor('CMS-03A-14').body as { reviewerPersonId: string }
    ).reviewerPersonId;
    expect(text).not.toContain(subjectUuid);
    expect(text).not.toContain(reviewerUuid);
  });
});
