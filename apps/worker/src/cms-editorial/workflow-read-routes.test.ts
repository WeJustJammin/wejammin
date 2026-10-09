import { describe, expect, it } from 'vitest';

import { cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { entryId, reviewId } from './workflow-fixtures.test-support';
import {
  errorBody,
  getJson,
  readCases,
  workflowHarness,
  type ReadCase,
} from './workflow-harness.test-support';

/*
 * The admission contract of the Slice 11 safe reads (CMS-03B-15, -16, -17):
 * BE00 order, closed query keys, no request media or mutation guard, the
 * database-owned read scope (no coarse Worker gate), a strong no-store ETag and
 * the declared bounded error matrix.
 */

const policyOf = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const forEachCase = (
  run: (testCase: ReadCase) => void | Promise<void>,
): void => {
  for (const testCase of readCases)
    it(testCase.operationId, () => run(testCase));
};

describe('registry', () => {
  it('declares every Slice 11 read as a database-scoped safe read', () => {
    for (const testCase of readCases) {
      const policy = policyOf(testCase.operationId);
      expect(policy).toMatchObject({
        method: 'GET',
        gate: 'rpc_scope',
        stepUp: 'none',
        csrf: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        successStatus: 200,
        timeoutMs: 8_000,
        rateClass: 'cms-entry-read',
      });
    }
  });
});

describe('success envelope', () => {
  forEachCase(async (testCase) => {
    const { app, ports } = workflowHarness();
    const response = await getJson(app, testCase.path);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=UTF-8',
    );
    expect(response.headers.get('etag')).toMatch(/^"[A-Za-z0-9:-]+"$/u);
    expect(response.headers.get('location')).toBeNull();
    expect(ports[testCase.port]).toHaveBeenCalledTimes(1);
    expect(await response.json()).toBeTruthy();
  });
});

describe('request identity', () => {
  forEachCase(async (testCase) => {
    const { app } = workflowHarness();
    const response = await app.request(testCase.path, {
      headers: { origin: 'https://cms-console.example.test' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/u);
  });
});

describe('BE00 order', () => {
  describe('refuses a foreign origin before the session', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await getJson(app, testCase.path, {
        origin: 'https://evil.example.test',
      });
      expect(response.status).toBe(403);
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('refuses request media with an empty allowlist', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await getJson(app, testCase.path, {
        'content-type': 'application/json',
      });
      expect(response.status).toBe(415);
      expect((await errorBody(response)).details).toEqual({
        allowedMediaTypes: [],
      });
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('answers an unauthenticated caller 401', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({ unauthenticated: true });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(401);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a malformed session result as 401', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession, ports } = workflowHarness();
      resolveSession.mockResolvedValueOnce({
        ok: true,
        value: { userId: 'nope' },
      } as never);
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(401);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a path identifier that is not a UUID as 400', () => {
    for (const testCase of readCases.filter((item) => item.boundId !== null))
      it(testCase.operationId, async () => {
        const { app, ports } = workflowHarness();
        const response = await getJson(
          app,
          testCase.path.replace(testCase.boundId!, 'not-a-uuid'),
        );
        expect(response.status).toBe(400);
        expect(ports[testCase.port]).not.toHaveBeenCalled();
      });
  });

  describe('refuses an Idempotency-Key, an If-Match or a body', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      for (const headers of [
        { 'idempotency-key': 'idempotency-key-0001' },
        { 'if-match': '"1"' },
        { 'transfer-encoding': 'chunked' },
        { 'content-length': '2' },
      ])
        expect((await getJson(app, testCase.path, headers)).status).toBe(400);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses an unknown query key as 400 with a stable pointer', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await getJson(
        app,
        `${testCase.path}${testCase.badQuery}`,
      );
      expect(response.status).toBe(400);
      expect((await errorBody(response)).details).toMatchObject({
        violations: [
          { code: 'unknown_field', message: 'The value is invalid.' },
        ],
      });
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a repeated query key as 400', () => {
    it('CMS-03B-15', async () => {
      const { app } = workflowHarness();
      const response = await getJson(
        app,
        `/api/v1/cms/entries/${entryId}/workflow?revisionId=${reviewId}&revisionId=${reviewId}`,
      );
      expect(response.status).toBe(400);
    });
  });

  describe('enforces the user and party read buckets', () => {
    forEachCase(async (testCase) => {
      const { app, rateLimit } = workflowHarness();
      await getJson(app, testCase.path);
      const inputs = rateLimit.mock.calls.map(
        (call) => (call as unknown as [Record<string, unknown>])[0],
      );
      expect(inputs).toMatchObject([
        { rateClass: 'cms-entry-read', rateScope: 'user', limit: 300 },
        { rateScope: 'party', limit: 600 },
      ]);
    });
  });

  describe('answers an exhausted bucket 429 with the headers', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({ rateAllowed: false });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(429);
      expect(response.headers.get('ratelimit-limit')).toBe('300');
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('passes a quota outage through without a numeric limit', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        rateLimit: async () => ({
          ok: false as const,
          status: 429 as const,
          code: 'RATE_LIMITED',
          message: 'x',
          retryAfterSeconds: 3,
        }),
      });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(429);
      expect(response.headers.get('ratelimit-limit')).toBe('300');
    });
  });

  describe('passes a quota dependency outage through without rate headers', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({
        rateLimit: async () => ({
          ok: false as const,
          status: 503 as const,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'rate store down',
        }),
      });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(503);
      expect(response.headers.get('ratelimit-limit')).toBeNull();
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('falls back to the host clock when none is injected', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({ omitClock: true });
      expect((await getJson(app, testCase.path)).status).toBe(200);
    });
  });

  describe('leaves the read scope to the RPC', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({ capabilities: [] });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(200);
      expect(ports[testCase.port]).toHaveBeenCalledTimes(1);
    });
  });
});

describe('port boundary', () => {
  describe('is 503 when the port is not composed', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({ omitPorts: [testCase.port] });
      const response = await getJson(app, testCase.path);
      expect(response.status).toBe(503);
    });
  });

  describe('conceals a hidden target as an empty 404 and keeps a visible 403 typed', () => {
    for (const testCase of readCases.filter((item) => item.boundId !== null))
      it(testCase.operationId, async () => {
        const hidden = workflowHarness({
          port: {
            [testCase.port]: async () => ({
              ok: false as const,
              status: 404 as const,
              code: 'NOT_FOUND',
              message: 'private',
              details: { reasonCode: 'capability_missing' },
            }),
          },
        });
        const concealed = await getJson(hidden.app, testCase.path);
        expect(concealed.status).toBe(404);
        expect((await errorBody(concealed)).details).toEqual({});
        const visible = workflowHarness({
          port: {
            [testCase.port]: async () => ({
              ok: false as const,
              status: 403 as const,
              code: 'FORBIDDEN',
              message: 'private',
              details: { reasonCode: 'capability_missing' },
            }),
          },
        });
        const denied = await getJson(visible.app, testCase.path);
        expect(denied.status).toBe(403);
        expect((await errorBody(denied)).details).toEqual({
          reasonCode: 'capability_missing',
        });
      });
  });

  describe('is 502 when the success payload breaks the resource contract', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        port: {
          [testCase.port]: async () => ({ ok: true as const, value: { x: 1 } }),
        },
      });
      expect((await getJson(app, testCase.path)).status).toBe(502);
    });
  });

  describe('is 504 when the port outlives the route deadline', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness({
        deadlineMs: 20,
        port: { [testCase.port]: () => new Promise(() => undefined) },
      });
      expect((await getJson(app, testCase.path)).status).toBe(504);
    });
  });
});

describe('CORS preflight', () => {
  describe('answers an allowlisted origin only', () => {
    forEachCase(async (testCase) => {
      const { app } = workflowHarness();
      const allowed = await app.request(testCase.path, {
        method: 'OPTIONS',
        headers: { origin: 'https://cms-console.example.test' },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('access-control-allow-methods')).toBe(
        'GET, OPTIONS',
      );
      expect(
        (await app.request(testCase.path, { method: 'OPTIONS' })).status,
      ).toBe(403);
    });
  });
});
