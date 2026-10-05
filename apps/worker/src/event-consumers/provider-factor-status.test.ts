import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { createProviderFactorStatusPort } from './provider-factor-status';
import { IDS, NOW } from './test-support';

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as never;

const other = '99999999-9999-4999-8999-999999999999';
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const build = (
  reply: (url: string, init: RequestInit) => Response | Promise<Response>,
) => {
  const calls: Array<Readonly<{ url: string; init: RequestInit }>> = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return reply(url, init);
  });
  const config = normalizeAuthProductionOptions({
    environment: bindings,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
  });
  return { calls, fetchImpl, port: createProviderFactorStatusPort(config) };
};

const read = (port: ReturnType<typeof build>['port']) =>
  port.readStatus(
    { authUserId: IDS.authUser, providerFactorId: IDS.providerFactor },
    new AbortController().signal,
  );

afterEach(() => {
  vi.useRealTimers();
});

const hangingUntilAborted = (
  _url: string,
  init: RequestInit,
): Promise<Response> =>
  new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

describe('provider factor status adapter', () => {
  it.each([
    ['verified', 'verified'],
    ['unverified', 'unverified'],
  ] as const)(
    '[P2-S09-AC-913] reports a %s provider factor as %s',
    async (status, expected) => {
      const { port } = build(() =>
        json([
          { id: other, status: 'verified' },
          { id: IDS.providerFactor, status },
        ]),
      );
      await expect(read(port)).resolves.toBe(expected);
    },
  );

  it('[P2-S09-AC-913] reports a factor missing from the provider list as absent', async () => {
    const { port } = build(() => json([{ id: other, status: 'verified' }]));
    await expect(read(port)).resolves.toBe('absent');
  });

  it('reports a provider 404 for the user as absent', async () => {
    const { port } = build(() => json({ msg: 'gone' }, 404));
    await expect(read(port)).resolves.toBe('absent');
  });

  it('[P2-S09-AC-913] issues one credentialed GET for the user factor list and nothing else', async () => {
    const { calls, port } = build(() => json([]));
    await read(port);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://staging.example.supabase.co/auth/v1/admin/users/${IDS.authUser}/factors`,
    );
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers).toMatchObject({
      accept: 'application/json',
      apikey: 'sb_secret_0123456789abcdef',
    });
  });

  it.each([
    ['5xx', () => json({}, 503)],
    ['401', () => json({}, 401)],
    ['non-array 2xx', () => json({ factors: [] })],
    ['entry without id', () => json([{ status: 'verified' }])],
    [
      'unknown status value',
      () => json([{ id: IDS.providerFactor, status: 'weird' }]),
    ],
    ['invalid JSON', () => new Response('<html>', { status: 200 })],
    [
      'oversized body',
      () => new Response(`[${'0,'.repeat(70_000)}0]`, { status: 200 }),
    ],
  ])('treats %s as unavailable', async (_, reply) => {
    const { port } = build(reply);
    await expect(read(port)).resolves.toBe('unavailable');
  });

  it('treats a thrown transport error and an aborted read as unavailable', async () => {
    const thrown = build(() => {
      throw new Error('network');
    });
    await expect(read(thrown.port)).resolves.toBe('unavailable');
    const aborted = build(() => json([]));
    const controller = new AbortController();
    controller.abort();
    await expect(
      aborted.port.readStatus(
        { authUserId: IDS.authUser, providerFactorId: IDS.providerFactor },
        controller.signal,
      ),
    ).resolves.toBe('unavailable');
  });

  it('[P2-S09-AC-913] opens the shared circuit after five failures and refuses without calling the provider', async () => {
    const { fetchImpl, port } = build(() => json({}, 503));
    for (let index = 0; index < 5; index += 1)
      await expect(read(port)).resolves.toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    await expect(read(port)).resolves.toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('a 404 is a definite answer and does not count against the circuit', async () => {
    const { fetchImpl, port } = build(() => json({}, 404));
    for (let index = 0; index < 7; index += 1)
      await expect(read(port)).resolves.toBe('absent');
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it('[P2-S09-AC-913] gives up after the 5 second provider timeout and counts it against the circuit', async () => {
    vi.useFakeTimers();
    const { fetchImpl, port } = build(hangingUntilAborted);
    for (let index = 0; index < 5; index += 1) {
      const pending = read(port);
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(pending).resolves.toBe('unavailable');
    }
    await expect(read(port)).resolves.toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('abandons an in-flight read when the caller aborts, without counting it against the circuit', async () => {
    const { fetchImpl, port } = build(hangingUntilAborted);
    for (let index = 0; index < 7; index += 1) {
      const controller = new AbortController();
      const pending = port.readStatus(
        { authUserId: IDS.authUser, providerFactorId: IDS.providerFactor },
        controller.signal,
      );
      controller.abort();
      await expect(pending).resolves.toBe('unavailable');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });
});
