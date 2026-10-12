import { describe, expect, it } from 'vitest';

import { ApiErrorSchema, cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { errorResponse, publishedError } from './route-errors';
import type { CmsEditorialDependencies, CmsEditorialError } from './types';

/*
 * BE00 lines 172 and 590: every dependency failure of the CMS editorial surface
 * publishes the one global code `DEPENDENCY_UNAVAILABLE`; a 502 is a contacted
 * dependency that answered invalid data and carries
 * `{ dependencyClass, retryable: true }`, exactly like a 503, with no provider
 * name, upstream text or `Retry-After`. `BAD_GATEWAY` is defined nowhere, so no
 * route may publish it whatever code the private port named.
 */

const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const dependencies = {
  humanOrigins: ['https://app.example.test'],
} as unknown as CmsEditorialDependencies;

/** A port answer that names the retired code, a provider and upstream text. */
const upstream = (
  status: 502 | 503 | 504,
  code: string,
): CmsEditorialError => ({
  ok: false,
  status,
  code,
  message: 'provider-x said: connection reset (secret detail)',
  details: { dependencyClass: 'provider-x', retryable: false, note: 'secret' },
});

const response = (
  failure: CmsEditorialError,
  policy: (typeof cmsEditorialRoutePolicies)[number] | undefined,
): Response =>
  errorResponse(
    new Request('https://app.example.test/api/v1/cms/x'),
    dependencies,
    requestId,
    failure,
    undefined,
    policy,
  );

describe('[BE00:172][BE00:590] a 502 is published as DEPENDENCY_UNAVAILABLE on every editorial route', () => {
  it.each(
    cmsEditorialRoutePolicies.map((policy) => [policy.operationId, policy]),
  )(
    '%s publishes a 502 as DEPENDENCY_UNAVAILABLE with a retryable cms_editorial dependency and no upstream text',
    async (_operationId, policy) => {
      for (const code of ['BAD_GATEWAY', 'DEPENDENCY_UNAVAILABLE', 'ANY']) {
        const published = publishedError(upstream(502, code), policy);
        expect(published).toMatchObject({
          status: 502,
          code: 'DEPENDENCY_UNAVAILABLE',
          details: { dependencyClass: 'cms_editorial', retryable: true },
        });
        expect(published.retryAfterSeconds).toBeUndefined();
        const answered = response(upstream(502, code), policy);
        expect(answered.status).toBe(502);
        expect(answered.headers.get('retry-after')).toBeNull();
        // The Worker's automatic-retry proof is unchanged: a contract drift is
        // not retried blindly (docs/runbooks/platform/cms-editorial.md).
        expect(answered.headers.get('x-cms-editorial-retryable')).toBe('false');
        const text = await answered.text();
        expect(text).not.toContain('BAD_GATEWAY');
        expect(text).not.toContain('provider-x');
        expect(text).not.toContain('secret');
        expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
          code: 'DEPENDENCY_UNAVAILABLE',
          details: { dependencyClass: 'cms_editorial', retryable: true },
          requestId,
        });
      }
    },
  );

  it('publishes a 502 from the policy-free write projection the same way', () => {
    expect(publishedError(upstream(502, 'BAD_GATEWAY'))).toMatchObject({
      status: 502,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_editorial', retryable: true },
    });
  });

  it('keeps 503 DEPENDENCY_UNAVAILABLE and 504 GATEWAY_TIMEOUT exactly as published before', () => {
    for (const policy of cmsEditorialRoutePolicies) {
      expect(
        publishedError(upstream(503, 'ANY'), policy),
        policy.operationId,
      ).toMatchObject({
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        retryAfterSeconds: 5,
      });
      expect(
        publishedError(upstream(504, 'ANY'), policy),
        policy.operationId,
      ).toMatchObject({
        status: 504,
        code: 'GATEWAY_TIMEOUT',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        retryAfterSeconds: 5,
      });
    }
  });
});
