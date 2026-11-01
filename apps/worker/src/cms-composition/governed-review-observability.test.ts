import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  expectError,
  governedHarness,
  HASH,
  IDEMPOTENCY_KEY,
  jsonReply,
  PARTY_ID,
  REQUEST_ID,
  reviewResource,
  sqlRefusal,
  submitRequest,
  USER_ID,
} from './governed-review-submit.test-support';

const CORRELATION_ID = 'd1200000-0000-4000-8000-000000000297';

describe('CMS-03C-06 retry, rate and violation response members', () => {
  it.each([500, 502, 503, 504])(
    'sends retry-after 15 with a provider %i answered as 503',
    async (status) => {
      const harness = governedHarness({
        reply: () => jsonReply({ code: 'PGRST000' }, status),
      });
      const response = await harness.send(submitRequest());
      await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
      expect(response.headers.get('retry-after')).toBe('15');
    },
  );

  it('sends no retry-after with a local 502 or a scrubbed 500', async () => {
    const invalid = governedHarness({
      reply: async () => new Response('not json', { status: 200 }),
    });
    const local = await invalid.send(submitRequest());
    await expectError(local, 502, 'DEPENDENCY_UNAVAILABLE');
    expect(local.headers.get('retry-after')).toBeNull();
    const scrubbed = governedHarness({
      reply: () => sqlRefusal('INTERNAL_ERROR'),
    });
    const internal = await scrubbed.send(submitRequest());
    await expectError(internal, 500, 'INTERNAL_ERROR');
    expect(internal.headers.get('retry-after')).toBeNull();
  });

  it.each([
    ['user', 30],
    ['party', 60],
  ] as const)(
    'publishes rate headers and details when the %s quota (%i/min) is denied',
    async (scope, limit) => {
      const harness = governedHarness({
        tuning: {
          rateLimit: async (input) => ({
            ok: true,
            value: {
              allowed: input.rateScope !== scope,
              limit: input.limit,
              remaining: input.rateScope === scope ? 0 : input.limit - 1,
              resetAt: 61,
            },
          }),
        },
      });
      const response = await harness.send(submitRequest());
      const error = await expectError(response, 429, 'RATE_LIMITED');
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-limit')).toBe(String(limit));
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('ratelimit-reset')).toBe('61');
      expect(error.details).toEqual({
        retryAfterSeconds: 60,
        limit,
        resetAt: '61',
      });
    },
  );

  it('maps a stored-hash mismatch raised as VALIDATION_FAILED at /subjectHash to 422 (BE03c 389)', async () => {
    const harness = governedHarness({
      reply: () => sqlRefusal('VALIDATION_FAILED', '["/subjectHash"]'),
    });
    const error = await expectError(
      await harness.send(submitRequest()),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(error.details).toEqual({
      violations: [
        {
          path: '/subjectHash',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('never echoes a pointer outside the request allowlist', async () => {
    const harness = governedHarness({
      reply: () =>
        sqlRefusal('VALIDATION_FAILED', '["/private/path","/subjectHash"]'),
    });
    const error = await expectError(
      await harness.send(submitRequest()),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(JSON.stringify(error)).not.toContain('private');
    // An unlisted pointer collapses to the root; only the allowlisted one survives.
    expect(
      (error.details.violations as { path: string }[]).map(
        (violation) => violation.path,
      ),
    ).toEqual(['/', '/subjectHash']);
  });
});

describe('CMS-03C-06 correlation and telemetry', () => {
  it.each([
    ['a valid x-correlation-id', CORRELATION_ID, CORRELATION_ID],
    ['an invalid x-correlation-id', 'not-a-uuid', REQUEST_ID],
    ['no x-correlation-id', undefined, REQUEST_ID],
  ] as const)(
    'forwards %s as the request correlation',
    async (_name, supplied, expected) => {
      const harness = governedHarness({
        reply: () => jsonReply(reviewResource()),
      });
      const request = submitRequest();
      if (supplied !== undefined)
        request.headers.set('x-correlation-id', supplied);
      expect((await harness.send(request)).status).toBe(201);
      const call = harness.fetchImpl.mock.calls[0];
      expect(new Headers(call?.[1]?.headers).get('x-correlation-id')).toBe(
        expected,
      );
      const wire = JSON.parse(String(call?.[1]?.body)) as {
        p_request: {
          correlationId: string;
          context: { correlationId: string };
        };
      };
      expect(wire.p_request.correlationId).toBe(expected);
      expect(wire.p_request.context.correlationId).toBe(expected);
    },
  );

  it('emits one scrubbed request event with route facts only', async () => {
    const lines: string[] = [];
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'slice-12',
        service: 'wejammin-api',
      },
      { sink: (line) => lines.push(line) },
    );
    const harness = governedHarness({
      tuning: { logger },
      reply: () => sqlRefusal('NOT_FOUND', 'private provider'),
    });
    await harness.send(submitRequest());
    const events = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter(
        (line) => line.eventName === 'cms.composition.governed_review.request',
      );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: 'cms.composition.governed_review.submit',
      requestId: REQUEST_ID,
      outcome: 'rejected',
      attributes: {
        actor_class: 'human',
        status: 404,
        runbook: 'cms-composition',
      },
    });
    const serialized = JSON.stringify(events[0]);
    for (const secret of [HASH, IDEMPOTENCY_KEY, USER_ID, PARTY_ID, 'private'])
      expect(serialized).not.toContain(secret);
  });
});
