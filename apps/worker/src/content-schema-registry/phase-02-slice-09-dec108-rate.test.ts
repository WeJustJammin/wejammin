import { describe, expect, it } from 'vitest';

import {
  PARTY_ID,
  REQUEST_ID,
  TYPE_ID,
  USER_ID,
  VERSION_ID,
  ok,
  session,
  validActivation,
  validDraft,
  validField,
  validRelation,
} from './phase-02-slice-09-test-values';
import {
  OPERATIONS,
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { CMS_ORIGIN } from './phase-02-slice-09-dec108-test-values';

const base = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;

type ExistingRateCase = Readonly<{
  operationId: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  ifMatch: boolean;
  rateClass: string;
  limit: number;
  partyLimit: number;
}>;

/** Route-policy limits for the pre-DEC-108 human operations. */
const EXISTING: readonly ExistingRateCase[] = [
  {
    operationId: 'CMS-03A-01',
    method: 'POST',
    path: '/api/v1/cms/content-types',
    body: validDraft,
    ifMatch: false,
    rateClass: 'cms-definition-write',
    limit: 30,
    partyLimit: 60,
  },
  {
    operationId: 'CMS-03A-02',
    method: 'POST',
    path: `${base}/fields`,
    body: validField,
    ifMatch: true,
    rateClass: 'cms-definition-write',
    limit: 60,
    partyLimit: 120,
  },
  {
    operationId: 'CMS-03A-03',
    method: 'POST',
    path: `${base}/relations`,
    body: validRelation,
    ifMatch: true,
    rateClass: 'cms-definition-write',
    limit: 60,
    partyLimit: 120,
  },
  {
    operationId: 'CMS-03A-04',
    method: 'POST',
    path: `${base}/activate`,
    body: validActivation,
    ifMatch: true,
    rateClass: 'cms-activation',
    limit: 10,
    partyLimit: 20,
  },
  {
    operationId: 'CMS-03A-06',
    method: 'GET',
    path: '/api/v1/cms/content-types',
    ifMatch: false,
    rateClass: 'cms-definition-read',
    limit: 120,
    partyLimit: 240,
  },
  {
    operationId: 'CMS-03A-07',
    method: 'GET',
    path: base,
    ifMatch: false,
    rateClass: 'cms-definition-read',
    limit: 120,
    partyLimit: 240,
  },
];

const existingRequest = (spec: ExistingRateCase): Request =>
  new Request(`https://api.example.test${spec.path}`, {
    method: spec.method,
    headers: {
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'x-request-id': REQUEST_ID,
      ...(spec.method === 'POST'
        ? {
            'content-type': 'application/json',
            'idempotency-key': 'cms-dec108-key-001',
            ...(spec.ifMatch ? { 'if-match': '"1"' } : {}),
          }
        : {}),
    },
    ...(spec.method === 'POST' ? { body: JSON.stringify(spec.body) } : {}),
  });

describe('DEC-108 per-operation rate policy handed to the limiter (BE03a rate classes)', () => {
  it.each(OPERATIONS)(
    '$operationId passes $rateClass $limit/60s with the per-party limit $partyLimit and the acting party',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec));
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

  it.each(EXISTING)(
    '$operationId also hands its per-party limit $partyLimit to the limiter',
    async (spec) => {
      const harness = makeDec108Harness({ session: ok(session) });
      const response = await harness.app.request(existingRequest(spec));
      expect(response.status).toBeLessThan(300);
      expect(harness.rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: spec.operationId,
          rateClass: spec.rateClass,
          limit: spec.limit,
          partyLimit: spec.partyLimit,
        }),
        expect.any(AbortSignal),
      );
    },
  );
});

describe('DEC-108 rate refusal and headers', () => {
  it.each(OPERATIONS)(
    '$operationId returns 429 RATE_LIMITED with Retry-After and no port call when the bucket is exhausted',
    async (spec) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        rate: ok({
          allowed: false,
          limit: spec.limit,
          remaining: 0,
          resetAt: 1_788_345_660,
        }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(response.headers.get('ratelimit-limit')).toBe(String(spec.limit));
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('RATE_LIMITED');
      expect(body.details).toEqual({
        limit: spec.limit,
        resetAt: 1_788_345_660,
        retryAfterSeconds: 5,
      });
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();
    },
  );

  it.each(OPERATIONS)(
    '$operationId exposes the RateLimit-* headers on success',
    async (spec) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        rate: ok({
          allowed: true,
          limit: spec.limit,
          remaining: spec.limit - 1,
          resetAt: 1_788_345_660,
        }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(response.headers.get('ratelimit-limit')).toBe(String(spec.limit));
      expect(response.headers.get('ratelimit-remaining')).toBe(
        String(spec.limit - 1),
      );
      expect(response.headers.get('ratelimit-reset')).toBe('1788345660');
    },
  );

  it('CMS-03A-12 does not consume a rate slot for a body rejected before the limiter', async () => {
    const spec = specFor('CMS-03A-12');
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const response = await harness.app.request(
      requestFor(spec, { body: { expectedVersion: '1', decision: 'maybe' } }),
    );
    expect(response.status).toBe(422);
    expect(harness.rateLimit).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the limiter is unavailable', async () => {
    const spec = specFor('CMS-03A-14');
    const harness = makeDec108Harness({
      session: sessionResult(spec),
      rate: {
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'limiter down',
        details: { dependencyClass: 'rate_limiter', retryable: true },
        retryAfterSeconds: 5,
      },
    });
    const response = await harness.app.request(requestFor(spec));
    expect(response.status).toBe(503);
    expect(harness.ports['assignSchemaReview']).not.toHaveBeenCalled();
  });
});
