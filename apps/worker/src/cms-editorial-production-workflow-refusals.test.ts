import { describe, expect, it } from 'vitest';

import {} from '@wejammin/contracts';

import {} from './cms-editorial/a11y-structural';
import {
  hash,
  hash2,
  idempotencyKey,
  reviewId,
} from './cms-editorial/workflow-fixtures.test-support';
import {
  commandCases,
  type CommandCase,
} from './cms-editorial/workflow-harness.test-support';
import {
  ORIGIN,
  raised,
  rpcEdge,
  workflowApp,
  workflowResources,
} from './cms-editorial-production-workflow.test-support';
import { json } from './cms-editorial-production.test-support';
import { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';

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

describe('typed refusals the database raises', () => {
  const refuse = async (
    testCase: CommandCase,
    refusal: Response,
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const edge = rpcEdge({
      [CMS_EDITORIAL_RPC[
        testCase.operationId as keyof typeof CMS_EDITORIAL_RPC
      ]]: () => refusal,
    });
    const response = await send(workflowApp(edge.fetchImpl), testCase);
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };
  const byId = (id: string) =>
    commandCases.find((item) => item.operationId === id)!;

  it('403 capability_missing and separation_of_duties', async () => {
    const denied = await refuse(
      byId('CMS-03B-06'),
      raised('capability_missing'),
    );
    expect(denied.status).toBe(403);
    expect(denied.body.details).toEqual({ reasonCode: 'capability_missing' });
    const separated = await refuse(
      byId('CMS-03B-09'),
      raised('separation_of_duties'),
    );
    expect(separated.status).toBe(403);
    expect(separated.body.details).toEqual({
      reasonCode: 'separation_of_duties',
    });
  });

  it('401 STEP_UP_REQUIRED with the allowed methods', async () => {
    const refused = await refuse(
      byId('CMS-03B-07'),
      raised('STEP_UP_REQUIRED'),
    );
    expect(refused.status).toBe(401);
    expect(refused.body.code).toBe('STEP_UP_REQUIRED');
    expect(refused.body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
  });

  it('422 preflight_failed carries bare entries from an object DETAIL', async () => {
    const preflight = [
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
    ];
    const refused = await refuse(
      byId('CMS-03B-09'),
      raised('preflight_failed', { preflight, secret: 'x' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details).toEqual({
      reasonCode: 'preflight_failed',
      preflight,
    });
  });

  it('409 dependency_changed with the hash, and a stale operand with safe versions', async () => {
    const changed = await refuse(
      byId('CMS-03B-05'),
      raised('dependency_changed', { dependencyHash: hash2 }),
    );
    expect(changed.body.details).toEqual({
      reasonCode: 'dependency_changed',
      dependencyHash: hash2,
    });
    const stale = await refuse(
      byId('CMS-03B-06'),
      raised('VERSION_MISMATCH', { expectedVersion: '2', currentVersion: '5' }),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.details).toEqual({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
      expectedVersion: '2',
      currentVersion: '5',
    });
  });

  it('422 time-authority RPC recheck keeps the pinned release', async () => {
    const refused = await refuse(
      byId('CMS-03B-07'),
      raised('tzdb_version_mismatch', { pinnedVersion: '2026e' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details).toEqual({
      reasonCode: 'tzdb_version_mismatch',
      pinnedVersion: '2026e',
    });
  });

  it('503 preflight unavailability names the preflight class', async () => {
    const refused = await refuse(
      byId('CMS-03B-09'),
      raised('DEPENDENCY_UNAVAILABLE', { dependencyClass: 'preflight' }),
    );
    expect(refused.status).toBe(503);
    expect(refused.body.details).toEqual({
      dependencyClass: 'preflight',
      retryable: true,
    });
  });

  it('drops a token the operation does not register and an unregistered raise', async () => {
    const foreign = await refuse(
      byId('CMS-03B-05'),
      raised('assignment_limit'),
    );
    expect(foreign.status).toBe(409);
    expect(foreign.body.details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
    const unknown = await refuse(byId('CMS-03B-05'), raised('made_up_reason'));
    expect(unknown.status).toBe(500);
    expect(unknown.body.details).toEqual({});
  });

  it('409 idempotency mismatch and a database outage', async () => {
    const mismatch = await refuse(
      byId('CMS-03B-08'),
      raised('IDEMPOTENCY_MISMATCH'),
    );
    expect(mismatch.body.details).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
    const outage = await refuse(byId('CMS-03B-18'), json({}, 503));
    expect(outage.status).toBe(503);
  });

  it('conceals a hidden review on the detail read', async () => {
    const edge = rpcEdge({
      cms_get_editorial_review: () => raised('NOT_FOUND'),
    });
    const response = await getRead(
      workflowApp(edge.fetchImpl),
      `/api/v1/cms/reviews/${reviewId}`,
    );
    expect(response.status).toBe(404);
    expect(((await response.json()) as { details: unknown }).details).toEqual(
      {},
    );
  });
});

describe('committed refusal disposition', () => {
  const dispose = async (value: unknown) => {
    const edge = rpcEdge({ cms_record_review_decision: () => json(value) });
    const response = await send(
      workflowApp(edge.fetchImpl),
      commandCases.find((item) => item.operationId === 'CMS-03B-06')!,
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };

  it('answers a committed dependency_changed as its typed 409', async () => {
    const refused = await dispose({
      kind: 'refusal',
      reasonCode: 'dependency_changed',
      details: { dependencyHash: hash, ignored: 'x' },
    });
    expect(refused.status).toBe(409);
    expect(refused.body.details).toEqual({
      reasonCode: 'dependency_changed',
      dependencyHash: hash,
    });
    const bare = await dispose({
      kind: 'refusal',
      reasonCode: 'review_not_open',
    });
    expect(bare.status).toBe(409);
    expect(bare.body.details).toEqual({ reasonCode: 'review_not_open' });
  });

  it.each([
    [
      'an unregistered token',
      { kind: 'refusal', reasonCode: 'rich_text_not_canonical' },
    ],
    ['a non-string token', { kind: 'refusal', reasonCode: 7 }],
    [
      'an extra member',
      { kind: 'refusal', reasonCode: 'review_not_open', x: 1 },
    ],
    [
      'non-object details',
      { kind: 'refusal', reasonCode: 'review_not_open', details: [] },
    ],
  ])('refuses %s as a bad gateway', async (_name, value) => {
    expect((await dispose(value)).status).toBe(502);
  });

  it('leaves an ordinary resource and an unknown kind to the resource contract', async () => {
    expect((await dispose({ kind: 'other' })).status).toBe(502);
    expect((await dispose(workflowResources['CMS-03B-06'])).status).toBe(200);
  });
});
