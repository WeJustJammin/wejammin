import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsCapabilityGrantIdFromRequest } from './cms-capability-grant-platform-api';
import { contentSchemaRegistryMutationOperationFromRequest } from './content-schema-registry-platform-mutation';
import {
  bindingStub,
  jsonResponse,
  type BindingStub,
} from './step-up-mfa-context.test-support';

/**
 * Codex R14c2 #3 (BE00 step 2): a first-party web route must not consume a
 * cookie-bearing request body before the Worker's same-origin and session-bound
 * CSRF checks have run. Every non-GET route under pages/api and pages/auth is
 * driven through its real handler with a body that counts how often it is
 * pulled; a refusal must leave the body unread.
 */
const state: { binding: BindingStub } = { binding: bindingStub() };

vi.mock('cloudflare:workers', () => ({
  get env() {
    return {
      PLATFORM_API: state.binding,
      PLATFORM_CONFIGURATION_API: state.binding,
    };
  },
}));

const ROUTES = import.meta.glob<Record<string, unknown>>(
  ['../pages/api/v1/**/*.ts', '../pages/auth/start.ts'],
  { eager: false },
);
const PAGES_ROOT = resolve(import.meta.dirname, '..');
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ID = '0195b6f0-0000-7000-8000-000000000001';
const params = new Proxy({} as Record<string, string>, { get: () => ID });

const routeFiles = Object.keys(ROUTES).filter(
  (file) => !/\.test\.ts$/u.test(file),
);

/** Native form posts carry the CSRF token in the body, so the web must read it after the same-origin gate. */
const BODY_CARRIED_CSRF = [
  'content-schema-registry-platform-api',
  'cms-capability-grant-platform-api',
];

const spyBody = () => {
  const pulls = { count: 0 };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        pulls.count += 1;
        controller.enqueue(new TextEncoder().encode('{"probe":true}'));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulls };
};

const refusingBinding = () =>
  bindingStub(
    jsonResponse(403, {
      code: 'FORBIDDEN',
      message: 'The CSRF token is invalid.',
      details: {},
      requestId: ID,
    }),
  );

const invoke = async (
  file: string,
  method: (typeof WRITE_METHODS)[number],
  origin: string,
) => {
  const module = await ROUTES[file]!();
  const handler = module[method] as
    ((context: never) => Response | Promise<Response>) | undefined;
  if (handler === undefined) return null;
  const body = spyBody();
  const request = new Request('https://app.example.test/probe', {
    method,
    headers: {
      cookie: 'wj_session_ref=session-reference; wj_csrf=forged.token',
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'idempotency-key-0001',
    },
    body: body.stream,
    duplex: 'half',
  } as RequestInit);
  try {
    await handler({ request, params } as never);
  } catch {
    // A refusal that throws still must not have read the body.
  }
  return { pulls: body.pulls.count, bodyUsed: request.bodyUsed };
};

beforeEach(() => {
  state.binding = refusingBinding();
});

describe('web first-party routes never read a refused request body (BE00 step 2)', () => {
  it('discovers every non-GET first-party route', () => {
    expect(routeFiles.length).toBeGreaterThan(60);
  });

  it.each(routeFiles)(
    '%s leaves the body unread for a foreign-origin cookie request',
    async (file) => {
      for (const method of WRITE_METHODS) {
        const outcome = await invoke(file, method, 'https://evil.example.test');
        if (outcome === null) continue;
        expect(outcome.pulls, `${file} ${method}`).toBe(0);
        expect(outcome.bodyUsed, `${file} ${method}`).toBe(false);
      }
    },
  );

  it.each(routeFiles)(
    '%s leaves the body unread for a same-origin cookie request that fails CSRF',
    async (file) => {
      const source = readFileSync(
        resolve(PAGES_ROOT, file.replace('../', '')),
        'utf8',
      );
      if (BODY_CARRIED_CSRF.some((name) => source.includes(name))) return;
      if (file.endsWith('pages/auth/start.ts')) return;
      for (const method of WRITE_METHODS) {
        const outcome = await invoke(file, method, 'https://app.example.test');
        if (outcome === null) continue;
        expect(outcome.pulls, `${file} ${method}`).toBe(0);
        expect(outcome.bodyUsed, `${file} ${method}`).toBe(false);
      }
    },
  );

  it('still forwards the exact body bytes to the Worker when nothing refuses first', async () => {
    state.binding = bindingStub(jsonResponse(200, { ok: true }));
    const module = await ROUTES['../pages/api/v1/auth/logout.ts']!();
    const request = new Request('https://app.example.test/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'wj_session_ref=s',
        origin: 'https://app.example.test',
        'content-type': 'application/json',
      },
      body: '{"scope":"current"}',
    });
    await (module.POST as (context: never) => Promise<Response>)({
      request,
    } as never);
    const [upstream] = state.binding.requests();
    expect(await upstream?.text()).toBe('{"scope":"current"}');
  });

  it('answers the form-post operation probes without reading a foreign-origin body', async () => {
    const operation = spyBody();
    const operationRequest = new Request('https://app.example.test/probe', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.test',
        'content-type': 'application/json',
      },
      body: operation.stream,
      duplex: 'half',
    } as RequestInit);
    expect(
      await contentSchemaRegistryMutationOperationFromRequest(operationRequest),
    ).toBeNull();
    expect(operation.pulls.count).toBe(0);

    const grant = spyBody();
    const grantRequest = new Request('https://app.example.test/probe', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.test',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: grant.stream,
      duplex: 'half',
    } as RequestInit);
    expect(await cmsCapabilityGrantIdFromRequest(grantRequest)).toBeUndefined();
    expect(grant.pulls.count).toBe(0);
  });

  it('refuses an oversize declared public sign-in form before parsing it', async () => {
    const module = await ROUTES['../pages/auth/start.ts']!();
    const body = spyBody();
    const request = new Request('https://app.example.test/auth/start', {
      method: 'POST',
      headers: {
        origin: 'https://app.example.test',
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': '1048576',
      },
      body: body.stream,
      duplex: 'half',
    } as RequestInit);
    const response = await (
      module.POST as (context: never) => Promise<Response>
    )({ request } as never);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('outcome=invalid');
    expect(body.pulls.count).toBe(0);
  });
});
