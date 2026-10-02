import type { CompositionInstanceResource } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createCmsPatternInstanceApp,
  type CmsPatternInstanceDependencies,
} from './pattern-instance-routes';

const origin = 'https://cms.example.test';
const path = '/api/v1/cms/compositions/pattern-instances';
const revisionId = 'd5000000-0000-4000-8000-000000000011';
const patternId = 'd5000000-0000-4000-8000-000000000012';
const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
} as const;
const resource: CompositionInstanceResource = {
  id: 'd5000000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary',
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
const session = {
  userId: 'd5000000-0000-4000-8000-000000000014',
  actingPartyId: 'd5000000-0000-4000-8000-000000000015',
  capabilities: ['cms.author'],
  mfaFresh: true,
};
const request = (
  options: { method?: string; headers?: Record<string, string> } = {},
) =>
  new Request(`https://api.example.test${path}`, {
    method: options.method ?? 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'pattern-command-0001',
      'if-match': '"1"',
      ...options.headers,
    },
    ...(options.method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }),
  });
const deps = (
  overrides: Partial<CmsPatternInstanceDependencies> = {},
): CmsPatternInstanceDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({ ok: true, value: session }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2,
    },
  }),
  insertPattern: async () => ({ ok: true, value: resource }),
  telemetry: () => undefined,
  ...overrides,
});
const statusFor = async (dependencies: CmsPatternInstanceDependencies) =>
  (await createCmsPatternInstanceApp(dependencies).request(request())).status;

describe('CMS-03C-02 Worker failure and availability boundaries', () => {
  it('admits only a configured-origin preflight and valid CSRF pairing', async () => {
    const app = createCmsPatternInstanceApp(deps());
    const accepted = await app.request(request({ method: 'OPTIONS' }));
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    for (const headers of [{ origin: 'https://evil.test' }, { origin: '' }])
      expect(
        (await app.request(request({ method: 'OPTIONS', headers }))).status,
      ).toBe(403);
    expect(
      (
        await app.request(
          request({
            headers: {
              cookie: 'wj_session_ref=protected; wj_csrf=csrf123',
              'x-csrf-token': 'wrong',
            },
          }),
        )
      ).status,
    ).toBe(403);
    for (const header of ['idempotency-key', 'if-match']) {
      const missing = request();
      missing.headers.delete(header);
      expect((await app.request(missing)).status).toBe(400);
    }
  });

  it('fails closed on session absence, malformed envelope, or missing capability', async () => {
    for (const [resolveSession, expected] of [
      [
        async () => {
          throw new Error('private');
        },
        503,
      ],
      [async () => null, 502],
      [
        async () => ({
          ok: false,
          status: 401,
          code: 'PRIVATE',
          message: 'private',
        }),
        401,
      ],
      [async () => ({ ok: true, value: { ...session, userId: 'bad' } }), 401],
      [
        async () => ({ ok: true, value: { ...session, capabilities: [] } }),
        403,
      ],
      [
        async () => ({ ok: true, value: { ...session, actingPartyId: null } }),
        403,
      ],
    ] as const) {
      const result = await statusFor(
        deps({
          resolveSession:
            resolveSession as CmsPatternInstanceDependencies['resolveSession'],
        }),
      );
      expect(result).toBe(expected);
    }
  });

  it('does not reach the mutation when either rate scope rejects or malfunctions', async () => {
    const insertPattern = vi.fn(deps().insertPattern);
    for (const [rateLimit, expected] of [
      [
        async () => {
          throw new Error('private');
        },
        503,
      ],
      [async () => null, 502],
      [
        async () => ({
          ok: false,
          status: 503,
          code: 'PRIVATE',
          message: 'private',
        }),
        503,
      ],
      [
        async () => ({
          ok: true,
          value: { allowed: true, limit: 999, remaining: 1, resetAt: 2 },
        }),
        502,
      ],
      [
        async (input: { limit: number }) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        }),
        429,
      ],
    ] as const) {
      const result = await statusFor(
        deps({
          insertPattern,
          rateLimit: rateLimit as CmsPatternInstanceDependencies['rateLimit'],
        }),
      );
      expect(result).toBe(expected);
    }
    const secondScope = vi.fn(
      async (input: { rateScope: string; limit: number }) =>
        input.rateScope === 'party'
          ? { ok: false, status: 429, code: 'PRIVATE', message: 'private' }
          : {
              ok: true,
              value: {
                allowed: true,
                limit: input.limit,
                remaining: 1,
                resetAt: 2,
              },
            },
    );
    expect(
      await statusFor(
        deps({
          insertPattern,
          rateLimit: secondScope as CmsPatternInstanceDependencies['rateLimit'],
        }),
      ),
    ).toBe(429);
    expect(secondScope).toHaveBeenCalledTimes(2);
    expect(insertPattern).not.toHaveBeenCalled();
  });

  it('bounds, redacts, and validates private mutation responses', async () => {
    for (const [insertPattern, expected] of [
      [
        async () => {
          throw new Error('private');
        },
        503,
      ],
      [async () => null, 502],
      [
        async () => ({
          ok: false,
          status: 409,
          code: 'PRIVATE',
          message: 'private',
        }),
        409,
      ],
      [
        async () => ({
          ok: true,
          value: { ...resource, patternId: revisionId },
        }),
        502,
      ],
    ] as const) {
      const result = await statusFor(
        deps({
          insertPattern:
            insertPattern as CmsPatternInstanceDependencies['insertPattern'],
        }),
      );
      expect(result).toBe(expected);
    }
  });

  it('isolates asynchronous and synchronous telemetry failures from the result', async () => {
    for (const telemetry of [
      async () => {
        throw new Error('private');
      },
      () => {
        throw new Error('private');
      },
    ])
      expect(await statusFor(deps({ telemetry }))).toBe(201);
    expect(
      await statusFor(
        deps({
          resolveSession: async () => ({
            ok: true,
            value: { ...session, capabilities: ['cms.editor'] },
          }),
        }),
      ),
    ).toBe(201);
  });

  it('returns a deadline when the private mutation does not settle', async () => {
    vi.useFakeTimers();
    try {
      const response = statusFor(
        deps({ insertPattern: async () => new Promise(() => undefined) }),
      );
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await response).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops between rate scopes after a deadline abort', async () => {
    vi.useFakeTimers();
    try {
      const rateLimit = vi.fn(async (input: { limit: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 16_000));
        return {
          ok: true as const,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: 1,
            resetAt: 20,
          },
        };
      });
      const response = statusFor(
        deps({
          rateLimit: rateLimit as CmsPatternInstanceDependencies['rateLimit'],
        }),
      );
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await response).toBe(504);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(rateLimit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrubs an unexpected admission exception as a 500 response', async () => {
    let calls = 0;
    const humanOrigins = {
      includes: (candidate: string) => {
        if (++calls === 1) throw new Error('private admission state');
        return candidate === origin;
      },
    } as unknown as readonly string[];
    const response = await createCmsPatternInstanceApp(
      deps({ humanOrigins }),
    ).request(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      'private admission state',
    );
  });
});
