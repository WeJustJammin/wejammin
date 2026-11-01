import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';
import {
  patternAdmission,
  patternSession,
  type CmsPatternDefinitionDependencies,
  type PatternError,
  type PatternRateInput,
} from './pattern-definition-ports';
import {
  patternErrorResponse,
  runPatternRoute,
} from './pattern-definition-response';
import {
  designerSession,
  ORIGIN,
  READ_PATH,
  readRequest,
  REQUEST_ID,
  WRITE_PATH,
  writeRequest,
} from './pattern-definition.test-support';

const errorOf = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());

const URL_BASE = 'https://api.example.test';

type Dependencies = CmsPatternDefinitionDependencies;
const bareDependencies = (over: Partial<Dependencies> = {}): Dependencies => ({
  humanOrigins: [ORIGIN],
  now: () => 1_000,
  resolveSession: vi.fn(),
  rateLimit: vi.fn(),
  definePattern: vi.fn(),
  readLatest: vi.fn(),
  telemetry: vi.fn(),
  ...over,
});

const decision = (input: PatternRateInput, over: object = {}) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 61,
    ...over,
  },
});

describe('patternSession fails closed on a malformed resolver answer', () => {
  const run = (resolved: () => Promise<unknown>) =>
    patternSession(
      bareDependencies({ resolveSession: resolved as never }),
      readRequest(),
      new AbortController().signal,
    );

  it('answers 502 for an answer that is not a result envelope', async () => {
    expect(await run(async () => 'session')).toMatchObject({
      ok: false,
      status: 502,
    });
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

describe('patternAdmission quota handling', () => {
  const admit = (
    dependencies: Dependencies,
    signal = new AbortController().signal,
  ) =>
    patternAdmission(
      dependencies,
      'cmsPatternLatestRead',
      readRequest(),
      designerSession,
      signal,
    );

  it('answers 502 for a quota answer that is not an envelope', async () => {
    expect(
      await admit(bareDependencies({ rateLimit: (async () => 7) as never })),
    ).toMatchObject({ status: 502 });
  });

  it.each([
    ['a different limit', { limit: 59 }],
    ['a remaining above the limit', { remaining: 61 }],
    ['a non-boolean allowance', { allowed: 'yes' }],
  ])('answers 502 for a quota decision with %s', async (_n, over) => {
    const rateLimit = vi.fn(async (input: PatternRateInput) =>
      decision(input, over),
    );
    expect(
      await admit(bareDependencies({ rateLimit: rateLimit as never })),
    ).toMatchObject({ status: 502 });
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it('answers a retryable 503 when the quota seam throws', async () => {
    const error = await admit(
      bareDependencies({
        rateLimit: (async () => {
          throw new Error('quota store down');
        }) as never,
      }),
    );
    expect(error).toMatchObject({ status: 503, retryAfterSeconds: 15 });
  });

  it('answers 504 when the caller aborts before the party quota is consumed', async () => {
    const controller = new AbortController();
    const rateLimit = vi.fn(async (input: PatternRateInput) => {
      controller.abort();
      return decision(input);
    });
    const error = await admit(
      bareDependencies({ rateLimit: rateLimit as never }),
      controller.signal,
    );
    expect(error).toMatchObject({ status: 504, retryAfterSeconds: 15 });
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it('answers 504 when the caller aborts as the last quota settles', async () => {
    const controller = new AbortController();
    const rateLimit = vi.fn(async (input: PatternRateInput) => {
      if (input.rateScope === 'party') controller.abort();
      return decision(input);
    });
    expect(
      await admit(
        bareDependencies({ rateLimit: rateLimit as never }),
        controller.signal,
      ),
    ).toMatchObject({ status: 504, retryAfterSeconds: 15 });
    expect(rateLimit).toHaveBeenCalledTimes(2);
  });
});

describe('patternErrorResponse projection', () => {
  const respond = (error: PatternError, operation = 'CMS-03C-12' as const) =>
    patternErrorResponse(
      writeRequest(),
      bareDependencies(),
      REQUEST_ID,
      operation,
      error,
    );
  const refusal = (
    status: number,
    details: Record<string, unknown>,
    retryAfterSeconds?: number,
  ): PatternError =>
    ({
      ok: false,
      status,
      code: 'X',
      message: 'x',
      details,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    }) as unknown as PatternError;

  it('scrubs a status the operation catalog does not publish to INTERNAL_ERROR 500', async () => {
    const response = respond(refusal(418, { reasonCode: 'x' }));
    expect(response.status).toBe(500);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.details).toEqual({});
  });

  it('keeps only canonical positive-integer version operands on a 409', async () => {
    const kept = respond(
      refusal(409, { expectedVersion: '3', currentVersion: '12' }),
    );
    expect(kept.status).toBe(409);
    expect((await errorOf(kept)).details).toEqual({
      expectedVersion: '3',
      currentVersion: '12',
    });
    const dropped = respond(
      refusal(409, { expectedVersion: '0', currentVersion: 4 }),
    );
    expect((await errorOf(dropped)).details).toEqual({});
  });

  it('answers a 429 without a usable retry hint with the 60 second window and no rate headers', async () => {
    const response = respond(
      refusal(429, { limit: 'thirty', resetAt: 61, retryAfterSeconds: -1 }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('ratelimit-reset')).toBeNull();
    expect((await errorOf(response)).details).toEqual({});
  });

  it('relays the window of a well-formed 429 as headers and details', async () => {
    const response = respond(
      refusal(429, { limit: 30, resetAt: '61', retryAfterSeconds: 7 }, 7),
    );
    expect(response.headers.get('retry-after')).toBe('7');
    expect(response.headers.get('ratelimit-limit')).toBe('30');
    expect(response.headers.get('ratelimit-reset')).toBe('61');
  });

  it('answers a dependency 503 with the first backoff when no hint is given', () => {
    expect(respond(refusal(503, {})).headers.get('retry-after')).toBe('15');
  });
});

describe('runPatternRoute lifecycle', () => {
  it('answers 504 for an already-aborted request without running the handler', async () => {
    const execute = vi.fn(async () => new Response('never'));
    const telemetry = vi.fn();
    const response = await runPatternRoute(
      new Request(`${URL_BASE}${WRITE_PATH}`, {
        signal: AbortSignal.abort(),
      }),
      bareDependencies({ telemetry }),
      REQUEST_ID,
      'CMS-03C-12',
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
    const response = await runPatternRoute(
      new Request(`${URL_BASE}${WRITE_PATH}`),
      bareDependencies(),
      REQUEST_ID,
      'CMS-03C-12',
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
      const response = await runPatternRoute(
        new Request(`${URL_BASE}${READ_PATH}`),
        bareDependencies({ telemetry: sink as never }),
        REQUEST_ID,
        'cmsPatternLatestRead',
        async () => new Response('ok', { status: 200 }),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
    },
  );
});
