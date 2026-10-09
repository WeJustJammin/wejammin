import { describe, expect, it, vi } from 'vitest';

import {
  assignmentCreateBody,
  decisionBody,
  entryId,
  evidence,
  previewBody,
  publicationBody,
  reviewId,
  scheduleBody,
  submitBody,
} from './cms-editorial/workflow-fixtures.test-support';
import {
  compose,
  json,
  portInput,
  REQUEST_ID,
} from './cms-editorial-production.test-support';
import { workflowResources } from './cms-editorial-production-workflow.test-support';
import type { CmsEditorialProductionOperationId } from './cms-editorial-production-types';

/*
 * The adapter never trusts its input shape: whatever calls a Slice 11 port is
 * checked against the operation's transport contract before any RPC is issued,
 * so a route bug can neither widen what the database receives nor forge the
 * server-built accessibility proof.
 */

type Baseline = Readonly<{
  operationId: CmsEditorialProductionOperationId;
  port: string;
  method: 'GET' | 'POST';
  input: Record<string, unknown>;
}>;

const command = {
  idempotencyKey: 'idempotency-key-0001',
  ifMatch: '2',
};

const baselines: readonly Baseline[] = [
  {
    operationId: 'CMS-03B-05',
    port: 'submitReview',
    method: 'POST',
    input: { path: { entryId }, body: submitBody, ...command, evidence: null },
  },
  {
    operationId: 'CMS-03B-06',
    port: 'recordDecision',
    method: 'POST',
    input: { path: { reviewId }, body: decisionBody, ...command },
  },
  {
    operationId: 'CMS-03B-07',
    port: 'schedulePublication',
    method: 'POST',
    input: { path: undefined, body: scheduleBody, ...command, evidence },
  },
  {
    operationId: 'CMS-03B-08',
    port: 'mintPreview',
    method: 'POST',
    input: { path: undefined, body: previewBody, ...command },
  },
  {
    operationId: 'CMS-03B-09',
    port: 'publishRevision',
    method: 'POST',
    input: {
      path: undefined,
      body: publicationBody,
      ...command,
      evidence: null,
    },
  },
  {
    operationId: 'CMS-03B-15',
    port: 'getEntryWorkflow',
    method: 'GET',
    input: {
      path: { entryId },
      query: { entryId },
      body: undefined,
      idempotencyKey: undefined,
      ifMatch: undefined,
      evidence: null,
    },
  },
  {
    operationId: 'CMS-03B-16',
    port: 'getEditorialReview',
    method: 'GET',
    input: {
      path: { reviewId },
      body: undefined,
      idempotencyKey: undefined,
      ifMatch: undefined,
    },
  },
  {
    operationId: 'CMS-03B-17',
    port: 'listEditorialReviews',
    method: 'GET',
    input: {
      path: undefined,
      query: { scope: 'assigned', limit: 25 },
      body: undefined,
      idempotencyKey: undefined,
      ifMatch: undefined,
    },
  },
  {
    operationId: 'CMS-03B-18',
    port: 'assignEditorialReviewer',
    method: 'POST',
    input: { path: { reviewId }, body: assignmentCreateBody, ...command },
  },
];

const requestFor = (method: 'GET' | 'POST'): Request =>
  new Request('https://api.example.test/api/v1/cms/x', {
    method,
    headers: { 'x-request-id': REQUEST_ID },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });

const attempt = async (
  baseline: Baseline,
  patch: Record<string, unknown> = {},
  method: 'GET' | 'POST' = baseline.method,
) => {
  const fetchImpl = vi.fn(async () =>
    json(workflowResources[baseline.operationId]),
  );
  const ports = compose(fetchImpl as unknown as typeof fetch)
    .ports as unknown as Record<
    string,
    (
      input: unknown,
      signal: AbortSignal,
    ) => Promise<{
      ok: boolean;
      status?: number;
      details?: Record<string, unknown>;
    }>
  >;
  const result = await ports[baseline.port]!(
    portInput({
      operationId: baseline.operationId,
      request: requestFor(method),
      ...baseline.input,
      ...patch,
    }),
    new AbortController().signal,
  );
  return { result, fetchImpl };
};

describe('a valid input reaches the RPC', () => {
  for (const baseline of baselines)
    it(baseline.operationId, async () => {
      const { result, fetchImpl } = await attempt(baseline);
      expect(result.ok).toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});

describe('a malformed transport shape is refused before any RPC', () => {
  const refused = async (
    baseline: Baseline,
    patch: Record<string, unknown>,
    method?: 'GET' | 'POST',
  ) => {
    const { result, fetchImpl } = await attempt(baseline, patch, method);
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      details: { reasonCode: 'workflow_precondition_invalid' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  };

  for (const baseline of baselines) {
    it(`${baseline.operationId} refuses the wrong method`, () =>
      refused(baseline, {}, baseline.method === 'GET' ? 'POST' : 'GET'));
    it(`${baseline.operationId} refuses a path with an extra key or a non-UUID value`, async () => {
      await refused(baseline, { path: { entryId, reviewId, extra: entryId } });
      await refused(baseline, { path: { entryId: 'nope', reviewId: 'nope' } });
    });
  }

  for (const baseline of baselines.filter((item) => item.method === 'POST')) {
    it(`${baseline.operationId} refuses a command without body, key or validator`, async () => {
      await refused(baseline, { body: undefined });
      await refused(baseline, { idempotencyKey: undefined });
      await refused(baseline, { ifMatch: undefined });
      await refused(baseline, { query: { x: 1 } });
    });
  }

  for (const baseline of baselines.filter((item) => item.method === 'GET'))
    it(`${baseline.operationId} refuses a read that carries a body or a mutation guard`, async () => {
      await refused(baseline, { body: {} });
      await refused(baseline, { idempotencyKey: 'idempotency-key-0001' });
      await refused(baseline, { ifMatch: '2' });
    });

  for (const baseline of baselines.filter((item) =>
    ['CMS-03B-05', 'CMS-03B-07', 'CMS-03B-09', 'CMS-03B-15'].includes(
      item.operationId,
    ),
  ))
    it(`${baseline.operationId} requires the accessibility proof member, valid when present`, async () => {
      await refused(baseline, { evidence: undefined });
      await refused(baseline, { evidence: { ...evidence, outcome: 'passed' } });
      await refused(baseline, { evidence: { ...evidence, extra: 1 } });
    });

  for (const baseline of baselines.filter(
    (item) => !('evidence' in item.input),
  ))
    it(`${baseline.operationId} refuses a proof it never evaluates`, async () => {
      await refused(baseline, { evidence: null });
      await refused(baseline, { evidence });
    });

  it('CMS-03B-15 binds the query entry to the path entry', async () => {
    const baseline = baselines.find(
      (item) => item.operationId === 'CMS-03B-15',
    )!;
    await refused(baseline, { query: { entryId: reviewId } });
    await refused(baseline, { query: undefined });
    await refused(baseline, { query: { entryId, extra: 1 } });
  });

  it('CMS-03B-16 takes no query and CMS-03B-17 only a valid one', async () => {
    await refused(
      baselines.find((item) => item.operationId === 'CMS-03B-16')!,
      { query: { x: 1 } },
    );
    const queue = baselines.find((item) => item.operationId === 'CMS-03B-17')!;
    await refused(queue, { query: { scope: 'all' } });
    await refused(queue, { query: { limit: 99 } });
    const { result } = await attempt(queue, { query: undefined });
    expect(result.ok).toBe(true);
  });
});

describe('CMS-03B-06 names the review twice', () => {
  it('refuses a body review that differs from the path review as 422', async () => {
    const baseline = baselines.find(
      (item) => item.operationId === 'CMS-03B-06',
    )!;
    const { result, fetchImpl } = await attempt(baseline, {
      body: { ...decisionBody, reviewId: entryId },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      details: {
        reasonCode: 'review_id_mismatch',
        violations: [{ path: '/reviewId', code: 'mismatch' }],
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the server-built proof follows the browser members', () => {
  it('sends the evidence as the last body member, never shadowed', async () => {
    const baseline = baselines[0]!;
    const { fetchImpl } = await attempt(baseline, { evidence });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const request = (
      JSON.parse(String(call[1].body)) as {
        p_request: Record<string, unknown>;
      }
    ).p_request;
    expect(request.evidence).toEqual(evidence);
    expect(Object.keys(request).at(-2)).toBe('evidence');
  });
});
