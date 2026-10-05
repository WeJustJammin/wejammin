import { RequestContextSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticationDependencies } from '../../../apps/worker/src/authentication/types';
import type { WorkerDependencies } from '../../../apps/worker/src/index';
import {
  admitSession,
  parseBody,
  parseQuery,
  withDeadline,
} from '../../../apps/worker/src/platform-configuration/admin-route-admission';
import {
  contextFor,
  sessionFor,
} from '../../../apps/worker/src/platform-configuration/phase-02-slice-08-worker.test-support';
import {
  makeContext,
  request,
} from '../../../apps/worker/src/platform-configuration/phase-02-slice-07-route-runtime-coverage.test-support';

const adminRequest = (): Request =>
  request('/api/v1/admin/inbox', {
    method: 'GET',
    headers: { authorization: 'Bearer verified-session' },
  });

const authFor = () =>
  ({
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: sessionFor(0),
    })),
  }) as unknown as AuthenticationDependencies;

const dependenciesFor = (requestContext: unknown): WorkerDependencies =>
  ({
    auth: authFor(),
    resolveRequestContext: vi.fn(async () => requestContext),
  }) as unknown as WorkerDependencies;

const acceptObject = {
  safeParse: (input: unknown) => ({ success: true as const, data: input }),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Slice 08 admin route admission defensive coverage', () => {
  it('maps an admin handler rejection to retryable dependency unavailability', async () => {
    const { context } = makeContext(adminRequest());

    const response = await withDeadline(context, 'CFG-05B-01', async () => {
      throw new Error('admin workspace rejected');
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'admin_workspace', retryable: true },
      }),
    );
    expect(context.res).toBe(response);
  });

  it('does not clear an absent deadline timer after an immediate response', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockReturnValue(undefined as never);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { context } = makeContext(adminRequest());

    const response = await withDeadline(context, 'CFG-05B-01', async () =>
      Response.json({ ok: true }),
    );

    expect(response.status).toBe(200);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid server-owned request context at BE00 step 5, before any capability check', async () => {
    const { context } = makeContext(adminRequest());

    const result = await admitSession(
      context,
      dependenciesFor(null),
      new AbortController().signal,
    );

    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'UNAUTHENTICATED',
          details: { recoveryAction: 'reauthenticate' },
        }),
      );
    }
  });

  it.each([
    ['a non-integer limit', '?limit=not-a-number'],
    ['an empty task class entry', '?taskClasses=approval,,review'],
  ] as const)('rejects %s at the query boundary', async (_name, query) => {
    await expect(
      parseQuery(
        request(`/api/v1/admin/inbox${query}`, {
          method: 'GET',
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('fails closed when a query key disappears between enumeration and lookup', async () => {
    const searchParams = {
      keys: () => ['cursor'].values(),
      getAll: () => ['cursor'],
      get: () => null,
    };
    vi.stubGlobal(
      'URL',
      class {
        readonly searchParams = searchParams;
      },
    );

    await expect(parseQuery(adminRequest())).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it.each([
    [
      'oversized declared body',
      {
        'content-type': 'application/json',
        'content-length': '262145',
      },
      413,
      'PAYLOAD_TOO_LARGE',
    ],
    [
      'unsupported media type',
      { 'content-type': 'text/plain' },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
  ] as const)(
    'preserves the %s body-boundary status and code',
    async (_name, headers, status, code) => {
      await expect(
        parseBody(
          request('/api/v1/admin/grants', {
            method: 'POST',
            headers,
            body: '{}',
          }),
          acceptObject,
        ),
      ).resolves.toMatchObject({ ok: false, status, code });
    },
  );

  it('preserves a body-read deadline result', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      parseBody(
        request('/api/v1/admin/grants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
        acceptObject,
        controller.signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
    });
  });

  it('uses the fail-closed fallback context when no resolver is configured', async () => {
    const { context } = makeContext(adminRequest());
    const dependencies = {
      auth: authFor(),
    } as unknown as WorkerDependencies;

    const result = await admitSession(
      context,
      dependencies,
      new AbortController().signal,
    );

    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(403);
    }
  });

  it.each(['userId', 'actingPartyId'] as const)(
    'rejects a request context whose %s does not match the verified session',
    async (field) => {
      const { context } = makeContext(adminRequest());
      const mismatch = RequestContextSchema.parse({
        ...contextFor(),
        [field]: '99999999-9999-4999-8999-999999999999',
      });

      const result = await admitSession(
        context,
        dependenciesFor(mismatch),
        new AbortController().signal,
      );

      expect('response' in result).toBe(true);
      if ('response' in result) {
        expect(result.response.status).toBe(403);
        await expect(result.response.json()).resolves.toEqual(
          expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'The acting context is not allowed.',
          }),
        );
      }
    },
  );
});
