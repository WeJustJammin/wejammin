import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '@wejammin/observability/logging';

import { previewVerificationDenial } from '@wejammin/contracts';

import {
  createPreviewTokenVerifier,
  PREVIEW_VERIFIER_RPC,
  type PreviewVerificationInput,
} from './cms-editorial-production-preview-verifier';
import { versionSet } from './cms-editorial/workflow-fixtures.test-support';
import { json } from './cms-editorial-production.test-support';

/*
 * CMS-03B-19 verifier adapter (BE04c seam): the token is hashed here and never
 * sent; the call is bounded at 500 ms with retries at 75 and 150 ms and a 30 s
 * circuit; every failure is the one byte-identical denial.
 */

const environment = {
  SUPABASE_URL: 'https://supabase.example.test//',
  SUPABASE_SECRET_KEY: 'sb_secret_verifier_test_only',
};
const token = 'Zx9'.padEnd(43, 'A');
const input: PreviewVerificationInput = {
  token,
  actorPersonId: '123e4567-e89b-42d3-a456-426614174000',
  actingContextVersion: 'c'.repeat(64),
  route: '/music/artist/spring-2026-tour',
  locale: 'en-US',
  audience: 'members',
};
const valid = {
  valid: true,
  userId: '123e4567-e89b-42d3-a456-426614174000',
  entryId: '123e4567-e89b-42d3-a456-426614174001',
  revisionId: '123e4567-e89b-42d3-a456-426614174002',
  exactVersionSet: versionSet,
  expiresAt: '2026-10-08T12:15:00Z',
  revoked: false,
};
const sha256 = async (text: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const harness = (
  responses: readonly (() => Response | Promise<Response>)[],
  options: { clock?: { value: number }; logger?: Logger } = {},
) => {
  const queue = [...responses];
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift() ?? responses.at(-1)!;
    return next();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const sleep = vi.fn(async () => undefined);
  const clock = options.clock ?? { value: 1_000_000 };
  const verify = createPreviewTokenVerifier({
    environment,
    fetchImpl,
    sleep,
    now: () => clock.value,
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  return { verify, fetchImpl, sleep, clock };
};

const failing = () => json({ code: 'XX000' }, 503);
const denial = JSON.stringify(previewVerificationDenial());

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the request', () => {
  it('sends only the SHA-256 of the token and the exact binding to the service RPC', async () => {
    const { verify, fetchImpl } = harness([() => json(valid)]);
    expect(await verify(input)).toEqual(valid);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://supabase.example.test/rest/v1/rpc/${PREVIEW_VERIFIER_RPC}`,
    );
    expect(init.headers).toMatchObject({
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      apikey: environment.SUPABASE_SECRET_KEY,
      'X-Operation-Id': 'CMS-03B-19',
    });
    const body = String(init.body);
    expect(JSON.parse(body)).toEqual({
      p_request: {
        tokenHash: await sha256(token),
        actorPersonId: input.actorPersonId,
        actingContextVersion: input.actingContextVersion,
        route: input.route,
        locale: input.locale,
        audience: input.audience,
      },
    });
    expect(body).not.toContain(token);
  });
});

describe('results', () => {
  it('passes a denial through, including the bound actor revoked flag', async () => {
    for (const revoked of [false, true]) {
      const { verify } = harness([
        () => json(previewVerificationDenial(revoked)),
      ]);
      expect(await verify(input)).toEqual(previewVerificationDenial(revoked));
    }
  });

  it('treats a malformed token or binding as the denial without a call', async () => {
    const { verify, fetchImpl } = harness([() => json(valid)]);
    for (const patch of [
      { token: 'short' },
      { token: `${token.slice(1)}=` },
      { route: 'x'.repeat(5000) },
      { locale: 'not a locale' },
      { actingContextVersion: 'zz' },
      { audience: 'Bad Audience' },
    ])
      expect(JSON.stringify(await verify({ ...input, ...patch }))).toBe(denial);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('failure handling', () => {
  it('retries a failed attempt after 75 then 150 ms and returns the first typed result', async () => {
    const { verify, fetchImpl, sleep } = harness([
      failing,
      failing,
      () => json(valid),
    ]);
    expect(await verify(input)).toEqual(valid);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[75], [150]]);
  });

  it('answers the byte-identical denial for every kind of failed attempt', async () => {
    const shapes: (() => Response)[] = [
      failing,
      () => json({ ...valid, valid: 'maybe' }),
      () => json([valid, valid]),
      () => json({ ...valid, extra: 1 }),
      () =>
        new Response('not json', {
          headers: { 'content-type': 'application/json' },
        }),
      () => new Response('{}', { headers: { 'content-type': 'text/plain' } }),
      () => json({ code: '42501', message: 'permission denied' }, 401),
      () => {
        throw new TypeError('network down');
      },
    ];
    for (const shape of shapes) {
      const { verify, fetchImpl } = harness([shape]);
      expect(JSON.stringify(await verify(input))).toBe(denial);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    }
  });

  it('opens the circuit for 30 seconds after three failed attempts', async () => {
    const { verify, fetchImpl, clock } = harness([failing]);
    expect(JSON.stringify(await verify(input))).toBe(denial);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    clock.value += 29_999;
    expect(JSON.stringify(await verify(input))).toBe(denial);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    clock.value += 1;
    expect(JSON.stringify(await verify(input))).toBe(denial);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('closes the circuit on the first typed result after the window', async () => {
    const { verify, fetchImpl, clock } = harness([
      failing,
      failing,
      failing,
      () => json(valid),
    ]);
    await verify(input);
    clock.value += 30_000;
    expect(await verify(input)).toEqual(valid);
    expect(await verify(input)).toEqual(valid);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('bounds an attempt at 500 ms', async () => {
    const starts: number[] = [];
    const { verify } = harness([
      () => {
        starts.push(Date.now());
        return new Promise<Response>(() => undefined);
      },
    ]);
    const began = Date.now();
    expect(JSON.stringify(await verify(input))).toBe(denial);
    const elapsed = Date.now() - began;
    expect(starts).toHaveLength(3);
    // Three 500 ms attempts; the injected pauses are instant.
    expect(elapsed).toBeGreaterThanOrEqual(1_450);
    expect(elapsed).toBeLessThan(5_000);
  });

  it('gives up without opening the circuit when the caller aborts', async () => {
    const controller = new AbortController();
    const { verify, fetchImpl } = harness([
      () => {
        controller.abort();
        return failing();
      },
      () => json(valid),
    ]);
    expect(JSON.stringify(await verify(input, controller.signal))).toBe(denial);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await verify(input)).toEqual(valid);
  });
});

describe('defaults and telemetry', () => {
  it('uses the global fetch, the host clock and a real pause when none is injected', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValue(json(valid));
    vi.stubGlobal('fetch', fetchImpl);
    const verify = createPreviewTokenVerifier({ environment });
    const began = Date.now();
    expect(await verify(input)).toEqual(valid);
    expect(Date.now() - began).toBeGreaterThanOrEqual(70);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('counts verifications by validity and warns when the circuit opens, without any identity', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const logger = { info, warn } as unknown as Logger;
    const ok = harness([() => json(valid)], { logger });
    await ok.verify(input);
    await ok.verify({ ...input, token: 'short' });
    const down = harness([failing], { logger });
    await down.verify(input);
    const metrics = info.mock.calls.map(
      (call) => (call[0] as { metrics: Record<string, number> }).metrics,
    );
    expect(metrics).toEqual([
      { 'cms_preview_verify_total{valid="true"}': 1 },
      { 'cms_preview_verify_total{valid="false"}': 1 },
      { 'cms_preview_verify_total{valid="false"}': 1 },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    for (const secret of [token, input.actorPersonId, await sha256(token)])
      expect(logged).not.toContain(secret);
  });
});
