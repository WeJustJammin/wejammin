import { describe, expect, it } from 'vitest';

import {} from '@wejammin/contracts';

import {
  entryId,
  evidence,
  queueItem,
  queuePage,
  reviewDetailResource,
  reviewId,
  userId,
  workflowResource,
} from './workflow-fixtures.test-support';
import {
  errorBody,
  getJson,
  postJson,
  workflowHarness,
} from './workflow-harness.test-support';

/*
 * The admission contract of the Slice 11 safe reads (CMS-03B-15, -16, -17):
 * BE00 order, closed query keys, no request media or mutation guard, the
 * database-owned read scope (no coarse Worker gate), a strong no-store ETag and
 * the declared bounded error matrix.
 */

describe('CMS-03B-15 workflow read', () => {
  const path = `/api/v1/cms/entries/${entryId}/workflow`;

  it('hands the port the bound entry, the optional revision and the accessibility proof', async () => {
    const { app, ports, qualityGate } = workflowHarness();
    const revisionId = workflowResource.revision.id;
    await getJson(app, `${path}?revisionId=${revisionId}`);
    expect(qualityGate.mock.calls[0]![0]).toMatchObject({
      phase: 'workflow_read',
      entryId,
      revisionId,
    });
    expect(ports.getEntryWorkflow!.mock.calls[0]![0]).toMatchObject({
      operationId: 'CMS-03B-15',
      path: { entryId },
      query: { entryId, revisionId },
      evidence,
    });
    await getJson(app, path);
    expect(qualityGate.mock.calls[1]![0]).toMatchObject({ revisionId: null });
  });

  it('answers a gate that outlives the route deadline as a gateway timeout', async () => {
    const { app, ports } = workflowHarness({
      deadlineMs: 20,
      qualityGate: () => new Promise(() => undefined),
    });
    expect((await getJson(app, path)).status).toBe(504);
    expect(ports.getEntryWorkflow).not.toHaveBeenCalled();
  });

  it('refuses a revision query that is not a UUID', async () => {
    const { app } = workflowHarness();
    const response = await getJson(app, `${path}?revisionId=nope`);
    expect(response.status).toBe(400);
    expect((await errorBody(response)).details).toMatchObject({
      violations: [{ path: '/revisionId' }],
    });
  });

  it('binds the entry, revision, review and caller into a strong validator', async () => {
    const { app } = workflowHarness({
      port: {
        getEntryWorkflow: async () => ({
          ok: true as const,
          value: { ...workflowResource, schedules: [] },
        }),
      },
    });
    const first = await getJson(app, path);
    const again = await getJson(app, path);
    expect(first.headers.get('etag')).toBe(again.headers.get('etag'));
    expect(first.headers.get('etag')).toMatch(
      new RegExp(
        `^"${entryId}:7:${workflowResource.revision.id}:0:0:[0-9a-f]{64}"$`,
        'u',
      ),
    );
    const other = workflowHarness({ actingPartyId: null });
    const scoped = await getJson(other.app, path);
    expect(scoped.headers.get('etag')).not.toBe(first.headers.get('etag'));
    expect(userId).toBeTruthy();
  });

  it('names the latest review in the validator', async () => {
    const review = {
      ...reviewDetailResource,
      frozen: reviewDetailResource.frozen,
    };
    const { app } = workflowHarness({
      port: {
        getEntryWorkflow: async () => ({
          ok: true as const,
          value: {
            ...workflowResource,
            preparation: null,
            review: {
              id: review.id,
              version: review.version,
              createdAt: review.createdAt,
              updatedAt: review.updatedAt,
              state: review.state,
              entryId: review.entryId,
              revisionId: review.revisionId,
              riskClass: review.riskClass,
              workflowPolicy: review.workflowPolicy,
              activationEvidence: review.activationEvidence,
              frozenHash: review.frozenHash,
              requiredDecisionCount: review.requiredDecisionCount,
              recordedDecisionCount: review.recordedDecisionCount,
              dependencyHash: review.dependencyHash,
              invalidatedReason: review.invalidatedReason,
              submittedAt: review.submittedAt,
              decidedAt: review.decidedAt,
              frozen: review.frozen,
            },
          },
        }),
      },
    });
    const response = await getJson(app, path);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toContain(`:${reviewId}:1:`);
  });

  it('refuses a workflow of another entry or another revision', async () => {
    const other = '123e4567-e89b-42d3-a456-4266141740aa';
    const foreign = workflowHarness({
      port: {
        getEntryWorkflow: async () => ({
          ok: true as const,
          value: {
            ...workflowResource,
            entry: { ...workflowResource.entry, id: other },
          },
        }),
      },
    });
    expect((await getJson(foreign.app, path)).status).toBe(502);
    const wrongRevision = await getJson(
      workflowHarness().app,
      `${path}?revisionId=${other}`,
    );
    expect(wrongRevision.status).toBe(502);
  });

  it('counts the served preflight categories and bounded lists', async () => {
    const { app, telemetry } = workflowHarness();
    await getJson(app, path);
    await Promise.resolve();
    const metrics = (
      telemetry.mock.calls[0]![0] as { metrics: Record<string, number> }
    ).metrics;
    expect(metrics.schedules_returned).toBe(0);
    expect(
      metrics[
        'cms_preflight_result_total{category="accessibility",outcome="passed",phase="workflow_read"}'
      ],
    ).toBe(1);
  });

  it('reports no preflight facts for a revision without a preparation', async () => {
    const { app, telemetry } = workflowHarness({
      port: {
        getEntryWorkflow: async () => ({
          ok: true as const,
          value: {
            ...workflowResource,
            preparation: null,
            permittedNextActions: [],
          },
        }),
      },
    });
    expect((await getJson(app, path)).status).toBe(200);
    await Promise.resolve();
    const metrics = (
      telemetry.mock.calls[0]![0] as { metrics: Record<string, number> }
    ).metrics;
    expect(
      Object.keys(metrics).some((key) => key.startsWith('cms_preflight')),
    ).toBe(false);
  });
});

describe('CMS-03B-16 review detail', () => {
  const path = `/api/v1/cms/reviews/${reviewId}`;

  it('publishes the review version as the strong validator', async () => {
    const { app } = workflowHarness();
    const response = await getJson(app, path);
    expect(response.headers.get('etag')).toBe(
      `"${reviewDetailResource.version}"`,
    );
  });

  it('refuses a detail of another review', async () => {
    const { app } = workflowHarness({
      port: {
        getEditorialReview: async () => ({
          ok: true as const,
          value: { ...reviewDetailResource, id: entryId },
        }),
      },
    });
    expect((await getJson(app, path)).status).toBe(502);
  });

  it('accepts no query key at all', async () => {
    const { app } = workflowHarness();
    expect((await getJson(app, `${path}?x=1`)).status).toBe(400);
  });
});

describe('CMS-03B-17 reviewer queue', () => {
  const path = '/api/v1/cms/reviews';
  const portInput = async (query: string) => {
    const { app, ports } = workflowHarness();
    const response = await getJson(app, `${path}${query}`);
    return { response, input: ports.listEditorialReviews!.mock.calls[0]?.[0] };
  };

  it('applies the defaults: scope assigned and 25 rows', async () => {
    const { response, input } = await portInput('');
    expect(response.status).toBe(200);
    expect(input).toMatchObject({
      operationId: 'CMS-03B-17',
      query: { scope: 'assigned', limit: 25 },
    });
  });

  it('forwards the closed filters, the cursor and the numeric limit', async () => {
    const { input } = await portInput(
      '?scope=submitted&state=approved&limit=50&cursor=abc',
    );
    expect(input).toMatchObject({
      query: {
        scope: 'submitted',
        state: 'approved',
        limit: 50,
        cursor: 'abc',
      },
    });
  });

  it.each([
    '?limit=0',
    '?limit=51',
    '?limit=01',
    '?limit=abc',
    '?limit=1.5',
    '?cursor=',
    `?cursor=${'x'.repeat(513)}`,
  ])('refuses a structurally malformed pager %s as 400', async (query) => {
    const { response } = await portInput(query);
    expect(response.status).toBe(400);
  });

  it.each(['?scope=all', '?state=pending'])(
    'refuses an out-of-vocabulary filter %s as 400',
    async (query) => {
      const { response } = await portInput(query);
      expect(response.status).toBe(400);
      expect((await errorBody(response)).details).toMatchObject({
        violations: [{ message: 'The value is invalid.' }],
      });
    },
  );

  it('publishes the page version as the validator and counts the rows', async () => {
    const { app, telemetry } = workflowHarness();
    const response = await getJson(app, path);
    expect(response.headers.get('etag')).toBe('"5"');
    await Promise.resolve();
    expect(
      (telemetry.mock.calls[0]![0] as { metrics: Record<string, number> })
        .metrics.items_returned,
    ).toBe(1);
  });

  it('answers the dependency cursor conflict as a refreshable conflict', async () => {
    const { app } = workflowHarness({
      port: {
        listEditorialReviews: async () => ({
          ok: false as const,
          status: 409 as const,
          code: 'CONFLICT',
          message: 'private',
          details: {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'refresh',
          },
        }),
      },
    });
    const response = await getJson(app, `${path}?cursor=stale`);
    expect(response.status).toBe(409);
    expect((await errorBody(response)).details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });

  it('declares no 403 or 404: a hidden-population probe is a scrubbed 500', async () => {
    for (const status of [403, 404] as const) {
      const { app } = workflowHarness({
        port: {
          listEditorialReviews: async () => ({
            ok: false as const,
            status,
            code: 'X',
            message: 'private',
          }),
        },
      });
      expect((await getJson(app, path)).status).toBe(500);
    }
  });

  it.each([
    ['too many rows', { items: [queueItem, queueItem], limit: 1 }],
    ['an empty cursor', { nextCursor: '' }],
  ])('refuses a page with %s', async (_name, patch) => {
    const { limit, ...override } = patch as { limit?: number } & Record<
      string,
      unknown
    >;
    const { app } = workflowHarness({
      port: {
        listEditorialReviews: async () => ({
          ok: true as const,
          value: { ...queuePage, ...override },
        }),
      },
    });
    const response = await getJson(
      app,
      `${path}${limit === undefined ? '' : `?limit=${limit}`}`,
    );
    expect(response.status).toBe(502);
  });

  it('refuses a row outside the asked state and an assignment end on the submitted scope', async () => {
    const outside = workflowHarness({
      port: {
        listEditorialReviews: async () => ({
          ok: true as const,
          value: { ...queuePage, items: [{ ...queueItem, state: 'approved' }] },
        }),
      },
    });
    expect((await getJson(outside.app, `${path}?state=open`)).status).toBe(502);
    const submitted = workflowHarness();
    expect(
      (await getJson(submitted.app, `${path}?scope=submitted`)).status,
    ).toBe(502);
    const ok = workflowHarness({
      port: {
        listEditorialReviews: async () => ({
          ok: true as const,
          value: {
            ...queuePage,
            items: [{ ...queueItem, assignmentEndsAt: null }],
          },
        }),
      },
    });
    expect((await getJson(ok.app, `${path}?scope=submitted`)).status).toBe(200);
  });

  it('is not a command route', async () => {
    const { app } = workflowHarness();
    const response = await postJson(app, path, {});
    expect([404, 405]).toContain(response.status);
  });
});
