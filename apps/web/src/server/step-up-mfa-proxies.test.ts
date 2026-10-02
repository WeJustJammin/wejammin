import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FACTOR_ID,
  bindingStub,
  errorResponse,
  jsonResponse,
  type BindingStub,
} from './step-up-mfa-context.test-support';

const CHALLENGE_ID = '0195b6f0-0000-7000-8000-00000000000c';
const state: { binding: BindingStub } = { binding: bindingStub() };

vi.mock('cloudflare:workers', () => ({
  get env() {
    return { PLATFORM_API: state.binding };
  },
}));

type RouteModule = Readonly<Partial<Record<'DELETE' | 'GET' | 'POST', (context: never) => Promise<Response>>>> &
  Readonly<{ prerender?: boolean }>;

interface Contract {
  readonly name: string;
  readonly load: () => Promise<RouteModule>;
  readonly method: 'DELETE' | 'GET' | 'POST';
  readonly publicPath: string;
  readonly upstreamPath: string;
  readonly params: Readonly<Record<string, string>>;
}

const contracts: readonly Contract[] = [
  { name: 'AUTH-API-16', load: () => import('../pages/api/v1/account/mfa/factors/index'), method: 'GET', publicPath: '/api/v1/account/mfa/factors', upstreamPath: '/api/v1/account/mfa/factors', params: {} },
  { name: 'AUTH-API-17', load: () => import('../pages/api/v1/account/mfa/factors/index'), method: 'POST', publicPath: '/api/v1/account/mfa/factors', upstreamPath: '/api/v1/account/mfa/factors', params: {} },
  { name: 'AUTH-API-18', load: () => import('../pages/api/v1/account/mfa/factors/[factorId]/verify'), method: 'POST', publicPath: `/api/v1/account/mfa/factors/${FACTOR_ID}/verify`, upstreamPath: `/api/v1/account/mfa/factors/${FACTOR_ID}/verify`, params: { factorId: FACTOR_ID } },
  { name: 'AUTH-API-19', load: () => import('../pages/api/v1/account/mfa/factors/[factorId]'), method: 'DELETE', publicPath: `/api/v1/account/mfa/factors/${FACTOR_ID}`, upstreamPath: `/api/v1/account/mfa/factors/${FACTOR_ID}`, params: { factorId: FACTOR_ID } },
  { name: 'AUTH-API-20', load: () => import('../pages/api/v1/auth/step-up/challenges/index'), method: 'POST', publicPath: '/api/v1/auth/step-up/challenges', upstreamPath: '/api/v1/auth/step-up/challenges', params: {} },
  { name: 'AUTH-API-21', load: () => import('../pages/api/v1/auth/step-up/challenges/[challengeId]/verify'), method: 'POST', publicPath: `/api/v1/auth/step-up/challenges/${CHALLENGE_ID}/verify`, upstreamPath: `/api/v1/auth/step-up/challenges/${CHALLENGE_ID}/verify`, params: { challengeId: CHALLENGE_ID } },
];

const call = async (contract: Contract, init: RequestInit = {}) => {
  const module = await contract.load();
  const handler = module[contract.method];
  if (handler === undefined) throw new Error(`${contract.name} has no ${contract.method}`);
  const request = new Request(`https://app.example.test${contract.publicPath}`, {
    method: contract.method,
    ...init,
  });
  return handler({ request, params: contract.params } as never);
};

beforeEach(() => {
  state.binding = bindingStub(jsonResponse(200, { ok: true }));
});

/** FE01 same-origin first-party calls: the browser never holds a Supabase token. */
describe('step-up and MFA same-origin proxies', () => {
  it.each(contracts)('$name is a non-prerendered $method route to the private binding', async (contract) => {
    expect((await contract.load()).prerender).toBe(false);
    const response = await call(contract, { headers: { cookie: 'wj_access=a', 'x-csrf-token': 'csrf-token-0123456789' }, ...(contract.method === 'GET' ? {} : { body: '{}' }) });
    expect(response.status).toBe(200);
    const [upstream] = state.binding.requests();
    expect(upstream?.method).toBe(contract.method);
    expect(new URL(upstream?.url ?? '').pathname).toBe(contract.upstreamPath);
  });

  it.each(contracts.filter((contract) => contract.method !== 'GET'))('$name forwards only the allowlisted headers and the exact body', async (contract) => {
    await call(contract, {
      headers: {
        cookie: 'wj_access=a; wj_csrf=c',
        'x-csrf-token': 'csrf-token-0123456789',
        'if-match': '"4"',
        'idempotency-key': 'mfa-key-00000001',
        'content-type': 'application/json',
        origin: 'https://app.example.test',
        'x-forwarded-for': '203.0.113.9',
        authorization: 'Bearer should-not-cross',
        'x-evil': '1',
      },
      body: '{"code":"123456"}',
    });
    const [upstream] = state.binding.requests();
    expect(upstream?.headers.get('x-csrf-token')).toBe('csrf-token-0123456789');
    expect(upstream?.headers.get('if-match')).toBe('"4"');
    expect(upstream?.headers.get('idempotency-key')).toBe('mfa-key-00000001');
    expect(upstream?.headers.get('origin')).toBe('https://app.example.test');
    expect(upstream?.headers.get('authorization')).toBeNull();
    expect(upstream?.headers.get('x-evil')).toBeNull();
    expect(upstream?.headers.get('x-forwarded-for')).toBeNull();
    expect(await upstream?.text()).toBe('{"code":"123456"}');
  });

  it('relays no-store, the etag, a typed error and rotated cookies', async () => {
    const [contract] = contracts.filter((entry) => entry.name === 'AUTH-API-18');
    if (contract === undefined) throw new Error('missing contract');
    const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store', etag: '"6"' });
    headers.append('set-cookie', 'wj_access=new; Path=/; HttpOnly; Secure; SameSite=Lax');
    state.binding = bindingStub(new Response(JSON.stringify({ ok: true }), { status: 200, headers }));
    const response = await call(contract, { body: '{}' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"6"');
    expect(response.headers.get('set-cookie')).toContain('wj_access=new');
  });

  it('relays an upstream 401 step-up error unchanged', async () => {
    const [contract] = contracts.filter((entry) => entry.name === 'AUTH-API-19');
    if (contract === undefined) throw new Error('missing contract');
    state.binding = bindingStub(errorResponse(401, 'STEP_UP_REQUIRED', { recoveryAction: 'step_up', allowedMethods: ['totp'] }));
    const response = await call(contract, { body: '{"reason":"user_request"}' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('encodes a hostile path parameter instead of letting it climb the path', async () => {
    const [contract] = contracts.filter((entry) => entry.name === 'AUTH-API-19');
    if (contract === undefined) throw new Error('missing contract');
    await call({ ...contract, params: { factorId: '../admin' } }, { body: '{}' });
    const [upstream] = state.binding.requests();
    expect(new URL(upstream?.url ?? '').pathname).toBe('/api/v1/account/mfa/factors/..%2Fadmin');
  });

  it('answers a safe 503 when the binding is missing', async () => {
    state.binding = undefined as unknown as BindingStub;
    const [contract] = contracts;
    if (contract === undefined) throw new Error('missing contract');
    const response = await call(contract);
    expect(response.status).toBe(503);
  });
});
