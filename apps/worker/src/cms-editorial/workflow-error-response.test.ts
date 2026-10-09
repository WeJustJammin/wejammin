import { describe, expect, it } from 'vitest';

import { ApiErrorSchema, cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import { errorResponse, publishedError, sanitizeReadError } from './routes';
import type { CmsEditorialDependencies, CmsEditorialError } from './types';

/*
 * A Slice 11 response is serialized from the already-published error: the
 * structured detail members (preflight entries, alternatives, the permitted MFA
 * methods) must survive the envelope that flattens Slice 10 details to scalars.
 */

const policyOf = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const origin = 'https://cms-console.example.test';
const dependencies = {
  humanOrigins: [origin],
} as unknown as CmsEditorialDependencies;
const request = new Request('https://api.example.test/x', {
  headers: { origin },
});
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const failure = (
  status: number,
  extra: Partial<Omit<CmsEditorialError, 'ok' | 'status'>> = {},
): CmsEditorialError =>
  ({
    ok: false,
    status,
    code: 'PRIVATE',
    message: 'private text',
    ...extra,
  }) as CmsEditorialError;

describe('Slice 11 error response', () => {
  it('serializes the step-up recovery with the configured MFA methods', async () => {
    const response = errorResponse(
      request,
      dependencies,
      requestId,
      failure(401, { code: 'STEP_UP_REQUIRED' }),
      undefined,
      policyOf('CMS-03B-06'),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = ApiErrorSchema.parse(await response.json());
    expect(body).toMatchObject({
      code: 'STEP_UP_REQUIRED',
      details: {
        recoveryAction: 'step_up',
        allowedMethods: [...MFA_METHOD_REGISTRY],
      },
      requestId,
    });
  });

  it('keeps structured preflight entries and sets the retry header of an outage', async () => {
    const entries = [
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
    ];
    const refused = errorResponse(
      request,
      dependencies,
      requestId,
      failure(422, {
        details: { reasonCode: 'preflight_failed', preflight: entries },
      }),
      undefined,
      policyOf('CMS-03B-09'),
    );
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'preflight_failed',
      preflight: entries,
    });
    const unavailable = errorResponse(
      request,
      dependencies,
      requestId,
      failure(503, { details: { dependencyClass: 'preflight' } }),
      undefined,
      policyOf('CMS-03B-09'),
    );
    expect(unavailable.headers.get('retry-after')).toBe('5');
    expect(unavailable.headers.get('x-cms-editorial-retryable')).toBe('true');
    expect(
      ((await unavailable.json()) as { details: unknown }).details,
    ).toEqual({
      dependencyClass: 'preflight',
      retryable: true,
    });
  });

  it('echoes the rate limit headers of a 429', async () => {
    const response = errorResponse(
      request,
      dependencies,
      requestId,
      failure(429, { details: { limit: 30, resetAt: '99' } }),
      undefined,
      policyOf('CMS-03B-05'),
    );
    expect(response.headers.get('ratelimit-limit')).toBe('30');
    expect(response.headers.get('ratelimit-reset')).toBe('99');
    expect(response.headers.get('retry-after')).toBe('1');
  });

  it('publishes and sanitizes through the Slice 11 boundary for a Slice 11 row only', () => {
    const row = policyOf('CMS-03B-16');
    expect(
      publishedError(failure(403, { details: { reasonCode: 'junk' } }), row),
    ).toMatchObject({ details: {} });
    expect(
      sanitizeReadError(
        failure(403, { details: { reasonCode: 'capability_missing' } }),
        row,
      ),
    ).toMatchObject({
      message: 'The CMS editorial action is not allowed.',
      details: { reasonCode: 'capability_missing' },
    });
    // A Slice 10 row keeps the Slice 10 projection untouched.
    expect(
      publishedError(
        failure(403, { details: { reasonCode: 'junk' } }),
        policyOf('CMS-03B-14'),
      ).details,
    ).toEqual({});
  });
});
