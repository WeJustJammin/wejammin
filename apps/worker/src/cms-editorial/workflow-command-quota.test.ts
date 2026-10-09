import { describe, expect, it } from 'vitest';

import { cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import { idempotencyKey, origin } from './workflow-fixtures.test-support';
import {
  commandCases,
  errorBody,
  getJson,
  postJson,
  workflowHarness,
  type CommandCase,
} from './workflow-harness.test-support';

/*
 * The admission contract every Slice 11 browser command shares (BE00 middleware
 * order, BE03b E6 step-up): the registry row is the single source of method,
 * path, statuses, validators, quotas and deadlines, and a refusal never reaches
 * the port.
 */

const policyOf = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const forEachCase = (
  run: (testCase: CommandCase) => void | Promise<void>,
): void => {
  for (const testCase of commandCases)
    it(`${testCase.operationId}`, () => run(testCase));
};

describe('BE00 step 7: capability, step-up and quota', () => {
  describe('refuses a session without the registry capability with capability_missing', () => {
    for (const testCase of commandCases.filter(
      (item) => item.deniedCapabilities !== null,
    ))
      it(testCase.operationId, async () => {
        const { app, ports, rateLimit } = workflowHarness({
          capabilities: testCase.deniedCapabilities!,
        });
        const response = await postJson(app, testCase.path, testCase.body);
        expect(response.status).toBe(403);
        const body = await errorBody(response);
        expect(body.code).toBe('FORBIDDEN');
        expect(body.details).toEqual({ reasonCode: 'capability_missing' });
        expect(ports[testCase.port]).not.toHaveBeenCalled();
        expect(rateLimit).not.toHaveBeenCalled();
      });
  });

  describe('leaves scope to the RPC where the row declares rpc_scope', () => {
    for (const testCase of commandCases.filter(
      (item) => item.deniedCapabilities === null,
    ))
      it(testCase.operationId, async () => {
        const { app, ports } = workflowHarness({ capabilities: [] });
        const response = await postJson(app, testCase.path, testCase.body);
        expect(response.status).toBe(testCase.status);
        expect(ports[testCase.port]).toHaveBeenCalledTimes(1);
      });
  });

  describe('answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC', () => {
    for (const testCase of commandCases.filter((item) => item.stepUp))
      it(testCase.operationId, async () => {
        const { app, ports, rateLimit, qualityGate } = workflowHarness({
          mfaFresh: false,
        });
        const response = await postJson(app, testCase.path, testCase.body);
        expect(response.status).toBe(401);
        const body = await errorBody(response);
        expect(body.code).toBe('STEP_UP_REQUIRED');
        expect(body.details).toEqual({
          recoveryAction: 'step_up',
          allowedMethods: [...MFA_METHOD_REGISTRY],
        });
        expect(ports[testCase.port]).not.toHaveBeenCalled();
        expect(rateLimit).not.toHaveBeenCalled();
        expect(qualityGate).not.toHaveBeenCalled();
      });
  });

  describe('never asks for step-up on a row without it', () => {
    for (const testCase of commandCases.filter((item) => !item.stepUp))
      it(testCase.operationId, async () => {
        const { app } = workflowHarness({ mfaFresh: false });
        const response = await postJson(app, testCase.path, testCase.body);
        expect(response.status).toBe(testCase.status);
      });
  });

  describe('enforces the user and party buckets from the registry row', () => {
    forEachCase(async (testCase) => {
      const policy = policyOf(testCase.operationId);
      const { app, rateLimit } = workflowHarness();
      await postJson(app, testCase.path, testCase.body);
      const inputs = rateLimit.mock.calls.map(
        (call) => (call as unknown as [Record<string, unknown>])[0],
      );
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toMatchObject({
        operationId: testCase.operationId,
        rateClass: policy.rateClass,
        rateScope: 'user',
        limit: policy.rateLimit,
        windowSeconds: 60,
      });
      expect(inputs[1]).toMatchObject({
        rateScope: 'party',
        limit: policy.partyRateLimit,
      });
    });
  });

  describe('answers an exhausted bucket 429 with the rate headers', () => {
    forEachCase(async (testCase) => {
      const policy = policyOf(testCase.operationId);
      const { app, ports } = workflowHarness({ rateAllowed: false });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(429);
      expect(response.headers.get('ratelimit-limit')).toBe(
        String(policy.rateLimit),
      );
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(
        Number(response.headers.get('retry-after')),
      ).toBeGreaterThanOrEqual(1);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('passes a quota dependency failure through as its typed refusal', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({
        rateLimit: async () => ({
          ok: false as const,
          status: 503 as const,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'rate store down',
        }),
      });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(503);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });
});

describe('BE00 step 8: Idempotency-Key and strong If-Match', () => {
  describe('requires a printable Idempotency-Key', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const missing = await app.request(testCase.path, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'if-match': '"2"',
        },
        body: JSON.stringify(testCase.body),
      });
      expect(missing.status).toBe(400);
      const short = await postJson(app, testCase.path, testCase.body, {
        'idempotency-key': 'short',
      });
      expect(short.status).toBe(400);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('requires an exact strong If-Match', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      for (const ifMatch of ['W/"2"', '2', '"02"', '"0"', '*', '"2", "3"']) {
        const response = await postJson(app, testCase.path, testCase.body, {
          'if-match': ifMatch,
        });
        expect(response.status).toBe(400);
      }
      const absent = await app.request(testCase.path, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(testCase.body),
      });
      expect(absent.status).toBe(400);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses an If-Match that disagrees with the body expectedVersion as 400', () => {
    for (const testCase of commandCases.filter(
      (item) => item.versionMember !== null,
    ))
      it(testCase.operationId, async () => {
        const { app, ports } = workflowHarness();
        const response = await postJson(app, testCase.path, testCase.body, {
          'if-match': '"7"',
        });
        expect(response.status).toBe(400);
        expect((await errorBody(response)).details).toEqual({
          violations: [
            {
              path: '/expectedVersion',
              code: 'mismatch',
              message: 'The value is invalid.',
            },
          ],
        });
        expect(ports[testCase.port]).not.toHaveBeenCalled();
      });
  });
});

describe('port boundary', () => {
  describe('is 503 when the port is not composed', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({ omitPorts: [testCase.port] });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(503);
      expect((await errorBody(response)).details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
    });
  });

  describe('projects a typed port refusal through the operation boundary', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        port: {
          [testCase.port]: async () => ({
            ok: false as const,
            status: 409 as const,
            code: 'CONFLICT',
            message: 'private',
            details: {
              conflict: 'VERSION_MISMATCH',
              expectedVersion: '2',
              currentVersion: '5',
              secret: 'x',
            },
          }),
        },
      });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(409);
      const body = await errorBody(response);
      expect(body.details).toEqual({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '2',
        currentVersion: '5',
      });
      expect(JSON.stringify(body)).not.toContain('private');
    });
  });

  describe('is 502 when the success payload breaks the resource contract', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        port: {
          [testCase.port]: async () => ({
            ok: true as const,
            value: { id: 1 },
          }),
        },
      });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(502);
      expect((await errorBody(response)).code).toBe('BAD_GATEWAY');
    });
  });

  describe('is 504 when the port outlives the route deadline', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        deadlineMs: 20,
        port: {
          [testCase.port]: () => new Promise(() => undefined),
        },
      });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(504);
    });
  });
});

describe('CORS preflight', () => {
  describe('answers an allowlisted origin and refuses the rest', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness();
      const allowed = await app.request(testCase.path, {
        method: 'OPTIONS',
        headers: { origin },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
      expect(allowed.headers.get('access-control-allow-methods')).toBe(
        'POST, OPTIONS',
      );
      expect(allowed.headers.get('access-control-allow-headers')).toBe(
        'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
      );
      const foreign = await app.request(testCase.path, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.test' },
      });
      expect(foreign.status).toBe(403);
      const sameOrigin = await app.request(testCase.path, {
        method: 'OPTIONS',
      });
      expect(sameOrigin.status).toBe(403);
    });
  });
});

describe('route inventory', () => {
  it('does not expose the Slice 11 commands under another method', async () => {
    const { app } = workflowHarness();
    for (const testCase of commandCases) {
      const response = await getJson(app, testCase.path);
      expect([404, 405]).toContain(response.status);
    }
  });
});
