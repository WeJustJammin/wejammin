import { describe, expect, it } from 'vitest';

import {
  DRY_RUN_ID,
  apiError,
  assignmentResource,
  callFacade,
  decisionResource,
  dryRunResource,
  draftDetail,
  reviewResource,
  reviewTarget,
  versionTarget,
  type FacadeCall,
} from './content-schema-review-dec108.test-support';

/**
 * BE03a error matrices for CMS-03A-09..12 and 14, plus the CMS-03A-04
 * STEP_UP_REQUIRED variant: transport guards run before any upstream call and
 * typed upstream errors survive the first-party boundary unchanged.
 */

const bodies = {
  'CMS-03A-09': {
    expectedVersion: '4',
    supportedLocales: null,
    fallbackChains: null,
    defaultTemplateVersionId: null,
    templateBindings: null,
  },
  'CMS-03A-10': {
    expectedVersion: '4',
    transformKey: null,
    transformVersion: null,
  },
  'CMS-03A-11': { expectedVersion: '4', dryRunId: DRY_RUN_ID },
  'CMS-03A-12': { expectedVersion: '4', decision: 'approve' },
  'CMS-03A-14': {
    action: 'revoke',
    expectedVersion: '4',
    assignmentId: DRY_RUN_ID,
  },
} as const;

type ErrorOperation = keyof typeof bodies;

const okBody: Record<ErrorOperation, unknown> = {
  'CMS-03A-09': draftDetail().resource,
  'CMS-03A-10': dryRunResource(),
  'CMS-03A-11': reviewResource(),
  'CMS-03A-12': decisionResource(),
  'CMS-03A-14': assignmentResource('revoked'),
};

const okStatus: Record<ErrorOperation, number> = {
  'CMS-03A-09': 201,
  'CMS-03A-10': 202,
  'CMS-03A-11': 201,
  'CMS-03A-12': 201,
  'CMS-03A-14': 200,
};

const targetFor = (operation: ErrorOperation) =>
  operation === 'CMS-03A-12' || operation === 'CMS-03A-14'
    ? reviewTarget(operation)
    : versionTarget(operation);

const request = (
  operation: ErrorOperation,
  extra: Partial<FacadeCall> = {},
): FacadeCall => ({
  target: targetFor(operation),
  payload: bodies[operation],
  // The scripted upstream answers with the operation's own BE03a success
  // status (10 is 202, 14 revoke is 200), so the positive control is exact.
  upstream: { status: okStatus[operation], body: okBody[operation] },
  ...extra,
});

const operations = Object.keys(bodies) as ErrorOperation[];

/**
 * Positive control: the same operation with valid transport must reach the
 * private upstream and succeed, so a refusal below is proven to come from the
 * guard under test and not from the operation being unsupported.
 */
const expectControlForwarded = async (op: ErrorOperation): Promise<void> => {
  const control = await callFacade(request(op));
  expect(control.response.status).toBe(okStatus[op]);
  expect(control.fetch).toHaveBeenCalledTimes(1);
};

describe('[DEC-108] transport guards precede any upstream call', () => {
  it.each(operations)('%s requires an exact strong If-Match', async (op) => {
    await expectControlForwarded(op);
    for (const ifMatch of [null, 'W/"4"', '4', '"4", "5"']) {
      const { response, fetch } = await callFacade(
        request(op, { headers: { 'if-match': ifMatch } }),
      );
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it.each(operations)('%s requires an Idempotency-Key', async (op) => {
    await expectControlForwarded(op);
    for (const key of [null, 'short']) {
      const { response, fetch } = await callFacade(
        request(op, { headers: { 'idempotency-key': key } }),
      );
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it.each(operations)('%s requires a matching CSRF token', async (op) => {
    await expectControlForwarded(op);
    const { response, fetch } = await callFacade(
      request(op, { headers: { 'x-csrf-token': 'other' } }),
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(operations)('%s refuses a cross-origin request', async (op) => {
    await expectControlForwarded(op);
    const { response, fetch } = await callFacade(
      request(op, { headers: { origin: 'https://evil.test' } }),
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a malformed review id for the review-scoped commands', async () => {
    await expectControlForwarded('CMS-03A-12');
    await expectControlForwarded('CMS-03A-14');
    for (const operation of ['CMS-03A-12', 'CMS-03A-14'] as const) {
      const { response, fetch } = await callFacade({
        ...request(operation),
        target: { operationId: operation, reviewId: 'not-a-uuid' },
      });
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('refuses a missing version path id for the version-scoped commands', async () => {
    await expectControlForwarded('CMS-03A-09');
    await expectControlForwarded('CMS-03A-10');
    await expectControlForwarded('CMS-03A-11');
    for (const operation of [
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
    ] as const) {
      const { response, fetch } = await callFacade({
        ...request(operation),
        target: { operationId: operation },
      });
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('refuses a declared operation id that disagrees with the target', async () => {
    await expectControlForwarded('CMS-03A-09');
    const { response, fetch } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: { ...bodies['CMS-03A-09'], operationId: 'CMS-03A-10' },
      upstream: { status: 201, body: okBody['CMS-03A-09'] },
    });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('[DEC-108] typed upstream errors cross the boundary unchanged', () => {
  it.each(['CMS-03A-12', 'CMS-03A-14', 'CMS-03A-04'] as const)(
    '%s forwards 401 STEP_UP_REQUIRED with step_up recovery and allowed methods',
    async (op) => {
      // BE03a: missing/stale MFA is recoverable by step-up, never re-authentication.
      const upstream = {
        status: 401,
        body: apiError(
          'STEP_UP_REQUIRED',
          {
            recoveryAction: 'step_up',
            allowedMethods: ['totp', 'webauthn'],
            internalBindingId: 'must-not-cross',
          },
          'Recent verification is required.',
        ),
      };
      const { response } = await callFacade(
        op === 'CMS-03A-04'
          ? {
              target: versionTarget(op),
              form: {
                operationId: op,
                expectedVersion: '4',
                dryRunId: DRY_RUN_ID,
                approvalIds: JSON.stringify([DRY_RUN_ID]),
                migrationPlanId: '',
                stepUpToken: 'token-123',
                confirmed: 'true',
              },
              upstream,
            }
          : { target: reviewTarget(op), payload: bodies[op], upstream },
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as {
        code: string;
        details: Record<string, unknown>;
      };
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toStrictEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp', 'webauthn'],
      });
    },
  );

  it('keeps a plain 401 UNAUTHENTICATED as re-authentication, not step-up', async () => {
    const { response } = await callFacade(
      request('CMS-03A-12', {
        upstream: {
          status: 401,
          body: apiError('UNAUTHENTICATED', {
            recoveryAction: 'reauthenticate',
          }),
        },
      }),
    );
    const body = (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(body.details).toStrictEqual({ recoveryAction: 'reauthenticate' });
  });

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'VALIDATION_FAILED'],
    [429, 'RATE_LIMITED'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const)(
    'forwards upstream %i %s for every DEC-108 command',
    async (status, code) => {
      for (const op of operations) {
        const { response } = await callFacade(
          request(op, {
            upstream: { status, body: apiError(code) },
          }),
        );
        expect(response.status).toBe(status);
        expect(((await response.json()) as { code: string }).code).toBe(code);
      }
    },
  );

  it('forwards a 409 stale-version conflict with the safe current version only', async () => {
    const { response } = await callFacade(
      request('CMS-03A-11', {
        upstream: {
          status: 409,
          body: apiError('CONFLICT', {
            expectedVersion: '4',
            currentVersion: '5',
            reason: 'stale_version',
            reviewerPersonId: 'must-not-cross',
          }),
          headers: { etag: '"5"' },
        },
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('etag')).toBe('"5"');
    expect(
      ((await response.json()) as { details: unknown }).details,
    ).toStrictEqual({
      expectedVersion: '4',
      currentVersion: '5',
      reason: 'stale_version',
    });
  });

  it('keeps a concealed 404 free of any resource-specific disclosure', async () => {
    const { response } = await callFacade(
      request('CMS-03A-12', {
        upstream: {
          status: 404,
          body: apiError('NOT_FOUND', { reviewExists: true }),
        },
      }),
    );
    expect(response.status).toBe(404);
    expect(
      ((await response.json()) as { details: unknown }).details,
    ).toStrictEqual({});
  });

  it.each(operations)(
    '%s turns a malformed success body into 502',
    async (op) => {
      const { response } = await callFacade(
        request(op, {
          upstream: { status: 201, body: { resourceKind: 'other' } },
        }),
      );
      expect(response.status).toBe(502);
    },
  );

  it('preserves Retry-After on a rate-limited decision', async () => {
    const { response } = await callFacade(
      request('CMS-03A-12', {
        upstream: {
          status: 429,
          body: apiError('RATE_LIMITED', { retryAfterSeconds: 7 }),
          headers: { 'retry-after': '7' },
        },
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('7');
  });
});
