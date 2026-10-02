import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bindingStub,
  errorResponse,
  jsonResponse,
  type BindingStub,
} from './step-up-mfa-context.test-support';

const state: { binding: BindingStub } = { binding: bindingStub() };

vi.mock('cloudflare:workers', () => ({
  get env() {
    return { PLATFORM_API: state.binding };
  },
}));

const PATH = '/api/v1/admin/identity/mfa-factor-resets';
const route = () => import('../pages/api/v1/admin/identity/mfa-factor-resets');
const post = async (init: RequestInit = {}) => {
  const { POST } = await route();
  return POST({
    request: new Request(`https://app.example.test${PATH}`, {
      method: 'POST',
      ...init,
    }),
  } as never);
};

beforeEach(() => {
  state.binding = bindingStub(jsonResponse(200, { ok: true }));
});

/** CFG-05B-06 same-origin first-party proxy for the FE05 reset form. */
describe('CFG-05B-06 admin MFA reset proxy', () => {
  it('is a non-prerendered POST-only route to the private binding', async () => {
    const module = await route();
    expect(module.prerender).toBe(false);
    expect(
      Object.keys(module).filter((name) => /^[A-Z]+$/u.test(name)),
    ).toEqual(['POST']);
    await post({ body: '{}' });
    const [upstream] = state.binding.requests();
    expect(upstream?.method).toBe('POST');
    expect(new URL(upstream?.url ?? '').pathname).toBe(PATH);
  });

  it('forwards only allowlisted headers and the exact body', async () => {
    await post({
      headers: {
        cookie: 'wj_access=a; wj_csrf=c',
        'x-csrf-token': 'csrf-token-0123456789',
        'idempotency-key': 'reset-key-0001',
        'content-type': 'application/json',
        origin: 'https://app.example.test',
        authorization: 'Bearer nope',
        'x-forwarded-for': '203.0.113.9',
      },
      body: '{"targetPersonId":"x","reason":"y"}',
    });
    const [upstream] = state.binding.requests();
    expect(upstream?.headers.get('idempotency-key')).toBe('reset-key-0001');
    expect(upstream?.headers.get('x-csrf-token')).toBe('csrf-token-0123456789');
    expect(upstream?.headers.get('authorization')).toBeNull();
    expect(upstream?.headers.get('x-forwarded-for')).toBeNull();
    expect(await upstream?.text()).toBe('{"targetPersonId":"x","reason":"y"}');
  });

  it('relays 202 reconciling and a typed 401 step-up error unchanged', async () => {
    state.binding = bindingStub(jsonResponse(202, { state: 'reconciling' }));
    expect((await post({ body: '{}' })).status).toBe(202);
    state.binding = bindingStub(
      errorResponse(401, 'STEP_UP_REQUIRED', { allowedMethods: ['totp'] }),
    );
    const response = await post({ body: '{}' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('answers a safe 503 when the binding is missing', async () => {
    state.binding = undefined as unknown as BindingStub;
    expect((await post({ body: '{}' })).status).toBe(503);
  });
});
