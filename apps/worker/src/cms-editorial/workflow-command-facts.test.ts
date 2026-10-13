import { describe, expect, it } from 'vitest';

import {
  assignmentRevokeBody,
  decisionBody,
  entryId,
  reviewId,
  reviewResource,
  revisionId,
  scheduleBody,
  scheduleId,
  submitBody,
} from './workflow-fixtures.test-support';
import { postJson, workflowHarness } from './workflow-harness.test-support';

/*
 * What differs per Slice 11 command beyond the shared admission: the pre-RPC
 * accessibility proof, the response invariants that bind a resource to the
 * request that produced it, the validators it publishes and the closed
 * telemetry facts it logs.
 */

const submitPath = `/api/v1/cms/entries/${entryId}/reviews`;
const decisionPath = `/api/v1/cms/reviews/${reviewId}/decision`;
const assignmentPath = `/api/v1/cms/reviews/${reviewId}/assignments`;

describe('telemetry', () => {
  it('logs one redacted event with closed labels and the hashed entry', async () => {
    const { app, telemetry } = workflowHarness();
    await postJson(app, submitPath, submitBody);
    await Promise.resolve();
    expect(telemetry).toHaveBeenCalledTimes(1);
    const [event] = telemetry.mock.calls[0] as [Record<string, unknown>];
    expect(event).toMatchObject({
      operationId: 'CMS-03B-05',
      outcome: 'success',
      status: 201,
      rateClass: 'cms-review-write',
      eventType: 'cms.entry.review-changed.v1',
      traceSteps: [
        'cms.admission',
        'cms.authority',
        'cms.rate_limit',
        'cms.rpc',
        'cms.response',
      ],
    });
    expect(event.entityIdHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const serialized = JSON.stringify(event);
    for (const secret of [entryId, reviewId, revisionId, submitBody.frozenHash])
      expect(serialized).not.toContain(secret);
    expect(
      (event.metrics as Record<string, number>)[
        'cms_review_submitted_total{outcome="success",risk_class="ordinary"}'
      ],
    ).toBe(1);
  });

  it('labels a refused decision and a revoke from the validated request', async () => {
    const { app, telemetry } = workflowHarness({ mfaFresh: false });
    await postJson(app, decisionPath, decisionBody);
    await postJson(app, assignmentPath, assignmentRevokeBody);
    await Promise.resolve();
    const metrics = telemetry.mock.calls.map(
      (call) => (call[0] as { metrics: Record<string, number> }).metrics,
    );
    expect(
      metrics[0]![
        'cms_review_decision_total{decision="approve",outcome="denied"}'
      ],
    ).toBe(1);
    expect(
      metrics[1]![
        'cms_review_assignment_total{action="revoke",outcome="denied"}'
      ],
    ).toBe(1);
  });

  it('marks an exact-key replay without counting a second creation', async () => {
    const { app, telemetry } = workflowHarness({
      port: {
        submitReview: async () => ({
          ok: true as const,
          value: reviewResource,
          replayed: true as const,
        }),
      },
    });
    const response = await postJson(app, submitPath, submitBody);
    expect(response.status).toBe(201);
    await Promise.resolve();
    expect(telemetry).toHaveBeenCalledTimes(1);
  });
});

describe('clock', () => {
  it('falls back to the host clock when none is injected', async () => {
    const { app, ports } = workflowHarness({ omitClock: true });
    const response = await postJson(app, submitPath, submitBody);
    expect(response.status).toBe(201);
    expect(ports.submitReview).toHaveBeenCalledTimes(1);
  });
});

describe('Location', () => {
  it('names the schedule id only through the Location of the accepted schedule', async () => {
    const { app } = workflowHarness();
    const response = await postJson(
      app,
      '/api/v1/cms/publication-schedules',
      scheduleBody,
    );
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/publication-schedules/${scheduleId}`,
    );
  });
});
