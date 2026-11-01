import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';
import { governedTimeDetails } from './governed-activation-time-details';
import { governedErrorResponse } from './governed-review-errors';
import { policyOf } from './governed-review-policy';
import {
  failure,
  GOVERNED_MIN_RESPONSE_BYTES,
  governedQuota,
  governedSession,
  type CmsGovernedReviewDependencies,
  type GovernedError,
  type GovernedRateInput,
} from './governed-review-ports';
import { runGovernedRoute } from './governed-review-response';
import {
  designerSession,
  ORIGIN,
  PATH,
  REQUEST_ID,
  submitRequest,
} from './governed-review-submit.test-support';

const errorOf = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());

const bare = (
  over: Partial<CmsGovernedReviewDependencies> = {},
): CmsGovernedReviewDependencies => ({
  humanOrigins: [ORIGIN],
  now: () => 1_000,
  resolveSession: vi.fn(),
  rateLimit: vi.fn(),
  submitReview: vi.fn(),
  recordDecision: vi.fn(),
  assignReviewer: vi.fn(),
  activateReview: vi.fn(),
  readReview: vi.fn(),
  listReviews: vi.fn(),
  telemetry: vi.fn(),
  ...over,
});

const decision = (input: GovernedRateInput, over: object = {}) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 61,
    ...over,
  },
});

describe('governedSession fails closed on a malformed resolver answer', () => {
  const run = (resolved: () => Promise<unknown>) =>
    governedSession(
      bare({ resolveSession: resolved as never }),
      submitRequest(),
      new AbortController().signal,
    );

  it('answers 502 for an answer that is not a result envelope', async () => {
    expect(await run(async () => 42)).toMatchObject({ ok: false, status: 502 });
  });

  it.each([
    ['null', null],
    ['a string', 'session'],
  ])('answers 401 for a successful envelope carrying %s', async (_n, value) => {
    expect(await run(async () => ({ ok: true, value }))).toMatchObject({
      ok: false,
      status: 401,
    });
  });
});

describe('governedQuota fails closed', () => {
  const consume = (
    dependencies: CmsGovernedReviewDependencies,
    signal = new AbortController().signal,
  ) =>
    governedQuota(
      dependencies,
      'CMS-03C-06',
      submitRequest(),
      designerSession,
      signal,
    );

  it('answers 502 for a quota answer that is not an envelope', async () => {
    expect(
      await consume(bare({ rateLimit: (async () => null) as never })),
    ).toMatchObject({ status: 502 });
  });

  it.each([
    ['a different limit', { limit: 29 }],
    ['a fractional remaining', { remaining: 1.5 }],
  ])('answers 502 for a quota decision with %s', async (_n, over) => {
    const rateLimit = vi.fn(async (input: GovernedRateInput) =>
      decision(input, over),
    );
    expect(
      await consume(bare({ rateLimit: rateLimit as never })),
    ).toMatchObject({ status: 502 });
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it('answers a retryable 503 when the quota seam throws', async () => {
    expect(
      await consume(
        bare({
          rateLimit: (async () => {
            throw new Error('quota store down');
          }) as never,
        }),
      ),
    ).toMatchObject({ status: 503, retryAfterSeconds: 15 });
  });

  it('answers 504 when the caller aborts before the party quota is consumed', async () => {
    const controller = new AbortController();
    const rateLimit = vi.fn(async (input: GovernedRateInput) => {
      controller.abort();
      return decision(input);
    });
    expect(
      await consume(bare({ rateLimit: rateLimit as never }), controller.signal),
    ).toMatchObject({ status: 504, retryAfterSeconds: 15 });
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it('answers 504 when the caller aborts as the last quota settles', async () => {
    const controller = new AbortController();
    const rateLimit = vi.fn(async (input: GovernedRateInput) => {
      if (input.rateScope === 'party') controller.abort();
      return decision(input);
    });
    expect(
      await consume(bare({ rateLimit: rateLimit as never }), controller.signal),
    ).toMatchObject({ status: 504, retryAfterSeconds: 15 });
    expect(rateLimit).toHaveBeenCalledTimes(2);
  });
});

describe('governedErrorResponse projection', () => {
  const respond = (
    error: GovernedError,
    operation: Parameters<typeof governedErrorResponse>[3] = 'CMS-03C-06',
  ) =>
    governedErrorResponse(
      submitRequest(),
      bare(),
      REQUEST_ID,
      operation,
      error,
    );
  const refusal = (
    status: number,
    details: unknown,
    retryAfterSeconds?: number,
  ): GovernedError =>
    ({
      ok: false,
      status,
      code: 'X',
      message: 'x',
      details,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    }) as unknown as GovernedError;

  it('names a repeated request pointer once and keeps the other members', async () => {
    const [first, second] = [...policyOf('CMS-03C-06').pointers];
    const response = respond(
      refusal(422, {
        violations: [
          { path: first },
          { path: first },
          { path: second },
          { path: '/attacker' },
          'not-an-object',
          { path: '/attacker-two' },
        ],
      }),
    );
    expect(response.status).toBe(422);
    expect((await errorOf(response)).details).toEqual({
      violations: [
        { path: first, code: 'invalid', message: 'The value is invalid.' },
        { path: second, code: 'invalid', message: 'The value is invalid.' },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'private provider text'],
  ])('projects no members from %s details', async (_n, details) => {
    const response = respond(refusal(409, details));
    expect(response.status).toBe(409);
    expect((await errorOf(response)).details).toEqual({});
  });

  it('drops a canonical domain that is not a registered domain', async () => {
    const response = respond(
      refusal(422, {
        reasonCode: 'canonical_source_unavailable',
        domain: 'not-a-domain',
      }),
    );
    expect(response.status).toBe(422);
    expect((await errorOf(response)).details).toEqual({
      reasonCode: 'canonical_source_unavailable',
    });
  });

  it('relays a registered canonical domain with its reason', async () => {
    const response = respond(
      refusal(422, {
        reasonCode: 'canonical_source_unavailable',
        domain: 'instrument',
      }),
    );
    expect((await errorOf(response)).details).toEqual({
      reasonCode: 'canonical_source_unavailable',
      domain: 'instrument',
    });
  });

  it('answers a 429 without a usable hint with the 60 second window and no rate headers', async () => {
    const response = respond(
      refusal(429, { limit: 'thirty', resetAt: 61, retryAfterSeconds: 0.5 }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('ratelimit-reset')).toBeNull();
    expect((await errorOf(response)).details).toEqual({});
  });

  it('relays the window of a well-formed 429 as headers', async () => {
    const response = respond(
      refusal(429, { limit: 30, resetAt: '61', retryAfterSeconds: 9 }, 9),
    );
    expect(response.headers.get('retry-after')).toBe('9');
    expect(response.headers.get('ratelimit-limit')).toBe('30');
    expect(response.headers.get('ratelimit-reset')).toBe('61');
  });

  it('scrubs a response over the configured budget to a bare 500', async () => {
    const response = governedErrorResponse(
      submitRequest(),
      bare({ maxResponseBytes: GOVERNED_MIN_RESPONSE_BYTES }),
      REQUEST_ID,
      'CMS-03C-06',
      failure(503, {}, 15),
    );
    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INTERNAL_ERROR',
    );
  });
});

describe('governedTimeDetails ignores violation entries that are not records', () => {
  it('keeps only the pointer-bound violations of record entries', () => {
    const details = governedTimeDetails(
      'tzdb_version_mismatch',
      {
        pinnedVersion: '2026a',
        violations: [null, 'x', ['/a'], { path: '/activateAt' }, { path: 3 }],
      },
      new Set(['/activateAt']),
    );
    expect(details).toMatchObject({
      reasonCode: 'tzdb_version_mismatch',
      violations: [{ path: '/activateAt', code: 'tzdb_version_mismatch' }],
    });
    expect((details as { violations: unknown[] }).violations).toHaveLength(1);
  });
});

describe('runGovernedRoute lifecycle', () => {
  const url = `https://api.example.test${PATH}`;

  it('answers 504 for an already-aborted request without running the handler', async () => {
    const execute = vi.fn(async () => new Response('never'));
    const telemetry = vi.fn();
    const response = await runGovernedRoute(
      new Request(url, { signal: AbortSignal.abort() }),
      bare({ telemetry }),
      REQUEST_ID,
      'CMS-03C-06',
      execute,
    );
    expect(response.status).toBe(504);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(execute).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 504, outcome: 'failure' }),
    );
  });

  it('answers the scrubbed 500 when the handler throws', async () => {
    const response = await runGovernedRoute(
      new Request(url),
      bare(),
      REQUEST_ID,
      'CMS-03C-06',
      async () => {
        throw new Error('handler fault');
      },
    );
    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INTERNAL_ERROR',
    );
  });

  it.each([
    ['rejects', async () => Promise.reject(new Error('sink down'))],
    [
      'throws',
      () => {
        throw new Error('sink down');
      },
    ],
  ])(
    'keeps the decided response when the telemetry sink %s',
    async (_n, sink) => {
      const response = await runGovernedRoute(
        new Request(url),
        bare({ telemetry: sink as never }),
        REQUEST_ID,
        'CMS-03C-06',
        async () => new Response('ok', { status: 200 }),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
    },
  );
});
