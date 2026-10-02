import { describe, expect, it } from 'vitest';

import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  error,
  ok,
} from './phase-02-slice-09-test-values';
import {
  GRANT_OPERATIONS,
  grantListPage,
  grantRequestFor,
  grantResource,
  grantSpecFor,
  makeGrantHarness,
  ownerSession,
} from './phase-02-slice-09-grants-test-support';

const MUTATIONS = GRANT_OPERATIONS.filter((spec) => spec.method === 'POST');
const STEP_UP = GRANT_OPERATIONS.filter((spec) => spec.stepUp);
const LIST = grantSpecFor('CMS-03A-18');

describe('grant handler success mapping (BE03a Route Registry)', () => {
  it.each(GRANT_OPERATIONS)(
    '$operationId returns its registry status and the contract resource through $portName',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(await response.json()).toEqual(spec.output);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(MUTATIONS)(
    '$operationId sets ETag from the grant version',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      const output = spec.output as { version: string };
      expect(response.headers.get('etag')).toBe(`"${output.version}"`);
    },
  );

  it('CMS-03A-18 is a safe read: no ETag, no Location, never cached', async () => {
    const harness = makeGrantHarness();
    const response = await harness.app.request(grantRequestFor(LIST));
    expect(response.status).toBe(200);
    expect(response.headers.has('etag')).toBe(false);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('CMS-03A-18 returns an empty page with a null cursor unchanged', async () => {
    const harness = makeGrantHarness({
      port: ok({ items: [], nextCursor: null }),
    });
    const response = await harness.app.request(grantRequestFor(LIST));
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
  });

  it('CMS-03A-18 never answers a grant carrying an unlisted key', async () => {
    const harness = makeGrantHarness({
      port: ok({
        items: [{ ...grantResource, grantorPersonId: USER_ID }],
        nextCursor: null,
      }),
    });
    const response = await harness.app.request(grantRequestFor(LIST));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(USER_ID);
  });

  it('CMS-03A-18 repeats the port call for every request (no idempotency cache for a read)', async () => {
    const harness = makeGrantHarness();
    await harness.app.request(grantRequestFor(LIST));
    await harness.app.request(grantRequestFor(LIST));
    expect(harness.ports['listCapabilityGrants']).toHaveBeenCalledTimes(2);
    expect(grantListPage.items).toHaveLength(1);
  });
});

describe('grant handler error mapping (BE03a error matrix)', () => {
  const failures = [
    [
      403,
      'FORBIDDEN',
      { reasonCode: 'OWNER_REQUIRED' },
      { reasonCode: 'OWNER_REQUIRED' },
    ],
    [404, 'NOT_FOUND', { leak: 'hidden' }, {}],
    [
      409,
      'CONFLICT',
      { expectedVersion: '1', currentVersion: '2', secret: 'x' },
      { expectedVersion: '1', currentVersion: '2' },
    ],
    [409, 'IDEMPOTENCY_CONFLICT', {}, {}],
    [500, 'INTERNAL_ERROR', { stack: 'trace' }, {}],
  ] as const;

  it.each(
    GRANT_OPERATIONS.flatMap((spec) =>
      failures.map(([status, code, details, safe]) => ({
        spec,
        status,
        code,
        details,
        safe,
      })),
    ),
  )(
    '$spec.operationId maps a $status $code port failure to the allowlisted envelope',
    async ({ spec, status, code, details, safe }) => {
      const harness = makeGrantHarness({
        port: error(status, code, 'Port message.', { ...details }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(status);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe(code);
      expect(body.requestId).toBe(REQUEST_ID);
      expect(body.details).toEqual(safe);
    },
  );

  it.each(MUTATIONS)(
    '$operationId maps a 422 port failure to at most 50 pointer violations',
    async (spec) => {
      const violations = Array.from({ length: 60 }, (_, index) => ({
        pointer: `/validThrough/${index}`,
        code: 'GRANT_TERM_EXCEEDS_CEILING',
        message: 'The value is invalid.',
      }));
      const harness = makeGrantHarness({
        port: error(422, 'VALIDATION_FAILED', 'Invalid.', { violations }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(422);
      const body = (await response.json()) as {
        details: { violations: unknown[] };
      };
      expect(body.details.violations).toHaveLength(50);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId maps 503 to a retryable dependency envelope with Retry-After',
    async (spec) => {
      const harness = makeGrantHarness({
        port: error(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'down',
          { dependencyClass: 'cms_registry', retryable: true, sql: 'x' },
          5,
        ),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.details).toEqual({
        dependencyClass: 'cms_registry',
        retryable: true,
        retryAfterSeconds: 5,
      });
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId turns a wrong-shaped port success into 502 DEPENDENCY_INVALID_RESPONSE',
    async (spec) => {
      const harness = makeGrantHarness({ port: ok({ id: USER_ID }) });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(502);
      expect(((await response.json()) as { code: string }).code).toBe(
        'DEPENDENCY_INVALID_RESPONSE',
      );
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId converts a thrown port error into a scrubbed 503',
    async (spec) => {
      const harness = makeGrantHarness();
      harness.ports[spec.portName]?.mockRejectedValueOnce(
        new Error('select * from cms_capability_grants'),
      );
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('cms_capability_grants');
    },
  );
});

describe('grant handler idempotency (BE03a: same key replays, changed body conflicts)', () => {
  it.each(MUTATIONS)(
    '$operationId replays the same key and body once and rejects a changed body with 409',
    async (spec) => {
      const harness = makeGrantHarness();
      const first = await harness.app.request(grantRequestFor(spec));
      const second = await harness.app.request(grantRequestFor(spec));
      expect(first.status).toBe(spec.status);
      expect(second.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      const changed =
        spec.operationId === 'CMS-03A-15'
          ? { ...spec.body, capability: 'cms.editor' }
          : { ...spec.body, expectedVersion: '2' };
      const conflict = await harness.app.request(
        grantRequestFor(spec, {
          body: changed,
          ...(spec.ifMatch &&
          'expectedVersion' in changed &&
          changed.expectedVersion === '2'
            ? { headers: { 'if-match': '"2"' } }
            : {}),
        }),
      );
      expect(conflict.status).toBe(409);
      expect(((await conflict.json()) as { code: string }).code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
    },
  );
});

describe('grant step-up (401 STEP_UP_REQUIRED for CMS-03A-15, -16 and -17)', () => {
  it.each(STEP_UP)(
    '$operationId without recent MFA returns exactly 401 STEP_UP_REQUIRED and never reaches the port',
    async (spec) => {
      const harness = makeGrantHarness({
        session: ok(ownerSession({ mfaFresh: false })),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(401);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: [],
      });
      expect(text).not.toContain('reauthenticate');
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();
    },
  );

  it('CMS-03A-18 is a read and does not require step-up MFA', async () => {
    const harness = makeGrantHarness({
      session: ok(ownerSession({ mfaFresh: false })),
    });
    const response = await harness.app.request(grantRequestFor(LIST));
    expect(response.status).toBe(200);
    expect(harness.ports['listCapabilityGrants']).toHaveBeenCalledTimes(1);
  });

  it.each(STEP_UP)(
    '$operationId forwards an RPC-raised STEP_UP_REQUIRED with only allowlisted details',
    async (spec) => {
      const harness = makeGrantHarness({
        port: error(401, 'STEP_UP_REQUIRED', 'Recent verification.', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp', 'Bad Method!'],
          sql: 'select 1',
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
    },
  );

  it.each(STEP_UP)(
    '$operationId answers a stale session first with 401 UNAUTHENTICATED, never step-up',
    async (spec) => {
      const harness = makeGrantHarness({
        session: error(401, 'UNAUTHENTICATED', 'No session.', {
          recoveryAction: 'reauthenticate',
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(((await response.json()) as { code: string }).code).toBe(
        'UNAUTHENTICATED',
      );
    },
  );
});

describe('grant rate policy handed to the limiter (BE03a rate classes)', () => {
  it.each(GRANT_OPERATIONS)(
    '$operationId passes $rateClass $limit/60s with partyLimit $partyLimit and the acting party',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(harness.rateLimit).toHaveBeenCalledTimes(1);
      expect(harness.rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: spec.operationId,
          actorId: USER_ID,
          actingPartyId: PARTY_ID,
          principalClass: 'human',
          rateClass: spec.rateClass,
          limit: spec.limit,
          partyLimit: spec.partyLimit,
          windowSeconds: 60,
        }),
        expect.any(AbortSignal),
      );
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId returns 429 RATE_LIMITED with Retry-After and no port call when exhausted',
    async (spec) => {
      const harness = makeGrantHarness({
        rate: ok({
          allowed: false,
          limit: spec.limit,
          remaining: 0,
          resetAt: 1_788_345_660,
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(response.headers.get('ratelimit-limit')).toBe(String(spec.limit));
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        { limit: spec.limit, resetAt: 1_788_345_660, retryAfterSeconds: 5 },
      );
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId exposes RateLimit-* headers on success',
    async (spec) => {
      const harness = makeGrantHarness({
        rate: ok({
          allowed: true,
          limit: spec.limit,
          remaining: spec.limit - 1,
          resetAt: 1_788_345_660,
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.headers.get('ratelimit-limit')).toBe(String(spec.limit));
      expect(response.headers.get('ratelimit-remaining')).toBe(
        String(spec.limit - 1),
      );
      expect(response.headers.get('ratelimit-reset')).toBe('1788345660');
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId fails closed with 503 when the limiter is unavailable',
    async (spec) => {
      const harness = makeGrantHarness({
        rate: {
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'limiter down',
          details: { dependencyClass: 'rate_limiter', retryable: true },
          retryAfterSeconds: 5,
        },
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(503);
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();
    },
  );

  it('CMS-03A-15 does not consume a rate slot for a body rejected before the limiter', async () => {
    const spec = grantSpecFor('CMS-03A-15');
    const harness = makeGrantHarness();
    const response = await harness.app.request(
      grantRequestFor(spec, {
        body: { ...spec.body, capability: 'cms.schema_review' },
      }),
    );
    expect(response.status).toBe(422);
    expect(harness.rateLimit).not.toHaveBeenCalled();
  });
});
