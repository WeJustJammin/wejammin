import { describe, expect, it, vi } from 'vitest';

import { quotedVersion } from './boundary';
import {
  bindings,
  MERGE_ID,
  ORIGIN,
  session,
} from './phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
  operations,
  requestFor,
  success,
} from './phase-02-slice-02.test-support';

const operation = (id: string) => {
  const found = operations.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Unknown operation ${id}`);
  return found;
};

const withHeaderRemoved = (id: string, header: string): Request => {
  const original = requestFor(operation(id));
  const headers = new Headers(original.headers);
  headers.delete(header);
  return new Request(original, { headers });
};

const invalidResult = <T>(): T => ({}) as T;

describe('Phase 2 Slice 02 route branch coverage', () => {
  it('covers quoted and already-quoted ETag versions', () => {
    expect(quotedVersion('7')).toBe('"7"');
    expect(quotedVersion('"7"')).toBe('"7"');
  });

  it.each([
    ['AUTH-API-09', 'readLoginMethods'],
    ['AUTH-API-10', 'startLoginMethodLink'],
    ['AUTH-API-11', 'unlinkLoginMethod'],
    ['AUTH-API-12', 'createAccountMerge'],
    ['AUTH-API-13', 'readAccountMerge'],
    ['AUTH-API-14', 'startAccountMergeProof'],
    ['AUTH-API-15', 'confirmAccountMerge'],
  ] as const)(
    '%s fails closed when its Slice 02 dependency is absent',
    async (id, dependency) => {
      const { app, auth } = createApp();
      Object.assign(auth, { [dependency]: undefined });

      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    },
  );

  it.each([
    ['AUTH-API-09', 'readLoginMethods'],
    ['AUTH-API-11', 'unlinkLoginMethod'],
    ['AUTH-API-12', 'createAccountMerge'],
    ['AUTH-API-13', 'readAccountMerge'],
    ['AUTH-API-15', 'confirmAccountMerge'],
  ] as const)(
    '%s rejects an invalid persistence projection',
    async (id, dependency) => {
      const { app, slice } = createApp();
      const mock = slice[dependency] as ReturnType<typeof vi.fn>;
      mock.mockResolvedValueOnce(success(invalidResult()));

      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
    },
  );

  it.each([
    ['AUTH-API-10', 'startLoginMethodLink'],
    ['AUTH-API-14', 'startAccountMergeProof'],
  ] as const)(
    '%s rejects an invalid authorization-start projection',
    async (id, dependency) => {
      const { app, slice } = createApp();
      const mock = slice[dependency] as ReturnType<typeof vi.fn>;
      mock.mockResolvedValueOnce(
        success({ resource: invalidResult(), cookies: [] }),
      );

      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
    },
  );

  it.each([
    ['AUTH-API-10', 'startLoginMethodLink'],
    ['AUTH-API-11', 'unlinkLoginMethod'],
    ['AUTH-API-12', 'createAccountMerge'],
    ['AUTH-API-14', 'startAccountMergeProof'],
    ['AUTH-API-15', 'confirmAccountMerge'],
  ] as const)(
    '%s preserves typed domain failures from its dependency',
    async (id, dependency) => {
      const { app, slice } = createApp();
      const mock = slice[dependency] as ReturnType<typeof vi.fn>;
      mock.mockResolvedValueOnce(
        failure(
          409,
          'VERSION_MISMATCH',
          'The resource changed; reload and try again.',
        ),
      );

      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: 'VERSION_MISMATCH',
      });
    },
  );

  it.each([
    'AUTH-API-10',
    'AUTH-API-11',
    'AUTH-API-12',
    'AUTH-API-14',
    'AUTH-API-15',
  ] as const)(
    '%s requires a valid idempotency key before invoking persistence',
    async (id) => {
      const { app, slice } = createApp();
      const response = await app.request(
        withHeaderRemoved(id, 'idempotency-key'),
        undefined,
        bindings,
      );

      expect(response.status).toBe(400);
      expect(
        Object.values(slice).every((mock) => !mock.mock.calls.length),
      ).toBe(true);
    },
  );

  it.each([
    'AUTH-API-10',
    'AUTH-API-11',
    'AUTH-API-12',
    'AUTH-API-14',
    'AUTH-API-15',
  ] as const)(
    '%s requires a strong If-Match version before invoking persistence',
    async (id) => {
      const { app, slice } = createApp();
      const response = await app.request(
        withHeaderRemoved(id, 'if-match'),
        undefined,
        bindings,
      );

      expect(response.status).toBe(400);
      expect(
        Object.values(slice).every((mock) => !mock.mock.calls.length),
      ).toBe(true);
    },
  );

  it.each([
    'AUTH-API-10',
    'AUTH-API-11',
    'AUTH-API-12',
    'AUTH-API-14',
    'AUTH-API-15',
  ] as const)('%s rejects a cross-origin or missing CSRF proof', async (id) => {
    const { app, slice } = createApp();
    const request = withHeaderRemoved(id, 'x-csrf-token');
    const response = await app.request(request, undefined, bindings);

    expect(response.status).toBe(403);
    expect(Object.values(slice).every((mock) => !mock.mock.calls.length)).toBe(
      true,
    );
  });

  it.each([
    'AUTH-API-10',
    'AUTH-API-11',
    'AUTH-API-12',
    'AUTH-API-14',
    'AUTH-API-15',
  ] as const)(
    '%s rejects a stale step-up before the mutation dependency',
    async (id) => {
      const { app, slice } = createApp({
        resolveSession: vi.fn(async () =>
          success({ ...session, stepUpAt: '2020-01-01T00:00:00Z' }),
        ),
      });
      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      });
      expect(
        Object.values(slice).every((mock) => !mock.mock.calls.length),
      ).toBe(true);
    },
  );

  it.each([
    ['AUTH-API-09', 'readLoginMethods'],
    ['AUTH-API-10', 'startLoginMethodLink'],
    ['AUTH-API-11', 'unlinkLoginMethod'],
    ['AUTH-API-12', 'createAccountMerge'],
    ['AUTH-API-13', 'readAccountMerge'],
    ['AUTH-API-14', 'startAccountMergeProof'],
    ['AUTH-API-15', 'confirmAccountMerge'],
  ] as const)(
    '%s emits complete rate-limit headers and stops on 429',
    async (id, dependency) => {
      const { app, slice } = createApp({
        rateLimit: vi.fn(async (input) =>
          success({
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: Math.floor(Date.now() / 1000) + 30,
          }),
        ),
      });
      const response = await app.request(
        requestFor(operation(id)),
        undefined,
        bindings,
      );

      expect(response.status).toBe(429);
      expect(response.headers.get('ratelimit-limit')).not.toBeNull();
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('ratelimit-reset')).not.toBeNull();
      expect(response.headers.get('retry-after')).not.toBeNull();
      expect(slice[dependency]).not.toHaveBeenCalled();
    },
  );

  it('AUTH-API-09 rejects pagination and unexpected query input', async () => {
    const { app, slice } = createApp();
    const response = await app.request(
      new Request(`${ORIGIN}${operation('AUTH-API-09').path}?cursor=next`, {
        headers: { accept: 'application/json' },
      }),
      undefined,
      bindings,
    );

    expect(response.status).toBe(400);
    expect(slice.readLoginMethods).not.toHaveBeenCalled();
  });

  it('AUTH-API-13 rejects pagination and unexpected query input', async () => {
    const { app, slice } = createApp();
    const response = await app.request(
      new Request(`${ORIGIN}${operation('AUTH-API-13').path}?cursor=next`, {
        headers: { accept: 'application/json' },
      }),
      undefined,
      bindings,
    );

    expect(response.status).toBe(400);
    expect(slice.readAccountMerge).not.toHaveBeenCalled();
  });

  it('AUTH-API-10 rejects unsupported providers before an intent is created', async () => {
    const { app, slice } = createApp();
    const response = await app.request(
      new Request(
        `${ORIGIN}/api/v1/account/login-methods/bandlab/link-intents`,
        requestFor(operation('AUTH-API-10')),
      ),
      undefined,
      bindings,
    );

    expect(response.status).toBe(422);
    expect(slice.startLoginMethodLink).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/v1/account/login-methods/not-a-uuid', 'AUTH-API-11'],
    ['/api/v1/account-merges/not-a-uuid', 'AUTH-API-13'],
    ['/api/v1/account-merges/not-a-uuid/prove-duplicate', 'AUTH-API-14'],
    ['/api/v1/account-merges/not-a-uuid/confirm', 'AUTH-API-15'],
  ] as const)(
    '%s rejects malformed path identifiers for %s',
    async (path, id) => {
      const { app } = createApp();
      const selected = operation(id);
      const source = requestFor(selected);
      const request = new Request(`https://api.example.test${path}`, {
        method: source.method,
        headers: source.headers,
        ...(source.method === 'DELETE' || source.method === 'POST'
          ? {
              body:
                selected.body === undefined
                  ? '{}'
                  : JSON.stringify(selected.body),
            }
          : {}),
      });
      const response = await app.request(request, undefined, bindings);
      expect(response.status).toBe(400);
    },
  );

  it('AUTH-API-11 keeps the updated list private and quotes an unquoted version', async () => {
    const { app, slice } = createApp();
    slice.unlinkLoginMethod.mockResolvedValueOnce(
      success({
        methods: [],
        recoveryBaselinePresent: true,
        version: '8',
      }),
    );
    const response = await app.request(
      requestFor(operation('AUTH-API-11')),
      undefined,
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"8"');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('AUTH-API-15 returns a queued job and its canonical Location', async () => {
    const { app, slice } = createApp();
    const response = await app.request(
      requestFor(operation('AUTH-API-15')),
      undefined,
      bindings,
    );

    expect(response.status).toBe(202);
    expect(response.headers.get('location')).toBe(
      '/api/v1/jobs/77777777-7777-4777-8777-777777777777',
    );
    const calls = slice.confirmAccountMerge.mock.calls as unknown as Array<
      [Record<string, unknown>, unknown, AbortSignal]
    >;
    const [input, , signal] = calls[0] ?? [];
    expect(input).toMatchObject({
      mergeId: MERGE_ID,
      acknowledgements: ['profiles.safe_repoint', 'aliases.reviewed'],
    });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
