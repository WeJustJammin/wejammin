/**
 * BE03a CMS-03A-09..18 error-matrix evidence. Every case drives the real Hono
 * app, admission pipeline and response mapping; the dependency ports and the
 * limiter are the only fakes. Each refusal must use the exact four-field BE00
 * ApiError envelope with only allowlisted details and must leave the port
 * uncalled when the Worker refuses before it.
 */
import { describe, expect, it } from 'vitest';

import { REQUEST_ID, error, ok } from './phase-02-slice-09-test-values';
import {
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  sessionFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import { makeDbBackedHarness } from './phase-02-slice-09-r8-db-harness';

type Case = readonly [marker: string, operationId: EvidenceOperationId];

const E400: readonly Case[] = [
  ['[P2-S09-AC-304]', 'CMS-03A-09'],
  ['[P2-S09-AC-350]', 'CMS-03A-10'],
  ['[P2-S09-AC-392]', 'CMS-03A-11'],
  ['[P2-S09-AC-429]', 'CMS-03A-12'],
  ['[P2-S09-AC-455]', 'CMS-03A-13'],
  ['[P2-S09-AC-491]', 'CMS-03A-14'],
  ['[P2-S09-AC-533]', 'CMS-03A-15'],
  ['[P2-S09-AC-562]', 'CMS-03A-16'],
  ['[P2-S09-AC-590]', 'CMS-03A-17'],
  ['[P2-S09-AC-619]', 'CMS-03A-18'],
];
const E401: readonly Case[] = [
  ['[P2-S09-AC-305]', 'CMS-03A-09'],
  ['[P2-S09-AC-351]', 'CMS-03A-10'],
  ['[P2-S09-AC-393]', 'CMS-03A-11'],
  ['[P2-S09-AC-430]', 'CMS-03A-12'],
  ['[P2-S09-AC-456]', 'CMS-03A-13'],
  ['[P2-S09-AC-492]', 'CMS-03A-14'],
  ['[P2-S09-AC-534]', 'CMS-03A-15'],
  ['[P2-S09-AC-563]', 'CMS-03A-16'],
  ['[P2-S09-AC-591]', 'CMS-03A-17'],
  ['[P2-S09-AC-620]', 'CMS-03A-18'],
];
const E403: readonly Case[] = [
  ['[P2-S09-AC-306]', 'CMS-03A-09'],
  ['[P2-S09-AC-352]', 'CMS-03A-10'],
  ['[P2-S09-AC-394]', 'CMS-03A-11'],
  ['[P2-S09-AC-431]', 'CMS-03A-12'],
  ['[P2-S09-AC-457]', 'CMS-03A-13'],
  ['[P2-S09-AC-493]', 'CMS-03A-14'],
  ['[P2-S09-AC-535]', 'CMS-03A-15'],
  ['[P2-S09-AC-564]', 'CMS-03A-16'],
  ['[P2-S09-AC-592]', 'CMS-03A-17'],
  ['[P2-S09-AC-621]', 'CMS-03A-18'],
];
const E404: readonly Case[] = [
  ['[P2-S09-AC-307]', 'CMS-03A-09'],
  ['[P2-S09-AC-353]', 'CMS-03A-10'],
  ['[P2-S09-AC-395]', 'CMS-03A-11'],
  ['[P2-S09-AC-432]', 'CMS-03A-12'],
  ['[P2-S09-AC-458]', 'CMS-03A-13'],
  ['[P2-S09-AC-494]', 'CMS-03A-14'],
  ['[P2-S09-AC-536]', 'CMS-03A-15'],
  ['[P2-S09-AC-565]', 'CMS-03A-16'],
  ['[P2-S09-AC-593]', 'CMS-03A-17'],
];
const E409: readonly Case[] = [
  ['[P2-S09-AC-308]', 'CMS-03A-09'],
  ['[P2-S09-AC-354]', 'CMS-03A-10'],
  ['[P2-S09-AC-396]', 'CMS-03A-11'],
  ['[P2-S09-AC-433]', 'CMS-03A-12'],
  ['[P2-S09-AC-495]', 'CMS-03A-14'],
  ['[P2-S09-AC-537]', 'CMS-03A-15'],
  ['[P2-S09-AC-566]', 'CMS-03A-16'],
  ['[P2-S09-AC-594]', 'CMS-03A-17'],
];
const E415: readonly Case[] = [
  ['[P2-S09-AC-309]', 'CMS-03A-09'],
  ['[P2-S09-AC-355]', 'CMS-03A-10'],
  ['[P2-S09-AC-397]', 'CMS-03A-11'],
  ['[P2-S09-AC-434]', 'CMS-03A-12'],
  ['[P2-S09-AC-496]', 'CMS-03A-14'],
  ['[P2-S09-AC-538]', 'CMS-03A-15'],
  ['[P2-S09-AC-567]', 'CMS-03A-16'],
  ['[P2-S09-AC-595]', 'CMS-03A-17'],
];
const E422: readonly Case[] = [
  ['[P2-S09-AC-310]', 'CMS-03A-09'],
  ['[P2-S09-AC-356]', 'CMS-03A-10'],
  ['[P2-S09-AC-398]', 'CMS-03A-11'],
  ['[P2-S09-AC-435]', 'CMS-03A-12'],
  ['[P2-S09-AC-497]', 'CMS-03A-14'],
  ['[P2-S09-AC-539]', 'CMS-03A-15'],
  ['[P2-S09-AC-568]', 'CMS-03A-16'],
  ['[P2-S09-AC-596]', 'CMS-03A-17'],
  ['[P2-S09-AC-622]', 'CMS-03A-18'],
];
const E429: readonly Case[] = [
  ['[P2-S09-AC-311]', 'CMS-03A-09'],
  ['[P2-S09-AC-357]', 'CMS-03A-10'],
  ['[P2-S09-AC-399]', 'CMS-03A-11'],
  ['[P2-S09-AC-436]', 'CMS-03A-12'],
  ['[P2-S09-AC-459]', 'CMS-03A-13'],
  ['[P2-S09-AC-498]', 'CMS-03A-14'],
  ['[P2-S09-AC-540]', 'CMS-03A-15'],
  ['[P2-S09-AC-569]', 'CMS-03A-16'],
  ['[P2-S09-AC-597]', 'CMS-03A-17'],
  ['[P2-S09-AC-623]', 'CMS-03A-18'],
];
const E500: readonly Case[] = [
  ['[P2-S09-AC-315]', 'CMS-03A-09'],
  ['[P2-S09-AC-361]', 'CMS-03A-10'],
  ['[P2-S09-AC-403]', 'CMS-03A-11'],
  ['[P2-S09-AC-440]', 'CMS-03A-12'],
  ['[P2-S09-AC-463]', 'CMS-03A-13'],
  ['[P2-S09-AC-502]', 'CMS-03A-14'],
  ['[P2-S09-AC-544]', 'CMS-03A-15'],
  ['[P2-S09-AC-573]', 'CMS-03A-16'],
  ['[P2-S09-AC-601]', 'CMS-03A-17'],
  ['[P2-S09-AC-627]', 'CMS-03A-18'],
];
const E503: readonly Case[] = [
  ['[P2-S09-AC-313]', 'CMS-03A-09'],
  ['[P2-S09-AC-359]', 'CMS-03A-10'],
  ['[P2-S09-AC-401]', 'CMS-03A-11'],
  ['[P2-S09-AC-438]', 'CMS-03A-12'],
  ['[P2-S09-AC-461]', 'CMS-03A-13'],
  ['[P2-S09-AC-500]', 'CMS-03A-14'],
  ['[P2-S09-AC-542]', 'CMS-03A-15'],
  ['[P2-S09-AC-571]', 'CMS-03A-16'],
  ['[P2-S09-AC-599]', 'CMS-03A-17'],
  ['[P2-S09-AC-625]', 'CMS-03A-18'],
];
const E502: readonly Case[] = [
  ['[P2-S09-AC-312]', 'CMS-03A-09'],
  ['[P2-S09-AC-358]', 'CMS-03A-10'],
  ['[P2-S09-AC-400]', 'CMS-03A-11'],
  ['[P2-S09-AC-437]', 'CMS-03A-12'],
  ['[P2-S09-AC-460]', 'CMS-03A-13'],
  ['[P2-S09-AC-499]', 'CMS-03A-14'],
  ['[P2-S09-AC-541]', 'CMS-03A-15'],
  ['[P2-S09-AC-570]', 'CMS-03A-16'],
  ['[P2-S09-AC-598]', 'CMS-03A-17'],
  ['[P2-S09-AC-624]', 'CMS-03A-18'],
];
const E504: readonly Case[] = [
  ['[P2-S09-AC-314]', 'CMS-03A-09'],
  ['[P2-S09-AC-360]', 'CMS-03A-10'],
  ['[P2-S09-AC-402]', 'CMS-03A-11'],
  ['[P2-S09-AC-439]', 'CMS-03A-12'],
  ['[P2-S09-AC-462]', 'CMS-03A-13'],
  ['[P2-S09-AC-501]', 'CMS-03A-14'],
  ['[P2-S09-AC-543]', 'CMS-03A-15'],
  ['[P2-S09-AC-572]', 'CMS-03A-16'],
  ['[P2-S09-AC-600]', 'CMS-03A-17'],
  ['[P2-S09-AC-626]', 'CMS-03A-18'],
];
const STEP_UP: readonly Case[] = [
  ['[P2-S09-AC-441]', 'CMS-03A-12'],
  ['[P2-S09-AC-503]', 'CMS-03A-14'],
  ['[P2-S09-AC-545]', 'CMS-03A-15'],
  ['[P2-S09-AC-574]', 'CMS-03A-16'],
  ['[P2-S09-AC-602]', 'CMS-03A-17'],
];

const ENVELOPE_KEYS = ['code', 'details', 'message', 'requestId'];

const envelope = async (
  response: Response,
  status: number,
  code: string,
): Promise<Record<string, unknown>> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(ENVELOPE_KEYS);
  expect(body.code).toBe(code);
  expect(body.requestId).toBe(REQUEST_ID);
  expect(typeof body.message).toBe('string');
  return body;
};

const refusedBefore = (op: EvidenceOp, ports: Record<string, never>): void => {
  expect(calledPorts(ports as never)).toBe(0);
  expect(op.portName.length).toBeGreaterThan(0);
};

describe('BE03a 400 INVALID_REQUEST', () => {
  it.each(E400)(
    '%s %s returns 400 INVALID_REQUEST for malformed path, header or body with the BE00 envelope and no details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const malformed =
        op.method === 'GET'
          ? { headers: { 'if-match': '"1"' } }
          : { headers: { 'idempotency-key': 'short' } };
      const harness = harnessFor(op);
      const body = await envelope(
        await harness.app.request(requestFor(op, malformed)),
        400,
        'INVALID_REQUEST',
      );
      expect(body.details).toEqual({});
      refusedBefore(op, harness.ports as never);
    },
  );
});

describe('BE03a 401 UNAUTHENTICATED', () => {
  it.each(E401)(
    '%s %s returns 401 UNAUTHENTICATED for a missing or expired session with reauthenticate recovery only',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const details of [
        { recoveryAction: 'reauthenticate', secret: 'x' },
      ]) {
        const harness = harnessFor(op, {
          session: error(401, 'UNAUTHENTICATED', 'No session.', details),
        });
        const body = await envelope(
          await harness.app.request(requestFor(op)),
          401,
          'UNAUTHENTICATED',
        );
        expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
        refusedBefore(op, harness.ports as never);
      }
    },
  );
});

describe('BE03a 403 FORBIDDEN', () => {
  it.each(E403)(
    '%s %s returns 403 FORBIDDEN for a denied capability or non-owner caller without revealing the target',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      if (op.family === 'review') {
        const harness = harnessFor(op, {
          session: ok(
            sessionFor(op, { capabilities: ['cms.schema_registry.read'] }),
          ),
        });
        const body = await envelope(
          await harness.app.request(requestFor(op)),
          403,
          'FORBIDDEN',
        );
        expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
        refusedBefore(op, harness.ports as never);
      } else {
        const harness = harnessFor(op, {
          port: error(403, 'FORBIDDEN', 'Not the owner.', {
            reasonCode: 'OWNER_REQUIRED',
            ownerPersonId: 'leak',
          }),
        });
        const body = await envelope(
          await harness.app.request(requestFor(op)),
          403,
          'FORBIDDEN',
        );
        expect(body.details).toEqual({ reasonCode: 'OWNER_REQUIRED' });
      }
    },
  );
});

describe('BE03a 404 NOT_FOUND', () => {
  it.each(E404)(
    '%s %s maps a hidden, absent or concealed target to 404 NOT_FOUND with no details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, {
        port: error(404, 'NOT_FOUND', 'Not found.', { leak: 'hidden' }),
      });
      const body = await envelope(
        await harness.app.request(requestFor(op)),
        404,
        'NOT_FOUND',
      );
      expect(body.details).toEqual({});
      expect(harness.ports[op.portName]).toHaveBeenCalledTimes(1);
    },
  );
});

describe('BE03a 409 CONFLICT family (mapping of a port refusal)', () => {
  // Mapping only: the port is told to refuse. The conditions themselves, an
  // idempotency mismatch, a stale version and a state conflict, are produced
  // through the real RPC adapter in phase-02-slice-09-r8-db-errors.test.ts.
  it.each(E409)(
    '%s %s maps a port conflict to 409 CONFLICT with the BE00 conflict details and only the two version details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const stale = harnessFor(op, {
        port: error(409, 'CONFLICT', 'Stale.', {
          expectedVersion: '1',
          currentVersion: '2',
          secret: 'x',
        }),
      });
      const body = await envelope(
        await stale.app.request(requestFor(op)),
        409,
        'CONFLICT',
      );
      expect(body.details).toEqual({
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
        expectedVersion: '1',
        currentVersion: '2',
      });
    },
  );
});

describe('BE03a 415 UNSUPPORTED_MEDIA_TYPE', () => {
  it.each(E415)(
    '%s %s returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body before session or port work',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op);
      const body = await envelope(
        await harness.app.request(
          requestFor(op, { headers: { 'content-type': 'text/plain' } }),
        ),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      );
      expect(body.details).toEqual({});
      expect(harness.resolveSession).not.toHaveBeenCalled();
      refusedBefore(op, harness.ports as never);
    },
  );
});

describe('BE03a 422 VALIDATION_FAILED', () => {
  it.each(E422)(
    '%s %s returns 422 VALIDATION_FAILED with at most 50 allowlisted violations for a schema failure',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      if (op.method === 'POST') {
        const harness = harnessFor(op);
        const body = await envelope(
          await harness.app.request(
            requestFor(op, {
              body:
                operationId === 'CMS-03A-10'
                  ? // an unknown key is a structural 400 on CMS-03A-10 (AC356);
                    // a half transform pair is its 422 schema failure
                    {
                      ...op.body,
                      transformKey: 'identity.revalidate',
                      transformVersion: null,
                    }
                  : { ...op.body, callerOwned: 1 },
            }),
          ),
          422,
          'VALIDATION_FAILED',
        );
        expect(Object.keys(body.details as object)).toEqual(['violations']);
        refusedBefore(op, harness.ports as never);
      }
      const violations = Array.from({ length: 60 }, (_, index) => ({
        path: `/field/${index}`,
        code: 'INVALID_VALUE',
        message: 'The value is invalid.',
        sql: 'leak',
      }));
      const harness = harnessFor(op, {
        port: error(422, 'VALIDATION_FAILED', 'Invalid.', { violations }),
      });
      const body = await envelope(
        await harness.app.request(requestFor(op)),
        422,
        'VALIDATION_FAILED',
      );
      const mapped = (body.details as { violations: object[] }).violations;
      expect(mapped).toHaveLength(50);
      expect(Object.keys(mapped[0] as object).sort()).toEqual([
        'code',
        'message',
        'path',
      ]);
    },
  );
});

describe('BE03a 429 RATE_LIMITED (mapping of a refused limiter decision)', () => {
  // Mapping only: the limiter is told to refuse. The condition itself is
  // produced through the real production limiter in
  // phase-02-slice-09-be03a-evidence-rate.test.ts.
  it.each(E429)(
    '%s %s maps a refused limiter decision to 429 RATE_LIMITED with the limiter reset in Retry-After, RateLimit headers and BE00 details and never reaches the port',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, {
        rate: ok({
          allowed: false,
          limit: op.limit,
          remaining: 0,
          resetAt: 1_788_345_660,
        }),
      });
      const response = await harness.app.request(requestFor(op));
      const body = await envelope(response, 429, 'RATE_LIMITED');
      expect(body.details).toEqual({
        limit: op.limit,
        resetAt: '2026-09-02T10:41:00.000Z',
        retryAfterSeconds: 60,
      });
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-limit')).toBe(String(op.limit));
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('ratelimit-reset')).toBe('1788345660');
      refusedBefore(op, harness.ports as never);
    },
  );
});

describe('BE03a 500 INTERNAL_ERROR', () => {
  it.each(E500)(
    '%s %s answers an unexpected failure with 500 INTERNAL_ERROR, a fixed message and no details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const thrown = harnessFor(op);
      thrown.ports[op.portName]?.mockRejectedValueOnce(
        new TypeError('cms_secret is not a function'),
      );
      const response = await thrown.app.request(requestFor(op));
      const text = await response.clone().text();
      const body = await envelope(response, 500, 'INTERNAL_ERROR');
      expect(body.details).toEqual({});
      expect(body.message).toBe('An unexpected error occurred.');
      expect(text).not.toContain('cms_secret');
      expect(thrown.ports[op.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(E500)(
    '%s %s keeps an unexpected failure (500) distinct from a dependency outage (503) and a deadline (504)',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const outage = makeDbBackedHarness(op, () => {
        throw new TypeError('fetch failed');
      });
      expect((await outage.app.request(requestFor(op))).status).toBe(503);
      const deadline = harnessFor(op);
      const abort = new DOMException('aborted', 'AbortError');
      deadline.ports[op.portName]?.mockRejectedValueOnce(abort);
      expect((await deadline.app.request(requestFor(op))).status).toBe(504);
    },
  );
});

describe('BE03a 503 DEPENDENCY_UNAVAILABLE', () => {
  it.each(E503)(
    '%s %s returns 503 DEPENDENCY_UNAVAILABLE with only dependencyClass, retryable and retryAfterSeconds for an unavailable dependency',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, {
        port: error(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'down',
          { dependencyClass: 'cms_registry', retryable: true, sql: 'leak' },
          7,
        ),
      });
      const response = await harness.app.request(requestFor(op));
      const body = await envelope(response, 503, 'DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_registry',
        retryable: true,
        retryAfterSeconds: 7,
      });
      expect(response.headers.get('retry-after')).toBe('7');
      // The condition itself: the real adapter's transport fails.
      const down = makeDbBackedHarness(op, () => {
        throw new TypeError('pg down');
      });
      const scrubbed = await down.app.request(requestFor(op));
      expect(scrubbed.status).toBe(503);
      expect(await scrubbed.text()).not.toContain('pg down');
    },
  );
});

describe('BE03a 502 DEPENDENCY_UNAVAILABLE', () => {
  it.each(E502)(
    '%s %s returns 502 DEPENDENCY_UNAVAILABLE for an invalid dependency response with only dependencyClass, retryable true and retryAfterSeconds',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const wrongShape = harnessFor(op, { port: ok({ unexpected: true }) });
      const response = await wrongShape.app.request(requestFor(op));
      expect(wrongShape.ports[op.portName]).toHaveBeenCalledTimes(1);
      const body = await envelope(response, 502, 'DEPENDENCY_UNAVAILABLE');
      expect(Object.keys(body.details as object).sort()).toEqual([
        'dependencyClass',
        'retryable',
      ]);
      expect((body.details as { retryable: boolean }).retryable).toBe(true);
      expect(JSON.stringify(body)).not.toContain('unexpected');

      const reported = harnessFor(op, {
        port: error(
          502,
          'DEPENDENCY_INVALID_RESPONSE',
          'bad',
          { dependencyClass: 'cms_registry', retryable: false, sql: 'leak' },
          3,
        ),
      });
      const mapped = await reported.app.request(requestFor(op));
      const mappedBody = await envelope(mapped, 502, 'DEPENDENCY_UNAVAILABLE');
      expect(mappedBody.details).toEqual({
        dependencyClass: 'cms_registry',
        retryable: true,
        retryAfterSeconds: 3,
      });
    },
  );
});

describe('BE03a 504 DEPENDENCY_UNAVAILABLE', () => {
  it.each(E504)(
    '%s %s returns 504 DEPENDENCY_UNAVAILABLE for an exceeded deadline with only dependencyClass, retryable true and retryAfterSeconds',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, {
        port: error(
          504,
          'DEPENDENCY_DEADLINE_EXCEEDED',
          'slow',
          { dependencyClass: 'cms_registry', retryable: true, sql: 'leak' },
          5,
        ),
      });
      const response = await harness.app.request(requestFor(op));
      const body = await envelope(response, 504, 'DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_registry',
        retryable: true,
        retryAfterSeconds: 5,
      });
      expect(response.headers.get('retry-after')).toBe('5');
    },
  );
});

describe('BE03a 401 STEP_UP_REQUIRED', () => {
  it.each(STEP_UP)(
    '%s %s returns 401 STEP_UP_REQUIRED with { recoveryAction: step_up, allowedMethods } for stale MFA before any idempotency reservation',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, {
        session: ok(sessionFor(op, { mfaFresh: false })),
      });
      const response = await harness.app.request(requestFor(op));
      const body = await envelope(response, 401, 'STEP_UP_REQUIRED');
      const details = body.details as {
        recoveryAction: string;
        allowedMethods: unknown;
      };
      expect(Object.keys(details).sort()).toEqual([
        'allowedMethods',
        'recoveryAction',
      ]);
      expect(details.recoveryAction).toBe('step_up');
      expect(Array.isArray(details.allowedMethods)).toBe(true);
      expect(JSON.stringify(body)).not.toContain('reauthenticate');
      refusedBefore(op, harness.ports as never);

      // No reservation was taken: the same key succeeds once MFA is fresh.
      harness.resolveSession.mockResolvedValueOnce(ok(sessionFor(op)));
      const retry = await harness.app.request(requestFor(op));
      expect(retry.status).toBe(op.status);
      expect(harness.ports[op.portName]).toHaveBeenCalledTimes(1);
    },
  );
});
