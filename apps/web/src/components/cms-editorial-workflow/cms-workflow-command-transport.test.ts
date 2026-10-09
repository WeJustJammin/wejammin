// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  COMMAND_CASES,
  CSRF,
  KEY,
  REVOKE_CASE,
  upstreamSuccess,
  type CommandCase,
} from '../../server/cms-workflow-platform-command.test-support';
import {
  REQUEST_ID,
  apiError,
  jsonResponse,
} from './cms-workflow-fixtures.test-support';
import {
  WORKFLOW_COMMAND_SPECS,
  type CmsWorkflowCommandOperationId,
} from './cms-workflow-command-specs';
import {
  sendWorkflowCommand,
  workflowCommandPath,
  type WorkflowCommandResult,
} from './cms-workflow-command-transport';

const OPERATIONS = Object.keys(
  COMMAND_CASES,
) as CmsWorkflowCommandOperationId[];

const cookie = { cookie: `wj_csrf=${CSRF}; other=1` };

const send = (
  testCase: CommandCase,
  answer: Response | Error,
  overrides: Partial<{ body: unknown; ifMatch: string; key: string }> = {},
  documentRef: { cookie: string } = cookie,
): Promise<WorkflowCommandResult<unknown>> => {
  const fetcher = vi.fn(() =>
    answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
  );
  return sendWorkflowCommand(
    WORKFLOW_COMMAND_SPECS[testCase.operationId] as never,
    {
      ids: testCase.params,
      body: overrides.body ?? testCase.body,
      ifMatch: overrides.ifMatch ?? testCase.ifMatch,
      idempotencyKey: overrides.key ?? KEY,
    },
    { fetcher, documentRef },
  );
};

const refusal = async (
  testCase: CommandCase,
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) => {
  const result = await send(
    testCase,
    jsonResponse(status, apiError(code, details), headers),
  );
  if (result.kind !== 'refused') throw new Error(`got ${result.kind}`);
  return result.refusal;
};

describe('workflow command path', () => {
  it.each(OPERATIONS)('%s posts to its registry path', (id) => {
    const testCase = COMMAND_CASES[id];
    expect(workflowCommandPath(id, testCase.params)).toBe(testCase.browserPath);
  });

  it('encodes an identifier it substitutes', () => {
    expect(workflowCommandPath('CMS-03B-06', { reviewId: 'a/b' })).toBe(
      '/api/v1/cms/reviews/a%2Fb/decision',
    );
  });
});

describe('workflow command request', () => {
  it.each(OPERATIONS)(
    '%s sends the strict JSON body with the CSRF token, key and strong If-Match',
    async (id) => {
      const testCase = COMMAND_CASES[id];
      const fetcher = vi.fn(() => Promise.resolve(upstreamSuccess(testCase)));
      const result = await sendWorkflowCommand(
        WORKFLOW_COMMAND_SPECS[id] as never,
        {
          ids: testCase.params,
          body: testCase.body,
          ifMatch: testCase.ifMatch,
          idempotencyKey: KEY,
        },
        { fetcher, documentRef: cookie },
      );
      expect(result.kind).toBe('committed');
      const [target, init] = fetcher.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(target).toBe(testCase.browserPath);
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('same-origin');
      expect(init.redirect).toBe('manual');
      const headers = new Headers(init.headers);
      expect(headers.get('x-csrf-token')).toBe(CSRF);
      expect(headers.get('idempotency-key')).toBe(KEY);
      expect(headers.get('if-match')).toBe(testCase.ifMatch);
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('accept')).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual(testCase.body);
    },
  );

  it('sends nothing without a CSRF cookie, with a malformed body or with malformed headers', async () => {
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const fetcher = vi.fn();
    const call = (
      overrides: Parameters<typeof send>[2],
      documentRef = cookie,
    ) =>
      sendWorkflowCommand(
        WORKFLOW_COMMAND_SPECS['CMS-03B-06'] as never,
        {
          ids: testCase.params,
          body: overrides?.body ?? testCase.body,
          ifMatch: overrides?.ifMatch ?? testCase.ifMatch,
          idempotencyKey: overrides?.key ?? KEY,
        },
        { fetcher, documentRef },
      );
    expect(await call({}, { cookie: 'other=1' })).toEqual({
      kind: 'local',
      reason: 'csrf_missing',
    });
    expect(await call({ body: { reviewId: 'x' } })).toEqual({
      kind: 'local',
      reason: 'request_invalid',
    });
    expect(await call({ key: 'short' })).toEqual({
      kind: 'local',
      reason: 'request_invalid',
    });
    expect(await call({ ifMatch: '7' })).toEqual({
      kind: 'local',
      reason: 'request_invalid',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads the CSRF token from the real document cookie by default', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    document.cookie = `wj_csrf=${CSRF}`;
    const fetcher = vi.fn(() => Promise.resolve(upstreamSuccess(testCase)));
    const result = await sendWorkflowCommand(
      WORKFLOW_COMMAND_SPECS['CMS-03B-05'] as never,
      {
        ids: testCase.params,
        body: testCase.body,
        ifMatch: testCase.ifMatch,
        idempotencyKey: KEY,
      },
      { fetcher },
    );
    document.cookie = 'wj_csrf=; max-age=0';
    expect(result.kind).toBe('committed');
  });

  it('falls back to the global fetch when no fetcher is injected', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(upstreamSuccess(testCase)),
    ) as unknown as typeof fetch;
    try {
      const result = await sendWorkflowCommand(
        WORKFLOW_COMMAND_SPECS['CMS-03B-05'] as never,
        {
          ids: testCase.params,
          body: testCase.body,
          ifMatch: testCase.ifMatch,
          idempotencyKey: KEY,
        },
        { documentRef: cookie },
      );
      expect(result.kind).toBe('committed');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('committed answers', () => {
  it.each(OPERATIONS)(
    '%s commits only the verified strict resource',
    async (id) => {
      const testCase = COMMAND_CASES[id];
      const result = await send(testCase, upstreamSuccess(testCase));
      expect(result).toMatchObject({
        kind: 'committed',
        status: testCase.successStatus,
      });
    },
  );

  it('commits a revoke on its 200 answer', async () => {
    expect((await send(REVOKE_CASE, upstreamSuccess(REVOKE_CASE))).kind).toBe(
      'committed',
    );
  });

  it('treats a 2xx it cannot verify as an unknown outcome', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    for (const answer of [
      jsonResponse(200, testCase.resource, { etag: testCase.etag as string }),
      jsonResponse(testCase.successStatus, { id: 1 }),
      new Response('nope', { status: testCase.successStatus }),
      jsonResponse(testCase.successStatus, testCase.mismatched, {
        etag: testCase.etag as string,
        location: testCase.location as string,
      }),
    ])
      expect(await send(testCase, answer)).toEqual({
        kind: 'unknown',
        requestId: null,
      });
  });
});

describe('unknown outcomes keep the key', () => {
  const testCase = COMMAND_CASES['CMS-03B-09'];

  it('is unknown after a transport loss, the outcome marker or a 5xx', async () => {
    expect(await send(testCase, new Error('socket'))).toEqual({
      kind: 'unknown',
      requestId: null,
    });
    const marked = await send(
      testCase,
      jsonResponse(502, apiError('BAD_GATEWAY'), {
        'x-cms-editorial-outcome': 'unknown',
      }),
    );
    expect(marked).toEqual({ kind: 'unknown', requestId: REQUEST_ID });
    for (const status of [500, 502, 503, 504])
      expect(
        (await send(testCase, jsonResponse(status, apiError('INTERNAL_ERROR'))))
          .kind,
      ).toBe('unknown');
    expect(
      await send(testCase, new Response('<html>', { status: 504 })),
    ).toEqual({ kind: 'unknown', requestId: null });
  });

  it('is unknown after a redirect or an opaque redirect, which answer nothing', async () => {
    expect(
      await send(
        testCase,
        new Response(null, { status: 302, headers: { location: '/' } }),
      ),
    ).toEqual({ kind: 'unknown', requestId: null });
    expect(await send(testCase, Response.error())).toEqual({
      kind: 'unknown',
      requestId: null,
    });
  });

  it('reads a request id only from a well-formed response header', async () => {
    const withHeader = await send(
      testCase,
      new Response('x', {
        status: 504,
        headers: { 'x-request-id': REQUEST_ID },
      }),
    );
    expect(withHeader).toEqual({ kind: 'unknown', requestId: REQUEST_ID });
    const badHeader = await send(
      testCase,
      new Response('x', { status: 504, headers: { 'x-request-id': '<b>' } }),
    );
    expect(badHeader).toEqual({ kind: 'unknown', requestId: null });
  });

  it('treats the retryable preflight 503 as a refusal that committed nothing', async () => {
    const result = await refusal(testCase, 503, 'DEPENDENCY_UNAVAILABLE', {
      dependencyClass: 'preflight',
      retryable: true,
      retryAfterSeconds: 12,
    });
    expect(result).toMatchObject({
      status: 503,
      preflightUnavailable: true,
      retryAfterSeconds: 12,
    });
  });
});

describe('401 answers', () => {
  const testCase = COMMAND_CASES['CMS-03B-06'];

  it('classifies a step-up shortfall and never as a gate or a sign-in', async () => {
    const navigate = await send(
      testCase,
      jsonResponse(
        401,
        apiError('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        }),
      ),
    );
    expect(navigate).toEqual({
      kind: 'step-up',
      recovery: { kind: 'navigate' },
    });
    const none = await send(
      testCase,
      jsonResponse(
        401,
        apiError('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['sms'],
        }),
      ),
    );
    expect(none).toEqual({
      kind: 'step-up',
      recovery: { kind: 'no-method', requestId: REQUEST_ID },
    });
    const malformed = await send(
      testCase,
      jsonResponse(401, apiError('STEP_UP_REQUIRED', { recoveryAction: 'x' })),
    );
    expect(malformed).toEqual({
      kind: 'step-up',
      recovery: { kind: 'malformed', requestId: REQUEST_ID },
    });
  });

  it('classifies a missing or expired session as signed out', async () => {
    expect(
      await send(
        testCase,
        jsonResponse(
          401,
          apiError('UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
        ),
      ),
    ).toEqual({ kind: 'signed-out', requestId: REQUEST_ID });
    expect(await send(testCase, new Response('x', { status: 401 }))).toEqual({
      kind: 'signed-out',
      requestId: null,
    });
  });
});

describe('definite refusals', () => {
  const decision = COMMAND_CASES['CMS-03B-06'];

  it('exposes the 403 gate token and drops one it does not know', async () => {
    expect(
      await refusal(decision, 403, 'FORBIDDEN', {
        reasonCode: 'separation_of_duties',
      }),
    ).toMatchObject({ status: 403, reason: 'separation_of_duties' });
    expect(
      await refusal(decision, 403, 'FORBIDDEN', { reasonCode: 'whatever' }),
    ).toMatchObject({ status: 403, reason: null });
  });

  it('exposes a 409 reason with its structured members or the version mismatch kind', async () => {
    expect(
      await refusal(COMMAND_CASES['CMS-03B-05'], 409, 'CONFLICT', {
        reasonCode: 'dependency_changed',
        dependencyHash: 'd'.repeat(64),
      }),
    ).toMatchObject({
      status: 409,
      reason: 'dependency_changed',
      details: { reasonCode: 'dependency_changed' },
    });
    expect(
      await refusal(decision, 409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        currentVersion: '9',
      }),
    ).toMatchObject({
      status: 409,
      reason: null,
      conflict: 'VERSION_MISMATCH',
    });
    expect(
      await refusal(decision, 409, 'CONFLICT', { conflict: 'NOPE' }),
    ).toMatchObject({ conflict: null });
  });

  it('exposes the per-category preflight list and the field violations of a 422', async () => {
    const preflight = [
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
    ];
    const typed = await refusal(
      COMMAND_CASES['CMS-03B-05'],
      422,
      'VALIDATION_FAILED',
      {
        reasonCode: 'preflight_failed',
        preflight,
      },
    );
    expect(typed).toMatchObject({
      reason: 'preflight_failed',
      details: { reasonCode: 'preflight_failed', preflight },
    });
    const plain = await refusal(decision, 422, 'VALIDATION_FAILED', {
      violations: [
        {
          path: '/reason',
          code: 'reason_too_long',
          message: 'The value is invalid.',
        },
        { path: 7 },
        'x',
      ],
    });
    expect(plain.violations).toEqual([
      { path: '/reason', code: 'reason_too_long' },
    ]);
  });

  it('reads the wait of a 429 from the body, then the Retry-After header', async () => {
    expect(
      await refusal(decision, 429, 'RATE_LIMITED', { retryAfterSeconds: 7 }),
    ).toMatchObject({ status: 429, retryAfterSeconds: 7 });
    expect(
      await refusal(decision, 429, 'RATE_LIMITED', {}, { 'retry-after': '9' }),
    ).toMatchObject({ retryAfterSeconds: 9 });
    expect(
      await refusal(
        decision,
        429,
        'RATE_LIMITED',
        {},
        { 'retry-after': 'soon' },
      ),
    ).toMatchObject({ retryAfterSeconds: null });
    expect(
      await refusal(decision, 429, 'RATE_LIMITED', { retryAfterSeconds: 0 }),
    ).toMatchObject({ retryAfterSeconds: null });
  });

  it('falls back to the status for a body that is not an ApiError', async () => {
    const result = await send(
      decision,
      new Response('<html>', { status: 404 }),
    );
    expect(result).toEqual({
      kind: 'refused',
      refusal: {
        status: 404,
        code: null,
        reason: null,
        details: null,
        conflict: null,
        violations: [],
        retryAfterSeconds: null,
        preflightUnavailable: false,
        requestId: null,
      },
    });
  });

  it('keeps the code and request id of a plain 404, 400 and 415', async () => {
    for (const [status, code] of [
      [404, 'NOT_FOUND'],
      [400, 'INVALID_REQUEST'],
      [415, 'UNSUPPORTED_MEDIA_TYPE'],
    ] as const)
      expect(await refusal(decision, status, code)).toMatchObject({
        status,
        code,
        requestId: REQUEST_ID,
      });
  });
});
