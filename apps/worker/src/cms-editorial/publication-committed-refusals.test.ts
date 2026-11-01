import { describe, expect, it } from 'vitest';

import {
  commandCases,
  type CommandCase,
} from './workflow-harness.test-support';
import { hash, idempotencyKey } from './workflow-fixtures.test-support';
import {
  ORIGIN,
  rpcEdge,
  workflowApp,
} from '../cms-editorial-production-workflow.test-support';
import { json } from '../cms-editorial-production.test-support';
import { CMS_EDITORIAL_RPC } from '../cms-editorial-production-types';

/*
 * CMS-03B-07 (schedule) and CMS-03B-09 (publish) commit a review invalidation and answer it as the
 * closed committed-refusal envelope { kind: 'refusal', reasonCode, details } on HTTP 200 (DEC-159 (2)):
 *  - a stale frozen manifest is 409 CONFLICT version_set_stale (BE03b E1: the review is invalidated
 *    dependency_changed in the database, but the command's token is version_set_stale and it carries no
 *    structured member), never dependency_changed with a hash;
 *  - a lapsed counted approver (BE03b "Review invalidation", reviewer_authority_changed) is the committed
 *    422 VALIDATION_FAILED preflight_failed with the bare preflight entries.
 */

const byId = (id: string): CommandCase =>
  commandCases.find((item) => item.operationId === id)!;

const dispose = async (
  operationId: 'CMS-03B-07' | 'CMS-03B-09',
  value: unknown,
) => {
  const edge = rpcEdge({ [CMS_EDITORIAL_RPC[operationId]]: () => json(value) });
  const testCase = byId(operationId);
  const response = await workflowApp(edge.fetchImpl).request(testCase.path, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'if-match': '"2"',
    },
    body: JSON.stringify(testCase.body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
};

describe.each(['CMS-03B-07', 'CMS-03B-09'] as const)(
  '%s committed refusals',
  (operationId) => {
    it('answers a committed stale frozen manifest as 409 version_set_stale with no structured member', async () => {
      const refused = await dispose(operationId, {
        kind: 'refusal',
        reasonCode: 'version_set_stale',
        details: {},
      });
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('CONFLICT');
      expect(refused.body.details).toEqual({ reasonCode: 'version_set_stale' });
    });

    it('drops a stray dependency hash from a committed version_set_stale', async () => {
      const refused = await dispose(operationId, {
        kind: 'refusal',
        reasonCode: 'version_set_stale',
        details: { dependencyHash: hash },
      });
      expect(refused.status).toBe(409);
      expect(refused.body.details).toEqual({ reasonCode: 'version_set_stale' });
    });

    it('answers a committed lapsed-approver refusal as 422 preflight_failed with the bare entries', async () => {
      const preflight = [
        { category: 'contract', outcome: 'passed', reasonCode: null },
        {
          category: 'revocation',
          outcome: 'failed',
          reasonCode: 'reviewer_authority_changed',
        },
      ];
      const refused = await dispose(operationId, {
        kind: 'refusal',
        reasonCode: 'preflight_failed',
        details: {
          preflight: preflight.map((entry) => ({ ...entry, extra: 'x' })),
        },
      });
      expect(refused.status).toBe(422);
      expect(refused.body.code).toBe('VALIDATION_FAILED');
      expect(refused.body.details).toEqual({
        reasonCode: 'preflight_failed',
        preflight,
      });
    });
  },
);
