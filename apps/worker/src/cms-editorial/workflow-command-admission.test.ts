import { describe, expect, it } from 'vitest';

import { cmsEditorialRoutePolicies } from '@wejammin/contracts';

import {} from '../authentication/step-up';
import {
  idempotencyKey,
  origin,
  userId,
} from './workflow-fixtures.test-support';
import {
  commandCases,
  errorBody,
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

describe('registers every browser command at its registry path', () => {
  it('covers all six Slice 11 commands', () => {
    expect(commandCases.map((item) => item.operationId)).toEqual([
      'CMS-03B-05',
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-08',
      'CMS-03B-09',
      'CMS-03B-18',
    ]);
  });

  describe('success envelope', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(testCase.status);
      expect(response.status).toBe(
        policyOf(testCase.operationId).successStatus,
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-type')).toBe(
        'application/json; charset=UTF-8',
      );
      expect(response.headers.get('etag')).toBe(testCase.etag);
      expect(response.headers.get('location')).toBe(testCase.location);
      expect(response.headers.get('x-request-id')).toBeTruthy();
      expect(ports[testCase.port]).toHaveBeenCalledTimes(1);
      expect(await response.json()).toBeTruthy();
    });
  });

  describe('hands the port the validated input and the server-derived session', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      await postJson(app, testCase.path, testCase.body);
      const [input] = ports[testCase.port]!.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(input).toMatchObject({
        operationId: testCase.operationId,
        idempotencyKey,
        ifMatch: '2',
        body: testCase.body,
        session: { userId, mfaFresh: true },
      });
      expect('evidence' in input).toBe(testCase.evidence);
    });
  });
});

describe('BE00 step 2: origin, media, size and CSRF', () => {
  describe('refuses a foreign origin before the session', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await postJson(app, testCase.path, testCase.body, {
        origin: 'https://evil.example.test',
      });
      expect(response.status).toBe(403);
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('refuses a non-JSON media type with the JSON allowlist', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await postJson(app, testCase.path, testCase.body, {
        'content-type': 'text/plain',
      });
      expect(response.status).toBe(415);
      expect((await errorBody(response)).details).toEqual({
        allowedMediaTypes: ['application/json'],
      });
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('refuses a declared oversize body before reading it', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await postJson(app, testCase.path, testCase.body, {
        'content-length': '262145',
      });
      expect(response.status).toBe(400);
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('refuses a streamed body above the ceiling', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const response = await app.request(testCase.path, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
          'if-match': '"2"',
        },
        body: JSON.stringify({ pad: 'x'.repeat(262_200) }),
      });
      expect(response.status).toBe(400);
      expect(resolveSession).not.toHaveBeenCalled();
    });
  });

  describe('requires the double-submit CSRF token on a session cookie', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession } = workflowHarness();
      const cookie = 'wj_session_ref=abc; wj_csrf=token-1';
      const refused = await postJson(app, testCase.path, testCase.body, {
        cookie,
      });
      expect(refused.status).toBe(403);
      expect(resolveSession).not.toHaveBeenCalled();
      const admitted = await postJson(app, testCase.path, testCase.body, {
        cookie,
        'x-csrf-token': 'token-1',
      });
      expect(admitted.status).toBe(testCase.status);
    });
  });
});

describe('BE00 steps 4 and 5: session', () => {
  describe('answers an unauthenticated caller 401 before any port', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness({ unauthenticated: true });
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(401);
      expect((await errorBody(response)).code).toBe('UNAUTHENTICATED');
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a malformed session result as 401', () => {
    forEachCase(async (testCase) => {
      const { app, resolveSession, ports } = workflowHarness();
      resolveSession.mockResolvedValueOnce({
        ok: true,
        value: { userId: 'not-a-uuid' },
      } as never);
      const response = await postJson(app, testCase.path, testCase.body);
      expect(response.status).toBe(401);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });
});

describe('BE00 step 6: strict query, path and body', () => {
  describe('refuses any query string on a command', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await postJson(
        app,
        `${testCase.path}?x=1`,
        testCase.body,
      );
      expect(response.status).toBe(400);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses malformed JSON as 400', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await app.request(testCase.path, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
          'if-match': '"2"',
        },
        body: '{not json',
      });
      expect(response.status).toBe(400);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses an unknown body member as 422 with a stable pointer', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await postJson(app, testCase.path, {
        ...testCase.body,
        riskClass: 'protected',
      });
      expect(response.status).toBe(422);
      expect((await errorBody(response)).details).toEqual({
        violations: [
          {
            path: '/riskClass',
            code: 'unknown_field',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a body that is not an object as 422', () => {
    forEachCase(async (testCase) => {
      const { app, ports } = workflowHarness();
      const response = await postJson(app, testCase.path, []);
      expect(response.status).toBe(422);
      expect(ports[testCase.port]).not.toHaveBeenCalled();
    });
  });

  describe('refuses a path identifier that is not a UUID as 400', () => {
    for (const testCase of commandCases.filter((item) => item.boundId !== null))
      it(testCase.operationId, async () => {
        const { app, ports } = workflowHarness();
        const response = await postJson(
          app,
          testCase.path.replace(testCase.boundId!.value, 'not-a-uuid'),
          testCase.body,
        );
        expect(response.status).toBe(400);
        expect(ports[testCase.port]).not.toHaveBeenCalled();
      });
  });

  describe('refuses a body identifier that disagrees with the path as 422', () => {
    for (const testCase of commandCases.filter((item) => item.boundId !== null))
      it(testCase.operationId, async () => {
        const { app, ports } = workflowHarness();
        const other = '123e4567-e89b-42d3-a456-4266141740ff';
        const response = await postJson(app, testCase.path, {
          ...testCase.body,
          [testCase.boundId!.member]: other,
        });
        expect(response.status).toBe(422);
        expect((await errorBody(response)).details).toEqual({
          violations: [
            {
              path: `/${testCase.boundId!.member}`,
              code: 'mismatch',
              message: 'The value is invalid.',
            },
          ],
        });
        expect(ports[testCase.port]).not.toHaveBeenCalled();
      });
  });
});
