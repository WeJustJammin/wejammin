import { describe, expect, it, vi } from 'vitest';

import { createCmsRelatedContentApp } from './related-content-routes';
import {
  dependencies,
  request,
  type CmsRelatedContentPortResult,
} from './related-content-routes.test-support';
import { PARTY_ID, USER_ID } from '../cms-editorial-production.test-support';

describe('CMS-03C-05 port failure mapping', () => {
  it('fails closed after admission while the curated authority is unavailable', async () => {
    const actRelatedContent = vi.fn(
      async (): Promise<CmsRelatedContentPortResult> => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'curated authority unavailable',
      }),
    );
    const response = await createCmsRelatedContentApp(
      dependencies({ actRelatedContent }),
    ).request(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
    expect(actRelatedContent).toHaveBeenCalledTimes(1);
  });

  it('echoes a bounded retry-after when the port carries one', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'curated authority unavailable',
          retryAfterSeconds: 15,
        }),
      }),
    ).request(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('15');
  });

  it('maps session failures and missing capability without reaching the port', async () => {
    let actCalls = 0;
    const app = createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => {
          actCalls += 1;
          return {
            ok: false,
            status: 503,
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'curated authority unavailable',
          };
        },
        resolveSession: async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'missing session',
          details: {},
        }),
      }),
    );
    const unauthenticated = await app.request(request());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    const unauthorized = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: USER_ID,
            actingPartyId: PARTY_ID,
            capabilities: ['cms.reader'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(unauthorized.status).toBe(403);
    expect(await unauthorized.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
      details: { reasonCode: 'CAPABILITY_REQUIRED' },
    });
    expect(actCalls).toBe(0);
  });

  it('forwards port refusals with bounded allowlisted details', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 404,
          code: 'RELATED_CONTENT_NOT_FOUND',
          message: 'related content rule not found',
          details: { secret: 'private' },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error).toMatchObject({ code: 'RELATED_CONTENT_NOT_FOUND' });
    expect(JSON.stringify(error)).not.toContain('private');
  });

  it('drops primitive detail payloads from port refusals', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () =>
          ({
            ok: false,
            status: 404,
            code: 'RELATED_CONTENT_NOT_FOUND',
            message: 'not found',
            details: 'primitive-details',
          }) as unknown as CmsRelatedContentPortResult,
      }),
    ).request(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ details: {} });
  });

  it('maps 409 and 429 port refusals to allowlisted details without leaking extras', async () => {
    const conflict = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 409,
          code: 'RELATED_CONTENT_VERSION_CONFLICT',
          message: 'version conflict',
          details: {
            expectedVersion: '1',
            currentVersion: '2',
            internalOnly: 'secret',
          },
        }),
      }),
    ).request(request());
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      code: 'RELATED_CONTENT_VERSION_CONFLICT',
      details: { expectedVersion: '1', currentVersion: '2' },
    });
    const limited = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'curated authority rate limited',
          details: { retryAfterSeconds: 30, limit: 60, resetAt: 31_000 },
        }),
      }),
    ).request(request());
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 30, limit: 60, resetAt: 31_000 },
    });
  });

  it('strips non-conforming violation entries from 422 detail payloads', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 422,
          code: 'RELATED_CONTENT_VALIDATION_FAILED',
          message: 'validation failed',
          details: {
            violations: [
              'not-an-object',
              null,
              { path: 42, code: 'bad' },
              { path: 'bad path', code: 'bad' },
              { path: '/valid/path', code: 'invalid_ref' },
            ],
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_VALIDATION_FAILED',
      details: { violations: [{ path: '/valid/path', code: 'invalid_ref' }] },
    });
  });

  it('returns an empty violation list when the port sends no violations array', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 422,
          code: 'RELATED_CONTENT_VALIDATION_FAILED',
          message: 'validation failed',
          details: { violations: 'oops' },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(422);
    const payload = (await response.json()) as { details: unknown };
    expect(payload.details).toEqual({});
  });

  it('drops 403 refusal details when the reason code is missing or unexpected', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 403,
          code: 'RELATED_CONTENT_FORBIDDEN',
          message: 'forbidden',
          details: { reasonCode: 'SOMETHING_ELSE' },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
    });
  });

  it('treats 502 port failures as non-retryable dependency errors', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 502,
          code: 'DEPENDENCY_INVALID_RESPONSE',
          message: 'upstream invalid',
        }),
      }),
    ).request(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
      details: { dependencyClass: 'cms_composition', retryable: false },
    });
  });

  it('maps unrecognized port statuses to a safe internal error', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () =>
          ({
            ok: false,
            status: 418,
            code: 'UNEXPECTED',
            message: 'unmapped port status',
          }) as unknown as CmsRelatedContentPortResult,
      }),
    ).request(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('drops unknown-shape and empty violation detail payloads', async () => {
    const unknownShape = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 422,
          code: 'RELATED_CONTENT_VALIDATION_FAILED',
          message: 'validation failed',
          details: {
            violations: [{ path: '/valid', code: 'bad_code' }],
          },
        }),
      }),
    ).request(request());
    expect(unknownShape.status).toBe(422);
    expect(await unknownShape.json()).toMatchObject({ details: {} });
    const emptyList = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 422,
          code: 'RELATED_CONTENT_VALIDATION_FAILED',
          message: 'validation failed',
          details: { violations: [] },
        }),
      }),
    ).request(request());
    expect(emptyList.status).toBe(422);
    expect(await emptyList.json()).toMatchObject({ details: {} });
  });

  it('drops 409 details that are not version strings', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 409,
          code: 'RELATED_CONTENT_VERSION_CONFLICT',
          message: 'version conflict',
          details: { expectedVersion: 'not-a-version', currentVersion: 2 },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ details: {} });
  });

  it('drops 429 details that are not safe non-negative numbers', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'rate limited',
          details: { retryAfterSeconds: 'soon', limit: -1, resetAt: 1.5 },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ details: {} });
  });
});
