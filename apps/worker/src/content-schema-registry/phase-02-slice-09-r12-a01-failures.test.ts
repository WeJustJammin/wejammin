import { describe, expect, it, vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import { validDraft } from './phase-02-slice-09-test-values';
import {
  REQUEST_ID,
  json,
  options,
  requestContext,
} from './production-test-support';

/**
 * AC193 Worker half: every CMS-03A-01 failure class reaches the wire as its
 * declared error through the production adapter, none is ever a 2xx, and a
 * refusal made before the RPC never reaches the RPC. The 429 is produced by
 * exhausting a counting limiter (not by a stub answering allowed:false) and the
 * 503/504 by real dependency faults (HTTP 503, a refused connection, a hung
 * RPC against the deadline). What the database commits or rolls back on each
 * failure is the pgTAP half.
 */
const ORIGIN = 'https://cms.example.test';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const DESIGNER = ['cms.schema_designer', 'cms.schema_registry.read'];

type Overrides = Readonly<{
  capabilities?: readonly string[];
  fetchImpl?: typeof fetch;
  rateLimit?: (...args: never[]) => unknown;
  deadlineMs?: number;
  auth?: unknown;
}>;

const build = (overrides: Overrides = {}) => {
  const fetchImpl =
    overrides.fetchImpl ??
    vi.fn<typeof fetch>(async () =>
      json({ code: 'P0001', message: 'VALIDATION_FAILED', details: null }, 400),
    );
  const dependencies = createProductionContentSchemaRegistryDependencies(
    options(fetchImpl, {
      humanOrigins: [ORIGIN],
      now: () => NOW,
      resolveRequestContext: vi.fn(async () => ({
        ...requestContext,
        capabilities: overrides.capabilities ?? DESIGNER,
      })),
      ...(overrides.rateLimit === undefined
        ? {}
        : { rateLimit: overrides.rateLimit }),
      ...(overrides.deadlineMs === undefined
        ? {}
        : { deadlineMs: overrides.deadlineMs }),
      ...(overrides.auth === undefined ? {} : { auth: overrides.auth }),
    }),
  );
  return { fetchImpl, app: createContentSchemaRegistryApp(dependencies) };
};

const create = (
  body: unknown = validDraft,
  headers: Record<string, string | null> = {},
) => {
  const merged: Record<string, string> = {
    'content-type': 'application/json',
    origin: ORIGIN,
    'idempotency-key': 'cms-a01-failure-key-01',
    'x-request-id': REQUEST_ID,
  };
  for (const [name, value] of Object.entries(headers))
    if (value === null) delete merged[name];
    else merged[name] = value;
  return new Request('https://api.example.test/api/v1/cms/content-types', {
    method: 'POST',
    headers: merged,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
};

const raisedBy = (message: string, details: unknown = null, status = 400) =>
  vi.fn<typeof fetch>(async () =>
    json({ code: 'P0001', message, details, hint: null }, status),
  );

const expectRefused = async (
  response: Response,
  status: number,
  code: string,
) => {
  expect(response.status).toBe(status);
  expect(response.status).toBeGreaterThanOrEqual(400);
  const body = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body.code).toBe(code);
  expect(body.requestId).toBe(REQUEST_ID);
  return body;
};

describe('[P2-S09-AC-193] A01 failures that never reach the RPC', () => {
  it.each([
    ['400 malformed JSON', () => create('{not json'), 400, 'INVALID_REQUEST'],
    [
      '400 missing Idempotency-Key',
      () => create(validDraft, { 'idempotency-key': null }),
      400,
      'INVALID_REQUEST',
    ],
    [
      '400 short Idempotency-Key',
      () => create(validDraft, { 'idempotency-key': 'short' }),
      400,
      'INVALID_REQUEST',
    ],
    [
      '415 unsupported media type',
      () => create(validDraft, { 'content-type': 'text/plain' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
    [
      '422 unknown member',
      () => create({ ...validDraft, ownerId: 'x' }),
      422,
      'VALIDATION_FAILED',
    ],
    [
      '422 a client-supplied artifact',
      () => create({ ...validDraft, artifact: {} }),
      422,
      'VALIDATION_FAILED',
    ],
  ] as const)('%s', async (_label, request, status, code) => {
    const { app, fetchImpl } = build();
    await expectRefused(await app.request(request()), status, code);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('403 missing capability: refused before the RPC with only the reason code', async () => {
    const { app, fetchImpl } = build({ capabilities: [] });
    const body = await expectRefused(
      await app.request(create()),
      403,
      'FORBIDDEN',
    );
    expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('401 no session: refused with the allowlisted recovery action before the RPC', async () => {
    const { app, fetchImpl } = build({
      auth: {
        resolveSession: vi.fn(async () => ({
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'The authentication session is invalid.',
          details: {},
        })),
      },
    });
    const body = await expectRefused(
      await app.request(create()),
      401,
      'UNAUTHENTICATED',
    );
    expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('[P2-S09-AC-193] A01 failures raised by the RPC reach the wire as the declared error', () => {
  it.each([
    ['VALIDATION_FAILED', 422, 'VALIDATION_FAILED'],
    ['CONFLICT', 409, 'CONFLICT'],
    ['IDEMPOTENCY_MISMATCH', 409, 'CONFLICT'],
    ['NOT_FOUND', 404, 'NOT_FOUND'],
    ['FORBIDDEN', 403, 'FORBIDDEN'],
  ] as const)(
    'an RPC %s is %s %s with one RPC call and no success body',
    async (raised, status, code) => {
      const fetchImpl = raisedBy(raised);
      const { app } = build({ fetchImpl });
      const body = await expectRefused(
        await app.request(create()),
        status,
        code,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(body).not.toHaveProperty('resourceKind');
      expect(body).not.toHaveProperty('id');
    },
  );

  it('a type-key collision is the 409 CONFLICT with the allowlisted conflict kind only', async () => {
    const { app } = build({ fetchImpl: raisedBy('CONFLICT') });
    const body = await expectRefused(
      await app.request(create()),
      409,
      'CONFLICT',
    );
    expect(Object.keys(body.details as object).sort()).toEqual(
      ['conflict', 'recoveryAction'].sort(),
    );
  });

  it('an idempotency mismatch is the 409 with use_new_idempotency_key', async () => {
    const { app } = build({ fetchImpl: raisedBy('IDEMPOTENCY_MISMATCH') });
    const body = await expectRefused(
      await app.request(create()),
      409,
      'CONFLICT',
    );
    expect(body.details).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
  });

  it('[OD-4] a locale refusal carries only its path-keyed violations as 422', async () => {
    const { app } = build({
      fetchImpl: raisedBy(
        'VALIDATION_FAILED',
        JSON.stringify({
          violations: [
            {
              pointer: '/sourceLocale',
              message: 'locale tag must be a canonical-case BCP 47 tag',
            },
          ],
        }),
      ),
    });
    const body = await expectRefused(
      await app.request(create()),
      422,
      'VALIDATION_FAILED',
    );
    expect(body.details).toEqual({
      violations: [
        {
          path: '/sourceLocale',
          message: 'locale tag must be a canonical-case BCP 47 tag',
        },
      ],
    });
  });

  it('[DEC-109] an unregistered workflow policy refusal is a plain 422 with no registry detail', async () => {
    const { app } = build({
      fetchImpl: raisedBy(
        'VALIDATION_FAILED',
        'workflow policy not registered',
      ),
    });
    const body = await expectRefused(
      await app.request(
        create({ ...validDraft, workflowKey: 'nonexistent.policy' }),
      ),
      422,
      'VALIDATION_FAILED',
    );
    expect(JSON.stringify(body)).not.toMatch(/workflow policy|registered/iu);
  });
});

describe('[P2-S09-AC-193] A01 rate limit and dependency failures are produced, not stubbed', () => {
  it('429: the 31st create in a minute is refused by an exhausted counting limiter and never reaches the RPC', async () => {
    const used = new Map<string, number>();
    const rateLimit = vi.fn(
      async (input: {
        actorId: string | null;
        limit: number;
        windowSeconds: number;
      }) => {
        const key = String(input.actorId);
        const count = (used.get(key) ?? 0) + 1;
        used.set(key, count);
        return {
          ok: true as const,
          value: {
            allowed: count <= input.limit,
            limit: input.limit,
            remaining: Math.max(0, input.limit - count),
            resetAt: Math.floor(NOW / 1000) + input.windowSeconds,
          },
        };
      },
    );
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ ok: true }));
    const { app } = build({ fetchImpl, rateLimit: rateLimit as never });
    let last: Response | null = null;
    for (let index = 0; index < 31; index += 1)
      last = await app.request(create());
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(30);
    const body = await expectRefused(last as Response, 429, 'RATE_LIMITED');
    expect(Object.keys(body.details as object).sort()).toEqual(
      ['limit', 'resetAt', 'retryAfterSeconds'].sort(),
    );
    expect((last as Response).headers.get('retry-after')).not.toBeNull();
  });

  it.each([
    [
      'an HTTP 503 from the RPC',
      () => vi.fn<typeof fetch>(async () => json({}, 503)),
    ],
    [
      'a refused connection',
      () =>
        vi.fn<typeof fetch>(async () =>
          Promise.reject(new TypeError('fetch failed')),
        ),
    ],
  ] as const)(
    '503: %s is DEPENDENCY_UNAVAILABLE and never a success',
    async (_label, make) => {
      const { app } = build({ fetchImpl: make() });
      const body = await expectRefused(
        await app.request(create()),
        503,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(body.details).toMatchObject({
        dependencyClass: 'cms_registry',
        retryable: true,
      });
    },
  );

  it('504: an RPC that hangs past the deadline is DEPENDENCY_UNAVAILABLE 504 and is not retried as a success', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { app } = build({ fetchImpl, deadlineMs: 25 });
    const body = await expectRefused(
      await app.request(create()),
      504,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(body.details).toMatchObject({ retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
