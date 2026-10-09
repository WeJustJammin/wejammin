import { describe, expect, it } from 'vitest';

import {
  approvedReviewResource,
  assignmentCreateBody,
  assignmentId,
  assignmentResource,
  assignmentRevokeBody,
  decisionBody,
  entryId,
  evidence,
  previewBody,
  previewResource,
  publicationBody,
  publicationResource,
  reviewId,
  reviewResource,
  revisionId,
  scheduleBody,
  scheduleResource,
  submitBody,
} from './workflow-fixtures.test-support';
import {
  errorBody,
  postJson,
  workflowHarness,
} from './workflow-harness.test-support';

/*
 * What differs per Slice 11 command beyond the shared admission: the pre-RPC
 * accessibility proof, the response invariants that bind a resource to the
 * request that produced it, the validators it publishes and the closed
 * telemetry facts it logs.
 */

const submitPath = `/api/v1/cms/entries/${entryId}/reviews`;
const decisionPath = `/api/v1/cms/reviews/${reviewId}/decision`;
const assignmentPath = `/api/v1/cms/reviews/${reviewId}/assignments`;
const ok =
  <T>(value: T) =>
  async () => ({ ok: true as const, value });

describe('accessibility proof (CMS-03B-05, -07, -09)', () => {
  it('runs the submit-phase gate for the named entry and revision and hands the proof to the port', async () => {
    const { app, ports, qualityGate } = workflowHarness();
    await postJson(app, submitPath, submitBody);
    const gateInput = qualityGate.mock.calls[0]?.[0];
    expect(gateInput).toMatchObject({
      phase: 'submit',
      entryId,
      revisionId,
    });
    const [portInput] = ports.submitReview!.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(portInput.evidence).toEqual(evidence);
  });

  it('names only the revision at schedule acceptance and the entry at publication', async () => {
    const { app, qualityGate } = workflowHarness();
    await postJson(app, '/api/v1/cms/publication-schedules', scheduleBody);
    await postJson(app, '/api/v1/cms/publications', publicationBody);
    expect(qualityGate.mock.calls.map((call) => call[0])).toMatchObject([
      { phase: 'schedule', entryId: null, revisionId },
      { phase: 'publish', entryId, revisionId },
    ]);
  });

  it('passes a null proof when no gate is composed, the gate reports none, or it throws', async () => {
    for (const options of [
      { omitQualityGate: true },
      { qualityGate: async () => null },
      {
        qualityGate: async () => {
          throw new Error('checker crashed');
        },
      },
    ]) {
      const { app, ports } = workflowHarness(options);
      const response = await postJson(app, submitPath, submitBody);
      expect(response.status).toBe(201);
      const [portInput] = ports.submitReview!.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(portInput.evidence).toBeNull();
    }
  });

  it('does not run the gate for a refused request or a command without preflight', async () => {
    const { app, qualityGate } = workflowHarness({ rateAllowed: false });
    await postJson(app, submitPath, submitBody);
    expect(qualityGate).not.toHaveBeenCalled();
    const ready = workflowHarness();
    await postJson(ready.app, decisionPath, decisionBody);
    await postJson(ready.app, '/api/v1/cms/previews', previewBody);
    await postJson(ready.app, assignmentPath, assignmentCreateBody);
    expect(ready.qualityGate).not.toHaveBeenCalled();
  });

  it('reports the RPC stage once the gate has loaded the revision, even when the port is never reached', async () => {
    const { app, telemetry } = workflowHarness({
      deadlineMs: 20,
      qualityGate: () => new Promise(() => undefined),
    });
    await postJson(app, submitPath, submitBody);
    await Promise.resolve();
    expect(
      (telemetry.mock.calls[0]![0] as { traceSteps: string[] }).traceSteps,
    ).toContain('cms.rpc');
    const refused = workflowHarness({ rateAllowed: false });
    await postJson(refused.app, submitPath, submitBody);
    await Promise.resolve();
    expect(
      (refused.telemetry.mock.calls[0]![0] as { traceSteps: string[] })
        .traceSteps,
    ).not.toContain('cms.rpc');
  });

  it('answers a gate that outlives the route deadline as a gateway timeout', async () => {
    const { app, ports } = workflowHarness({
      deadlineMs: 20,
      qualityGate: () => new Promise(() => undefined),
    });
    const response = await postJson(app, submitPath, submitBody);
    expect(response.status).toBe(504);
    expect(ports.submitReview).not.toHaveBeenCalled();
  });
});

describe('response invariants bind the resource to the request', () => {
  const refused = async (
    path: string,
    body: unknown,
    port: string,
    value: unknown,
  ) => {
    const { app } = workflowHarness({ port: { [port]: ok(value) } as never });
    const response = await postJson(app, path, body);
    expect(response.status).toBe(502);
    expect((await errorBody(response)).code).toBe('BAD_GATEWAY');
  };

  it('CMS-03B-05 refuses another entry, another revision or a review that is not open', async () => {
    const other = '123e4567-e89b-42d3-a456-4266141740aa';
    for (const value of [
      { ...reviewResource, entryId: other },
      { ...reviewResource, revisionId: other },
      {
        ...reviewResource,
        state: 'approved',
        decidedAt: '2026-10-09T12:00:00Z',
      },
    ])
      await refused(submitPath, submitBody, 'submitReview', value);
  });

  it('CMS-03B-06 refuses another review and an invalidated one', async () => {
    for (const value of [
      { ...approvedReviewResource, id: assignmentId },
      {
        ...approvedReviewResource,
        state: 'invalidated',
        invalidatedReason: 'dependency_changed',
        decidedAt: null,
      },
    ])
      await refused(decisionPath, decisionBody, 'recordDecision', value);
  });

  it('CMS-03B-06 accepts an open, approved or rejected review', async () => {
    for (const value of [
      { ...reviewResource, version: '2', recordedDecisionCount: 0 },
      approvedReviewResource,
      {
        ...approvedReviewResource,
        state: 'rejected',
      },
    ]) {
      const { app } = workflowHarness({ port: { recordDecision: ok(value) } });
      const response = await postJson(app, decisionPath, decisionBody);
      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe(`"${value.version}"`);
    }
  });

  it('CMS-03B-07 refuses a schedule that differs from the request in any time member', async () => {
    for (const patch of [
      { state: 'executing' },
      { revisionId: entryId },
      { action: 'unpublish' },
      { localDateTime: '2026-11-01T10:30:00' },
      { timezone: 'Europe/Paris' },
      { resolvedUtc: '2026-11-01T15:30:00Z' },
      { tzdbVersion: '2025b' },
      { disambiguation: 'earlier' },
      { audience: 'press' },
    ])
      await refused(
        '/api/v1/cms/publication-schedules',
        scheduleBody,
        'schedulePublication',
        { ...scheduleResource, ...patch },
      );
  });

  it('CMS-03B-08 refuses a token bound to anything the caller did not ask for', async () => {
    for (const patch of [
      { entryId: reviewId },
      { revisionId: reviewId },
      { locale: 'fr-FR' },
      { audience: 'press' },
      { route: '/other' },
      { revoked: true },
      { versionSet: { ...previewResource.versionSet, settingsVersion: '9' } },
    ])
      await refused('/api/v1/cms/previews', previewBody, 'mintPreview', {
        ...previewResource,
        ...patch,
      });
  });

  it('CMS-03B-09 refuses another entry, revision, audience or a non-publish row', async () => {
    for (const patch of [
      { entryId: reviewId },
      { revisionId: reviewId },
      { audience: 'press' },
      { action: 'unpublish', state: 'revoked' },
    ])
      await refused(
        '/api/v1/cms/publications',
        publicationBody,
        'publishRevision',
        { ...publicationResource, ...patch },
      );
  });

  it('CMS-03B-09 accepts a superseded replay of the publish row', async () => {
    const { app } = workflowHarness({
      port: {
        publishRevision: ok({ ...publicationResource, state: 'superseded' }),
      },
    });
    const response = await postJson(
      app,
      '/api/v1/cms/publications',
      publicationBody,
    );
    expect(response.status).toBe(202);
  });

  it('CMS-03B-18 refuses another review, a wrong state and a wrong revoked assignment', async () => {
    await refused(
      assignmentPath,
      assignmentCreateBody,
      'assignEditorialReviewer',
      {
        ...assignmentResource,
        reviewId: entryId,
      },
    );
    await refused(
      assignmentPath,
      assignmentCreateBody,
      'assignEditorialReviewer',
      {
        ...assignmentResource,
        state: 'revoked',
      },
    );
    for (const patch of [{ state: 'active' }, { id: reviewId }])
      await refused(
        assignmentPath,
        assignmentRevokeBody,
        'assignEditorialReviewer',
        { ...assignmentResource, state: 'revoked', ...patch },
      );
  });
});

describe('published validators', () => {
  it('CMS-03B-18 answers a revoke 200 with the ETag and no Location', async () => {
    const { app } = workflowHarness({
      port: {
        assignEditorialReviewer: ok({
          ...assignmentResource,
          state: 'revoked',
          version: '2',
        }),
      },
    });
    const response = await postJson(app, assignmentPath, assignmentRevokeBody);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('location')).toBeNull();
  });

  it('CMS-03B-08 publishes the token once and neither validator nor log keeps it', async () => {
    const { app, telemetry } = workflowHarness();
    const response = await postJson(app, '/api/v1/cms/previews', previewBody);
    expect(((await response.json()) as { token: string }).token).toBe(
      previewResource.token,
    );
    await Promise.resolve();
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain(
      previewResource.token,
    );
  });
});
