import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RATE_LIMIT_WAIT_MAX_SECONDS,
  SAFE_READ_RETRY_DELAYS_MS,
  rateLimitMessage,
  rateLimitWaitSeconds,
  retryingSafeRead,
} from './safe-read-retry';

const apiError = (
  status: number,
  details: Record<string, unknown> = { retryable: true },
): Response =>
  new Response(JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE', details }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Resolves the read while advancing the fake clock `steps` times. */
const settle = async <T>(
  promise: Promise<T>,
  steps: readonly number[] = [],
): Promise<T> => {
  for (const step of steps) await vi.advanceTimersByTimeAsync(step);
  return promise;
};

describe('retryingSafeRead (FE03 :1173)', () => {
  it('waits 250 ms, then 750 ms, between the two retries of a declared-retryable dependency error', async () => {
    expect(SAFE_READ_RETRY_DELAYS_MS).toEqual([250, 750]);
    const ok = new Response('{}', { status: 200 });
    const read = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(apiError(503))
      .mockResolvedValueOnce(apiError(502))
      .mockResolvedValueOnce(ok);
    const pending = retryingSafeRead(read);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(249);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(749);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(3);
    expect(await pending).toBe(ok);
  });

  it('stops after two retries and returns the last answer for the degraded state', async () => {
    const last = apiError(504);
    const read = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(apiError(503))
      .mockResolvedValueOnce(apiError(503))
      .mockResolvedValueOnce(last)
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const result = await settle(retryingSafeRead(read), [250, 750, 60_000]);
    expect(read).toHaveBeenCalledTimes(3);
    expect(result).toBe(last);
  });

  it.each([502, 503, 504])('retries a %i', async (status) => {
    const read = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(apiError(status))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await settle(retryingSafeRead(read), [250]);
    expect(result.status).toBe(200);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 500', apiError(500)],
    ['a 429', apiError(429)],
    ['a 404', apiError(404, {})],
    ['a 503 that does not declare a retry safe', apiError(503, {})],
    [
      'a 503 that declares retryable false',
      apiError(503, { retryable: false }),
    ],
    ['a 503 whose body is not JSON', new Response('down', { status: 503 })],
    [
      'a 503 whose details are not an object',
      apiError(503, 'retry' as unknown as Record<string, unknown>),
    ],
    ['a 200', new Response('{}', { status: 200 })],
  ])('does not retry %s', async (_name, response) => {
    const read = vi.fn<() => Promise<Response>>().mockResolvedValue(response);
    const result = await settle(retryingSafeRead(read), [10_000]);
    expect(result).toBe(response);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('leaves the body of the answer it returns unread', async () => {
    const read = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValue(apiError(503));
    const result = await settle(retryingSafeRead(read), [250, 750]);
    expect(result.bodyUsed).toBe(false);
    expect(((await result.json()) as { code: string }).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('lets a network failure propagate to the caller and does not retry it', async () => {
    const read = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValue(new Error('offline'));
    await expect(retryingSafeRead(read)).rejects.toThrow('offline');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('takes the sleep as a seam', async () => {
    const sleep = vi.fn(async () => undefined);
    const read = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValue(apiError(503));
    await retryingSafeRead(read, { sleep });
    expect(sleep.mock.calls).toEqual([[250], [750]]);
    expect(read).toHaveBeenCalledTimes(3);
  });
});

const limited = (
  headers: Record<string, string>,
  body: unknown = { code: 'RATE_LIMITED', details: {} },
): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 429,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('rateLimitWaitSeconds (FE03 :1172, 429 waits for Retry-After)', () => {
  it.each([
    ['1', 1],
    ['30', 30],
    ['86400', 86_400],
    // RFC 9110 delay-seconds is 1*DIGIT: leading zeros are well-formed.
    ['007', 7],
    ['01', 1],
    ['0086400', 86_400],
    [`${'0'.repeat(30)}7`, 7],
  ])('reads the whole-second header %s', async (header, seconds) => {
    expect(await rateLimitWaitSeconds(limited({ 'retry-after': header }))).toBe(
      seconds,
    );
  });

  it.each([
    '0',
    '00',
    '-1',
    '1.5',
    '+7',
    '1e2',
    '0x10',
    '12s',
    '5 5',
    '',
    '86401',
    '0086401',
    '123456',
    '9'.repeat(40),
  ])('refuses the header %j', async (header) => {
    expect(
      await rateLimitWaitSeconds(limited({ 'retry-after': header })),
    ).toBeNull();
  });

  it('falls back to the ApiError details when the header is absent', async () => {
    expect(
      await rateLimitWaitSeconds(
        limited(
          {},
          { code: 'RATE_LIMITED', details: { retryAfterSeconds: 7 } },
        ),
      ),
    ).toBe(7);
  });

  it('refuses a header and a body that disagree', async () => {
    expect(
      await rateLimitWaitSeconds(
        limited(
          { 'retry-after': '5' },
          { code: 'RATE_LIMITED', details: { retryAfterSeconds: 7 } },
        ),
      ),
    ).toBeNull();
  });

  it.each([0, -3, 2.5, 86_401, '7', null, true])(
    'refuses the body value %j',
    async (value) => {
      expect(
        await rateLimitWaitSeconds(
          limited(
            {},
            { code: 'RATE_LIMITED', details: { retryAfterSeconds: value } },
          ),
        ),
      ).toBeNull();
    },
  );

  it('is null with no header and an unreadable or non-object body', async () => {
    expect(await rateLimitWaitSeconds(limited({}, 'busy'))).toBeNull();
    expect(await rateLimitWaitSeconds(limited({}, 'null'))).toBeNull();
    expect(await rateLimitWaitSeconds(limited({}, '[]'))).toBeNull();
  });

  it('leaves the body of the answer unread', async () => {
    const response = limited(
      {},
      { code: 'RATE_LIMITED', details: { retryAfterSeconds: 4 } },
    );
    await rateLimitWaitSeconds(response);
    expect(response.bodyUsed).toBe(false);
  });

  it('bounds the wait at one day', () => {
    expect(RATE_LIMIT_WAIT_MAX_SECONDS).toBe(86_400);
  });
});

describe('rateLimitMessage', () => {
  it('names the remaining wait and says the input is kept', () => {
    expect(rateLimitMessage(1)).toBe(
      'Too many requests. Try again in 1 second. Your input is kept.',
    );
    expect(rateLimitMessage(30)).toBe(
      'Too many requests. Try again in 30 seconds. Your input is kept.',
    );
  });

  it('says to wait when the server stated no delay', () => {
    expect(rateLimitMessage(null)).toBe(
      'Too many requests. Wait a moment, then try again. Your input is kept.',
    );
  });
});
