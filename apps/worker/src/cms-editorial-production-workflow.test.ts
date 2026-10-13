import { describe, expect, it } from 'vitest';

import { cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { accessibilityBindingHash } from './cms-editorial/a11y-structural';
import {
  entryId,
  idempotencyKey,
  reviewId,
} from './cms-editorial/workflow-fixtures.test-support';
import {
  commandCases,
  readCases,
  type CommandCase,
} from './cms-editorial/workflow-harness.test-support';
import {
  ORIGIN,
  gateInput,
  raised,
  rpcEdge,
  workflowApp,
  workflowResources,
} from './cms-editorial-production-workflow.test-support';
import { json } from './cms-editorial-production.test-support';
import {
  CMS_EDITORIAL_DEADLINE_MS,
  CMS_EDITORIAL_PRODUCTION_OPERATION_IDS,
  CMS_EDITORIAL_RATE_CLASS,
  CMS_EDITORIAL_RATE_LIMIT,
  CMS_EDITORIAL_RPC,
} from './cms-editorial-production-types';

/*
 * The Slice 11 operations through the real route -> production adapter chain:
 * the named RPC, the server-built request (context, evidence, validators), the
 * typed refusals the database raises or commits, and the registry parity of
 * every transport constant.
 */

const send = (
  app: ReturnType<typeof workflowApp>,
  testCase: CommandCase,
  headers: Record<string, string> = {},
) =>
  app.request(testCase.path, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'if-match': '"2"',
      ...headers,
    },
    body: JSON.stringify(testCase.body),
  });

const getRead = (app: ReturnType<typeof workflowApp>, path: string) =>
  app.request(path, { headers: { origin: ORIGIN } });

const policyOf = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

describe('transport constants follow the registry', () => {
  it('names an RPC, deadline, quota and rate class equal to each registry row', () => {
    for (const operationId of CMS_EDITORIAL_PRODUCTION_OPERATION_IDS) {
      const policy = policyOf(operationId);
      expect(CMS_EDITORIAL_DEADLINE_MS[operationId]).toBe(policy.timeoutMs);
      expect(CMS_EDITORIAL_RATE_CLASS[operationId]).toBe(policy.rateClass);
      expect(CMS_EDITORIAL_RATE_LIMIT[operationId]).toEqual({
        limit: policy.rateLimit,
        partyLimit: policy.partyRateLimit,
        windowSeconds: policy.rateWindowSeconds,
      });
      expect(CMS_EDITORIAL_RPC[operationId]).toMatch(/^cms_[a-z_]+$/u);
    }
    expect(new Set(Object.values(CMS_EDITORIAL_RPC)).size).toBe(
      CMS_EDITORIAL_PRODUCTION_OPERATION_IDS.length,
    );
  });
});

describe('commands bind the named RPC with a server-built request', () => {
  for (const testCase of commandCases)
    it(testCase.operationId, async () => {
      const edge = rpcEdge({
        [CMS_EDITORIAL_RPC[
          testCase.operationId as keyof typeof CMS_EDITORIAL_RPC
        ]]: () => json(workflowResources[testCase.operationId]),
      });
      const response = await send(workflowApp(edge.fetchImpl), testCase);
      expect(response.status).toBe(testCase.status);
      expect(await response.json()).toEqual(
        workflowResources[testCase.operationId],
      );
      const command = edge.calls.at(-1)!;
      expect(command.name).toBe(
        CMS_EDITORIAL_RPC[
          testCase.operationId as keyof typeof CMS_EDITORIAL_RPC
        ],
      );
      expect(command.headers).toMatchObject({
        'Accept-Profile': 'platform_api',
        'Content-Profile': 'platform_api',
        'X-Operation-Id': testCase.operationId,
        'X-Idempotency-Key': idempotencyKey,
        'If-Match': '"2"',
      });
      expect(command.request).toMatchObject({
        ...testCase.body,
        idempotencyKey,
        context: { stepUpVerified: true },
      });
      expect('evidence' in command.request).toBe(testCase.evidence);
    });
});

describe('accessibility proof reaches the command RPC', () => {
  const expected = async () => ({
    category: 'accessibility',
    providerKey: 'cms.a11y.structural',
    providerVersion: '1',
    outcome: 'healthy',
    blockingCount: 0,
    bindingHash: await accessibilityBindingHash({
      revisionId: gateInput.revisionId,
      revisionContentHash: gateInput.revisionContentHash,
      dependencyHash: gateInput.dependencyHash,
    }),
  });

  for (const testCase of commandCases.filter((item) => item.evidence))
    it(`${testCase.operationId} loads the revision then sends the verified evidence`, async () => {
      const edge = rpcEdge({
        [CMS_EDITORIAL_RPC[
          testCase.operationId as keyof typeof CMS_EDITORIAL_RPC
        ]]: () => json(workflowResources[testCase.operationId]),
      });
      await send(workflowApp(edge.fetchImpl), testCase);
      expect(edge.calls.map((call) => call.name)).toEqual([
        'cms_load_quality_gate_input',
        CMS_EDITORIAL_RPC[
          testCase.operationId as keyof typeof CMS_EDITORIAL_RPC
        ],
      ]);
      const [load, command] = edge.calls;
      expect(load!.request).toMatchObject({
        context: { requestId: expect.any(String) },
      });
      expect(Object.keys(load!.request).sort()).toEqual(
        testCase.operationId === 'CMS-03B-07'
          ? ['context', 'phase', 'revisionId']
          : ['context', 'entryId', 'phase', 'revisionId'],
      );
      expect(command!.request.evidence).toMatchObject(await expected());
    });

  it('sends null evidence when the revision cannot be loaded', async () => {
    const edge = rpcEdge({
      cms_load_quality_gate_input: () => raised('NOT_FOUND'),
      cms_submit_review: () => json(workflowResources['CMS-03B-05']),
    });
    const testCase = commandCases[0]!;
    expect((await send(workflowApp(edge.fetchImpl), testCase)).status).toBe(
      201,
    );
    expect(edge.calls.at(-1)!.request.evidence).toBeNull();
  });
});

describe('safe reads', () => {
  it('CMS-03B-15 loads the revision and passes the query and evidence', async () => {
    const edge = rpcEdge({
      cms_get_entry_workflow: () => json(workflowResources['CMS-03B-15']),
    });
    const response = await getRead(
      workflowApp(edge.fetchImpl),
      `/api/v1/cms/entries/${entryId}/workflow`,
    );
    expect(response.status).toBe(200);
    const read = edge.calls.at(-1)!;
    expect(read.request).toMatchObject({
      entryId,
      evidence: { category: 'accessibility', outcome: 'healthy' },
    });
    expect(read.headers['If-Match']).toBeUndefined();
    expect(read.headers['X-Idempotency-Key']).toBeUndefined();
  });

  it('CMS-03B-16 and CMS-03B-17 call their RPC with the bound review and query', async () => {
    const edge = rpcEdge({
      cms_get_editorial_review: () => json(workflowResources['CMS-03B-16']),
      cms_list_editorial_reviews: () => json(workflowResources['CMS-03B-17']),
    });
    const app = workflowApp(edge.fetchImpl);
    expect((await getRead(app, `/api/v1/cms/reviews/${reviewId}`)).status).toBe(
      200,
    );
    expect(
      (await getRead(app, '/api/v1/cms/reviews?state=open&limit=5')).status,
    ).toBe(200);
    expect(edge.calls[0]!.request).toMatchObject({ reviewId });
    expect(edge.calls[1]!.request).toMatchObject({
      scope: 'assigned',
      state: 'open',
      limit: 5,
    });
    expect('evidence' in edge.calls[0]!.request).toBe(false);
  });

  it('covers every read case', () => {
    expect(readCases.map((item) => item.operationId)).toEqual([
      'CMS-03B-15',
      'CMS-03B-16',
      'CMS-03B-17',
    ]);
  });
});

describe('idempotent replay', () => {
  it('marks a stored outcome without changing the response', async () => {
    const edge = rpcEdge({
      cms_submit_review: () =>
        json(workflowResources['CMS-03B-05'], 200, {
          'x-cms-idempotent-replay': 'true',
        }),
    });
    const response = await send(workflowApp(edge.fetchImpl), commandCases[0]!);
    expect(response.status).toBe(201);
    expect(response.headers.get('x-cms-idempotent-replay')).toBeNull();
  });
});
