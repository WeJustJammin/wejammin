import { describe, expect, it } from 'vitest';

import {
  apiError,
  jsonResponse,
} from '../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';
import {
  COMMAND_CASES,
  CSRF,
  KEY,
  ORIGIN,
  REVOKE_CASE,
  bindingFor,
  commandRequest,
  upstreamSuccess,
  type CommandCase,
} from './cms-workflow-platform-command.test-support';
import {
  forwardCmsWorkflowCommand,
  type CmsWorkflowCommandOperationId,
} from './cms-workflow-platform-command';

const OPERATIONS = Object.keys(
  COMMAND_CASES,
) as CmsWorkflowCommandOperationId[];
const UNKNOWN_HEADER = 'x-cms-editorial-outcome';

const run = (testCase: CommandCase, request: Request, binding: unknown) =>
  forwardCmsWorkflowCommand(
    testCase.operationId,
    request,
    testCase.params,
    binding,
  );

/** A body that counts how often it is pulled: a refusal must leave it unread. */
const spiedRequest = (
  testCase: CommandCase,
  headers: Record<string, string>,
) => {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('{"probe":true}'));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request(`${ORIGIN}${testCase.browserPath}`, {
    method: 'POST',
    headers: {
      cookie: `wj_csrf=${CSRF}`,
      'content-type': 'application/json',
      'idempotency-key': KEY,
      'if-match': testCase.ifMatch,
      ...headers,
    },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  return { request, pulls: () => pulls };
};

describe.each(OPERATIONS)('%s command proxy admission', (operationId) => {
  const testCase = COMMAND_CASES[operationId];
  const status = async (response: Promise<Response>) => (await response).status;

  it('answers 503 without a PLATFORM_API binding or for a non-POST method', async () => {
    expect(await status(run(testCase, commandRequest(testCase), null))).toBe(
      503,
    );
    expect(
      await status(
        run(
          testCase,
          commandRequest(testCase, { method: 'PUT' }),
          bindingFor(),
        ),
      ),
    ).toBe(503);
  });

  it('refuses a foreign origin and a failing CSRF double submit before reading the body', async () => {
    const foreign = spiedRequest(testCase, {
      origin: 'https://evil.example.test',
    });
    expect(await status(run(testCase, foreign.request, bindingFor()))).toBe(
      403,
    );
    expect(foreign.pulls()).toBe(0);
    const forged = spiedRequest(testCase, {
      origin: ORIGIN,
      'x-csrf-token': 'forged-token-00000001',
    });
    expect(await status(run(testCase, forged.request, bindingFor()))).toBe(403);
    expect(forged.pulls()).toBe(0);
    const missing = spiedRequest(testCase, { origin: ORIGIN });
    expect(await status(run(testCase, missing.request, bindingFor()))).toBe(
      403,
    );
    expect(missing.pulls()).toBe(0);
  });

  it('refuses any query member and a non-JSON media type with the allowlist', async () => {
    const binding = bindingFor();
    expect(
      await status(
        run(
          testCase,
          commandRequest(testCase, {
            url: `${ORIGIN}${testCase.browserPath}?force=1`,
          }),
          binding,
        ),
      ),
    ).toBe(400);
    const media = await run(
      testCase,
      commandRequest(testCase, { headers: { 'content-type': 'text/plain' } }),
      binding,
    );
    expect(media.status).toBe(415);
    expect(((await media.json()) as { details: unknown }).details).toEqual({
      allowedMediaTypes: ['application/json'],
    });
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a missing or malformed Idempotency-Key and If-Match as 400', async () => {
    const binding = bindingFor();
    for (const headers of [
      { 'idempotency-key': null },
      { 'idempotency-key': 'short' },
      { 'if-match': null },
      { 'if-match': 'W/"7"' },
      { 'if-match': '7' },
    ])
      expect(
        await status(
          run(testCase, commandRequest(testCase, { headers }), binding),
        ),
      ).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a malformed, non-JSON or over-cap body as 400 and a contract breach as 422', async () => {
    const binding = bindingFor();
    for (const body of ['{', '[1', 'x'.repeat(262_145)])
      expect(
        await status(
          run(testCase, commandRequest(testCase, { body }), binding),
        ),
      ).toBe(400);
    const unknown = await run(
      testCase,
      commandRequest(testCase, {
        body: JSON.stringify({ ...testCase.body, extra: 1 }),
      }),
      binding,
    );
    expect(unknown.status).toBe(422);
    expect(
      ((await unknown.json()) as { details: { violations: unknown[] } }).details
        .violations,
    ).toEqual([
      {
        path: '/extra',
        code: 'unknown_field',
        message: 'The value is invalid.',
      },
    ]);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('forwards exactly the parsed request, the allowlisted headers and the original key', async () => {
    const binding = bindingFor(upstreamSuccess(testCase));
    await run(testCase, commandRequest(testCase), binding);
    const [upstream] = binding.requests();
    expect(upstream?.method).toBe('POST');
    expect(new URL(upstream?.url ?? '').pathname).toBe(testCase.upstreamPath);
    expect(upstream?.headers.get('idempotency-key')).toBe(KEY);
    expect(upstream?.headers.get('if-match')).toBe(testCase.ifMatch);
    expect(upstream?.headers.get('x-csrf-token')).toBe(CSRF);
    expect(upstream?.headers.get('content-type')).toBe('application/json');
    expect(upstream?.headers.get('cookie')).toContain('wj_csrf=');
    expect(JSON.parse(await (upstream as Request).text())).toEqual(
      testCase.body,
    );
  });

  it('relays a verified success with no-store and never as a cacheable answer', async () => {
    const binding = bindingFor(upstreamSuccess(testCase));
    const response = await run(testCase, commandRequest(testCase), binding);
    expect(response.status).toBe(testCase.successStatus);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe(testCase.etag);
    expect(response.headers.get('location')).toBe(testCase.location);
    expect(response.headers.get(UNKNOWN_HEADER)).toBeNull();
    expect(await response.json()).toEqual(
      JSON.parse(JSON.stringify(testCase.resource)),
    );
  });

  it('treats a success it cannot verify as an unknown outcome (502)', async () => {
    const wrongStatus = jsonResponse(
      testCase.successStatus === 201 ? 200 : 201,
      testCase.resource,
      {
        ...(testCase.etag === null ? {} : { etag: testCase.etag }),
        ...(testCase.location === null ? {} : { location: testCase.location }),
      },
    );
    const notAResource = jsonResponse(testCase.successStatus, { id: 1 });
    const notJson = new Response('not json', {
      status: testCase.successStatus,
    });
    const wrongIdentity = jsonResponse(
      testCase.successStatus,
      testCase.mismatched,
      {
        ...(testCase.etag === null ? {} : { etag: testCase.etag }),
        ...(testCase.location === null ? {} : { location: testCase.location }),
      },
    );
    const bad = [wrongStatus, notAResource, notJson, wrongIdentity];
    if (testCase.etag !== null)
      bad.push(
        jsonResponse(testCase.successStatus, testCase.resource, {
          etag: '"99"',
          ...(testCase.location === null
            ? {}
            : { location: testCase.location }),
        }),
      );
    if (testCase.location !== null)
      bad.push(
        jsonResponse(testCase.successStatus, testCase.resource, {
          etag: testCase.etag as string,
          location: '/api/v1/cms/somewhere/else',
        }),
      );
    for (const upstream of bad) {
      const response = await run(
        testCase,
        commandRequest(testCase),
        bindingFor(upstream),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get(UNKNOWN_HEADER)).toBe('unknown');
    }
  });

  it('marks a transport loss and an upstream 5xx as unknown and a refusal as definite', async () => {
    const lost = await run(
      testCase,
      commandRequest(testCase),
      bindingFor(new Error('socket closed')),
    );
    expect(lost.status).toBe(503);
    expect(lost.headers.get(UNKNOWN_HEADER)).toBe('unknown');
    const notResponse = await run(testCase, commandRequest(testCase), {
      fetch: () => Promise.resolve('nope'),
    });
    expect(notResponse.status).toBe(503);
    expect(notResponse.headers.get(UNKNOWN_HEADER)).toBe('unknown');
    const server = await run(
      testCase,
      commandRequest(testCase),
      bindingFor(jsonResponse(504, apiError('GATEWAY_TIMEOUT'))),
    );
    expect(server.status).toBe(504);
    expect(server.headers.get(UNKNOWN_HEADER)).toBe('unknown');
    const refused = await run(
      testCase,
      commandRequest(testCase),
      bindingFor(jsonResponse(404, apiError('NOT_FOUND'))),
    );
    expect(refused.status).toBe(404);
    expect(refused.headers.get(UNKNOWN_HEADER)).toBeNull();
  });
});

describe('path and header cross-checks', () => {
  it('rejects an invalid path identifier as 400 and a path/body id disagreement as 422', async () => {
    for (const id of ['CMS-03B-05', 'CMS-03B-06', 'CMS-03B-18'] as const) {
      const testCase = COMMAND_CASES[id];
      const key = id === 'CMS-03B-05' ? 'entryId' : 'reviewId';
      const bad = await forwardCmsWorkflowCommand(
        id,
        commandRequest(testCase),
        { [key]: 'not-a-uuid' },
        bindingFor(),
      );
      expect(bad.status).toBe(400);
      const none = await forwardCmsWorkflowCommand(
        id,
        commandRequest(testCase),
        {},
        bindingFor(),
      );
      expect(none.status).toBe(400);
    }
    for (const id of ['CMS-03B-05', 'CMS-03B-06'] as const) {
      const testCase = COMMAND_CASES[id];
      const key = id === 'CMS-03B-05' ? 'entryId' : 'reviewId';
      const response = await forwardCmsWorkflowCommand(
        id,
        commandRequest(testCase),
        { [key]: '123e4567-e89b-42d3-a456-426614174099' },
        bindingFor(),
      );
      expect(response.status).toBe(422);
      expect(
        (
          (await response.json()) as {
            details: { violations: { path: string }[] };
          }
        ).details.violations[0]?.path,
      ).toBe(`/${key}`);
    }
  });

  it('rejects an If-Match that disagrees with the body expectedVersion as 400', async () => {
    for (const id of [
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-09',
      'CMS-03B-18',
    ] as const) {
      const testCase = COMMAND_CASES[id];
      const binding = bindingFor();
      const response = await forwardCmsWorkflowCommand(
        id,
        commandRequest(testCase, { headers: { 'if-match': '"99"' } }),
        testCase.params,
        binding,
      );
      expect(response.status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });

  it('lets the entry-version If-Match of a submit or preview name any strong version', async () => {
    for (const id of ['CMS-03B-05', 'CMS-03B-08'] as const) {
      const testCase = COMMAND_CASES[id];
      const response = await forwardCmsWorkflowCommand(
        id,
        commandRequest(testCase, { headers: { 'if-match': '"41"' } }),
        testCase.params,
        bindingFor(upstreamSuccess(testCase)),
      );
      expect(response.status).toBe(testCase.successStatus);
    }
  });
});

describe('CMS-03B-18 create and revoke', () => {
  it('answers a revoke only with 200 and a create only with 201', async () => {
    const revoke = await run(
      REVOKE_CASE,
      commandRequest(REVOKE_CASE),
      bindingFor(upstreamSuccess(REVOKE_CASE)),
    );
    expect(revoke.status).toBe(200);
    expect(revoke.headers.get('location')).toBeNull();
    const create = COMMAND_CASES['CMS-03B-18'];
    for (const [testCase, upstream] of [
      [REVOKE_CASE, upstreamSuccess(create)],
      [create, upstreamSuccess(REVOKE_CASE)],
    ] as const) {
      const response = await run(
        testCase,
        commandRequest(testCase),
        bindingFor(upstream),
      );
      expect(response.status).toBe(502);
    }
  });

  it('refuses a revoke that answers an active assignment or another assignment id', async () => {
    const wrongState = jsonResponse(200, COMMAND_CASES['CMS-03B-18'].resource, {
      etag: '"1"',
    });
    const wrongId = jsonResponse(200, REVOKE_CASE.mismatched, { etag: '"1"' });
    for (const upstream of [wrongState, wrongId])
      expect(
        (
          await run(
            REVOKE_CASE,
            commandRequest(REVOKE_CASE),
            bindingFor(upstream),
          )
        ).status,
      ).toBe(502);
  });
});

describe('typed failure relay', () => {
  const failure = (
    testCase: CommandCase,
    status: number,
    code: string,
    details: Record<string, unknown>,
  ) =>
    run(
      testCase,
      commandRequest(testCase),
      bindingFor(jsonResponse(status, apiError(code, details))),
    );

  it('relays the step-up shortfall with its recovery action and never as a 403', async () => {
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const response = await failure(testCase, 401, 'STEP_UP_REQUIRED', {
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      code: string;
      details: unknown;
      message: string;
    };
    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(body.message).toBe('Recent verification is required to continue.');
    expect(response.headers.get(UNKNOWN_HEADER)).toBeNull();
  });

  it('relays an operation reason token and refuses a code/status pair it did not declare', async () => {
    const decision = COMMAND_CASES['CMS-03B-06'];
    const duplicate = await failure(decision, 409, 'CONFLICT', {
      reasonCode: 'duplicate_decision',
    });
    expect(((await duplicate.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'duplicate_decision',
    });
    const gate = await failure(decision, 403, 'FORBIDDEN', {
      reasonCode: 'separation_of_duties',
    });
    expect(((await gate.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'separation_of_duties',
    });
    const preview = COMMAND_CASES['CMS-03B-08'];
    expect((await failure(preview, 418, 'TEAPOT', {})).status).toBe(502);
    expect((await failure(preview, 403, 'INTERNAL_ERROR', {})).status).toBe(
      403,
    );
  });

  it('relays the structured preflight list of a 422 and the retryable preflight 503', async () => {
    const submit = COMMAND_CASES['CMS-03B-05'];
    const preflight = [
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
    ];
    const refused = await failure(submit, 422, 'VALIDATION_FAILED', {
      reasonCode: 'preflight_failed',
      preflight,
    });
    expect(((await refused.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'preflight_failed',
      preflight,
    });
    const unavailable = await failure(submit, 503, 'DEPENDENCY_UNAVAILABLE', {
      dependencyClass: 'preflight',
      retryable: true,
    });
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get(UNKNOWN_HEADER)).toBe('unknown');
    expect(
      ((await unavailable.json()) as { details: unknown }).details,
    ).toEqual({ dependencyClass: 'preflight', retryable: true });
  });

  it('relays the time-authority refusal of a schedule with its alternatives', async () => {
    const schedule = COMMAND_CASES['CMS-03B-07'];
    const details = {
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
    };
    const response = await failure(schedule, 422, 'VALIDATION_FAILED', details);
    expect(((await response.json()) as { details: unknown }).details).toEqual(
      details,
    );
  });
});
