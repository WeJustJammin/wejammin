import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@wejammin/observability/logging';

import {
  createPreviewTakedown,
  PREVIEW_TAKEDOWN_RPC,
  PreviewTakedownError,
  PreviewTakedownRequestSchema,
  PreviewTakedownResultSchema,
  type PreviewTakedownFailure,
  type PreviewTakedownInput,
} from './cms-editorial-production-preview-takedown';
import { json } from './cms-editorial-production.test-support';

/*
 * The preview takedown adapter (BE03b "Preview token and verification": revoked "by the service-role takedown
 * RPC"; DEC-156; tracker P2-S11-AC-118): one closed request to platform_api.cms_takedown_preview_tokens over the
 * Worker service credential, a strict { revokedTokens } answer, and a typed error for everything else: a takedown
 * is never assumed.
 */

const environment = {
  SUPABASE_URL: 'https://supabase.example.test//',
  SUPABASE_SECRET_KEY: 'sb_secret_takedown_test_only',
};
const correlationId = '123e4567-e89b-42d3-a456-426614174010';
const entryId = '123e4567-e89b-42d3-a456-426614174011';
const personId = '123e4567-e89b-42d3-a456-426614174012';
const byEntry: PreviewTakedownInput = { correlationId, entryId };

const harness = (
  responses: readonly (() => Response | Promise<Response>)[],
  options: { logger?: Logger; deadlineMs?: number } = {},
) => {
  const queue = [...responses];
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift() ?? responses.at(-1)!;
    return next();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const takedown = createPreviewTakedown({
    environment,
    fetchImpl,
    ...(options.logger === undefined ? {} : { logger: options.logger }),
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
  });
  return { takedown, fetchImpl };
};

const failureOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
};

describe('the request', () => {
  it('sends only the closed takedown request to the service RPC', async () => {
    const { takedown, fetchImpl } = harness([() => json({ revokedTokens: 2 })]);
    expect(await takedown(byEntry)).toEqual({ revokedTokens: 2 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://supabase.example.test/rest/v1/rpc/${PREVIEW_TAKEDOWN_RPC}`,
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: environment.SUPABASE_SECRET_KEY,
    });
    expect(JSON.parse(String(init.body))).toEqual({
      p_request: { reasonCode: 'takedown', correlationId, entryId },
    });
  });

  it('sends an entry, a person, or both, exactly as given', async () => {
    const { takedown, fetchImpl } = harness([() => json({ revokedTokens: 0 })]);
    await takedown({ correlationId, personId });
    await takedown({ correlationId, entryId, personId });
    const bodies = fetchImpl.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body)),
    );
    expect(bodies).toEqual([
      { p_request: { reasonCode: 'takedown', correlationId, personId } },
      {
        p_request: { reasonCode: 'takedown', correlationId, entryId, personId },
      },
    ]);
  });

  it('answers a repeated takedown with the idempotent zero', async () => {
    const { takedown } = harness([
      () => json({ revokedTokens: 1 }),
      () => json({ revokedTokens: 0 }),
    ]);
    expect(await takedown(byEntry)).toEqual({ revokedTokens: 1 });
    expect(await takedown(byEntry)).toEqual({ revokedTokens: 0 });
  });

  it('exposes the same strict schemas the database request and answer follow', () => {
    expect(
      PreviewTakedownRequestSchema.safeParse({
        reasonCode: 'takedown',
        correlationId,
        entryId,
      }).success,
    ).toBe(true);
    expect(
      PreviewTakedownResultSchema.safeParse({ revokedTokens: 3 }).success,
    ).toBe(true);
    expect(
      PreviewTakedownResultSchema.safeParse({ revokedTokens: 3, extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe('a malformed takedown never reaches the transport', () => {
  it.each([
    ['no target', { correlationId }],
    [
      'an uppercase entry id',
      { correlationId, entryId: entryId.toUpperCase() },
    ],
    ['a malformed entry id', { correlationId, entryId: 'nope' }],
    ['a malformed person id', { correlationId, personId: '1' }],
    ['no correlation id', { entryId }],
    ['a malformed correlation id', { correlationId: 'x', entryId }],
    ['an extra member', { correlationId, entryId, tokenHash: 'a'.repeat(64) }],
    [
      'another reason',
      { correlationId, entryId, reasonCode: 'authority_lost' },
    ],
  ])('refuses %s as invalid_request', async (_name, patch) => {
    const { takedown, fetchImpl } = harness([() => json({ revokedTokens: 1 })]);
    const error = await failureOf(
      takedown(patch as unknown as PreviewTakedownInput),
    );
    expect(error).toBeInstanceOf(PreviewTakedownError);
    expect((error as PreviewTakedownError).code).toBe('invalid_request');
    expect((error as PreviewTakedownError).retryable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('every failure is typed, never swallowed', () => {
  it.each<[string, () => Response | Promise<Response>, PreviewTakedownFailure]>(
    [
      [
        '401',
        () => json({ code: '42501', message: 'x' }, 401),
        'not_permitted',
      ],
      [
        '403',
        () => json({ code: '42501', message: 'x' }, 403),
        'not_permitted',
      ],
      [
        '400 INVALID_REQUEST',
        () => json({ code: 'P0001', message: 'INVALID_REQUEST' }, 400),
        'invalid_request',
      ],
      ['404', () => json({}, 404), 'invalid_request'],
      ['408', () => json({}, 408), 'unavailable'],
      ['409', () => json({ code: '40P01' }, 409), 'unavailable'],
      ['500', () => json({}, 500), 'unavailable'],
      ['503', () => json({}, 503), 'unavailable'],
      [
        'a network error',
        () => {
          throw new TypeError('network down');
        },
        'unavailable',
      ],
      [
        'a negative count',
        () => json({ revokedTokens: -1 }),
        'invalid_response',
      ],
      [
        'a fractional count',
        () => json({ revokedTokens: 1.5 }),
        'invalid_response',
      ],
      ['a missing count', () => json({}), 'invalid_response'],
      [
        'an extra member',
        () => json({ revokedTokens: 1, extra: true }),
        'invalid_response',
      ],
      ['an array', () => json([{ revokedTokens: 1 }]), 'invalid_response'],
      [
        'a non-JSON body',
        () =>
          new Response('not json', {
            headers: { 'content-type': 'application/json' },
          }),
        'invalid_response',
      ],
      [
        'a text content type',
        () =>
          new Response('{"revokedTokens":1}', {
            headers: { 'content-type': 'text/plain' },
          }),
        'invalid_response',
      ],
    ],
  )('%s is %s', async (_name, response, code) => {
    const { takedown, fetchImpl } = harness([response]);
    const error = await failureOf(takedown(byEntry));
    expect(error).toBeInstanceOf(PreviewTakedownError);
    expect((error as PreviewTakedownError).code).toBe(code);
    expect((error as PreviewTakedownError).retryable).toBe(
      code === 'unavailable',
    );
    // One attempt only: the caller owns the retry, the RPC being idempotent.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((error as Error).message).not.toContain(entryId);
  });

  it('is unavailable (retryable) when the deadline elapses', async () => {
    const { takedown } = harness(
      [() => new Promise<Response>(() => undefined)],
      {
        deadlineMs: 20,
      },
    );
    const error = await failureOf(takedown(byEntry));
    expect((error as PreviewTakedownError).code).toBe('unavailable');
    expect((error as PreviewTakedownError).retryable).toBe(true);
  });

  it('turns an unexpected transport exception into the typed unavailable error, never a raw one', async () => {
    const takedown = createPreviewTakedown({
      environment,
      fetchImpl: (() => {
        throw new Error('sync transport fault with a secret detail');
      }) as unknown as typeof fetch,
    });
    const error = await failureOf(takedown(byEntry));
    expect(error).toBeInstanceOf(PreviewTakedownError);
    expect((error as PreviewTakedownError).code).toBe('unavailable');
    expect((error as PreviewTakedownError).retryable).toBe(true);
    expect((error as Error).message).not.toContain('secret');
  });

  it('is unavailable when the caller aborts', async () => {
    const controller = new AbortController();
    const { takedown } = harness([
      () => {
        controller.abort();
        return new Promise<Response>(() => undefined);
      },
    ]);
    const error = await failureOf(takedown(byEntry, controller.signal));
    expect((error as PreviewTakedownError).code).toBe('unavailable');
  });
});

describe('defaults and logging', () => {
  it('uses the global fetch when none is injected', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ revokedTokens: 4 }));
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const takedown = createPreviewTakedown({ environment });
      expect(await takedown(byEntry)).toEqual({ revokedTokens: 4 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('logs the count and the correlation id on success, and a coded warning on failure, without any other identity', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const logger = { info, warn } as unknown as Logger;
    const ok = harness([() => json({ revokedTokens: 2 })], { logger });
    await ok.takedown({ correlationId, entryId, personId });
    const down = harness([() => json({}, 503)], { logger });
    await failureOf(down.takedown(byEntry));
    await failureOf(
      down.takedown({ correlationId: 'not-an-id' } as PreviewTakedownInput),
    );
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toMatchObject({
      eventName: 'cms.preview.takedown',
      outcome: 'success',
      correlationId,
      attributes: { revokedTokens: 2 },
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toMatchObject({
      eventName: 'cms.preview.takedown.failed',
      outcome: 'failure',
      errorCode: 'unavailable',
      retryable: true,
      correlationId,
    });
    expect(warn.mock.calls[1]![0]).toMatchObject({
      errorCode: 'invalid_request',
      retryable: false,
    });
    expect(warn.mock.calls[1]![0]).not.toHaveProperty('correlationId');
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    for (const identity of [entryId, personId, environment.SUPABASE_SECRET_KEY])
      expect(logged).not.toContain(identity);
  });
});
