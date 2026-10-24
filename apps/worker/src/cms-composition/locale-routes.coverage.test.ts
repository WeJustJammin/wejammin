import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CMS_LOCALE_OBSERVABILITY_EVENT,
  createLocaleObservabilityProbe,
  localeObservabilityWindow,
} from './locale-observability';
import {
  origin,
  READ_PATH,
  readDeps,
  readRequest,
} from './locale-read.test-support';
import { createCmsLocaleApp } from './locale-routes';

afterEach(() => {
  vi.useRealTimers();
});

const read = (overrides: Parameters<typeof readDeps>[0] = {}) => {
  const dependencies = readDeps(overrides);
  return createCmsLocaleApp(dependencies).request(readRequest());
};
const json = (response: Response) =>
  response.json() as Promise<{
    code: string;
    details: Record<string, unknown>;
  }>;

describe('cmsLocaleVariantRead request id', () => {
  it('mints a UUID request id when the browser sent none and echoes it on the answer', async () => {
    const response = await createCmsLocaleApp(readDeps()).request(
      new Request(`https://api.example.test${READ_PATH}`, {
        headers: { origin },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
  });
});

describe('cmsLocaleVariantRead session proof', () => {
  it('answers 401 with the reauthentication recovery for a session whose identity is malformed, charging no quota', async () => {
    const rateLimit = vi.fn(readDeps().rateLimit);
    const readLocaleVariant = vi.fn(readDeps().readLocaleVariant);
    const response = await read({
      rateLimit,
      readLocaleVariant,
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: 'not-a-uuid',
          actingPartyId: null,
          capabilities: ['cms.author'],
          mfaFresh: false,
        },
      }),
    });
    expect(response.status).toBe(401);
    expect((await json(response)).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(readLocaleVariant).not.toHaveBeenCalled();
  });
});

describe('cmsLocaleVariantRead quota faults (BE00 step 7)', () => {
  it('answers a retryable 503 and reads nothing when the limiter throws', async () => {
    const readLocaleVariant = vi.fn(readDeps().readLocaleVariant);
    const response = await read({
      readLocaleVariant,
      rateLimit: async () => {
        throw new Error('provider private limiter detail');
      },
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(await response.text()).not.toContain('provider private');
    expect(readLocaleVariant).not.toHaveBeenCalled();
  });

  it('answers 502 and reads nothing when the limiter answers something that is not an envelope', async () => {
    const readLocaleVariant = vi.fn(readDeps().readLocaleVariant);
    const response = await read({
      readLocaleVariant,
      rateLimit: async () => 'allowed' as never,
    });
    expect(response.status).toBe(502);
    expect(readLocaleVariant).not.toHaveBeenCalled();
  });

  it('relays a limiter refusal with its closed status and Retry-After, dropping its message', async () => {
    const response = await read({
      rateLimit: async () => ({
        ok: false,
        status: 503,
        code: 'UNTRUSTED',
        message: 'private provider text must not escape',
        details: { leaked: true },
        retryAfterSeconds: 9,
      }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('9');
    const body = await json(response);
    expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('private provider');
  });

  it('stops after the user bucket once the 8,000 ms deadline has aborted the work, charging no party bucket', async () => {
    vi.useFakeTimers();
    const rateLimit = vi.fn(async (input: { limit: number }) => {
      await vi.advanceTimersByTimeAsync(8_000);
      return {
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 2_000,
        },
      };
    });
    const readLocaleVariant = vi.fn(readDeps().readLocaleVariant);
    const response = await read({
      rateLimit: rateLimit as never,
      readLocaleVariant,
    });
    expect(response.status).toBe(504);
    expect(response.headers.get('retry-after')).toBe('15');
    // The aborted work resumes after the answer left: let it run to its end before asserting what it did.
    await vi.advanceTimersByTimeAsync(0);
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(readLocaleVariant).not.toHaveBeenCalled();
  });
});

describe('cmsLocaleVariantRead uncaught failure', () => {
  it('answers a scrubbed 500 and still emits one telemetry event when the route throws', async () => {
    const telemetry = vi.fn();
    let calls = 0;
    const response = await read({
      telemetry,
      // The clock is read for the start, then again to compute Retry-After of the denied bucket: that read throws.
      now: () => {
        calls += 1;
        if (calls === 2) throw new Error('provider private clock detail');
        return 1_000;
      },
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 2_000,
        },
      }),
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect((JSON.parse(text) as { code: string }).code).toBe('INTERNAL_ERROR');
    expect(text).not.toContain('private');
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry.mock.calls[0]?.[0]).toMatchObject({
      status: 500,
      outcome: 'failure',
    });
  });
});

describe('locale observability window (DEC-208)', () => {
  it('refuses a scheduled time whose window would start before the largest representable instant', () => {
    expect(() => localeObservabilityWindow(-8.64e15)).toThrow(
      'Invalid scheduled time',
    );
    expect(() => localeObservabilityWindow(8.64e15 + 1)).toThrow(
      'Invalid scheduled time',
    );
  });

  it('logs a failed sample and never reads when the window cannot be computed', async () => {
    const port = { read: vi.fn() };
    const telemetry = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await createLocaleObservabilityProbe({
      port,
      telemetry: telemetry as never,
    }).observe(-8.64e15);
    expect(port.read).not.toHaveBeenCalled();
    expect(telemetry.warn.mock.calls[0]?.[0]).toMatchObject({
      eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
      outcome: 'failure',
      errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
    });
  });
});
