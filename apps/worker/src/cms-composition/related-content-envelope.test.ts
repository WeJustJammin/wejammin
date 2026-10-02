import { describe, expect, it, vi } from 'vitest';

import {
  createCmsRelatedContentApp,
  type CmsRelatedContentDependencies,
  type CmsRelatedContentRateDecision,
  type CmsRelatedContentResult,
} from './related-content-routes';
import {
  body,
  dependencies,
  request,
  validResource,
  type CmsRelatedContentPortResult,
} from './related-content-routes.test-support';
import { PARTY_ID, USER_ID } from '../cms-editorial-production.test-support';

describe('CMS-03C-05 port envelope validation', () => {
  it('rejects malformed and resource-mismatched port payloads as 502', async () => {
    const malformed = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () =>
          ({ ok: true }) as unknown as CmsRelatedContentPortResult,
      }),
    ).request(request());
    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
    const mismatched = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({
          ok: true,
          value: validResource({
            sourceEntryId: '20000000-0000-4000-8000-000000000002',
          }),
        }),
      }),
    ).request(request());
    expect(mismatched.status).toBe(502);
  });

  it('rejects a contract-invalid resource payload as 502', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () =>
          ({
            ok: true,
            value: {
              state: 'active',
              sourceEntryId: body.entryId,
              pins: body.pins,
              exclusions: body.exclusions,
              eligibleCount: 1,
            },
          }) as unknown as CmsRelatedContentPortResult,
      }),
    ).request(request());
    expect(response.status).toBe(502);
  });

  it('rejects invalid session envelopes, invalid humans, and null acting party', async () => {
    const malformed = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () =>
          ({ ok: true }) as unknown as Awaited<
            ReturnType<CmsRelatedContentDependencies['resolveSession']>
          >,
      }),
    ).request(request());
    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
    const invalidHuman = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: 'not-a-uuid',
            actingPartyId: PARTY_ID,
            capabilities: ['cms.author'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(invalidHuman.status).toBe(401);
    expect(await invalidHuman.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    const nullParty = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: USER_ID,
            actingPartyId: null,
            capabilities: ['cms.author'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(nullParty.status).toBe(403);
    expect(await nullParty.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
      details: { reasonCode: 'CAPABILITY_REQUIRED' },
    });
  });

  it('fails closed when the session or rate port throws, returns malformed shapes, or refuses capacity', async () => {
    const throwing = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => {
          throw new Error('session resolver crashed');
        },
      }),
    ).request(request());
    expect(throwing.status).toBe(503);
    expect(throwing.headers.get('retry-after')).toBe('15');

    const wrongLimit = await createCmsRelatedContentApp(
      dependencies({
        rateLimit: async () => ({
          ok: true,
          value: { allowed: true, limit: 60, remaining: 59, resetAt: 2_000 },
        }),
      }),
    ).request(request());
    expect(wrongLimit.status).toBe(502);

    const rateThrows = await createCmsRelatedContentApp(
      dependencies({
        rateLimit: async () => {
          throw new Error('rate limiter crashed');
        },
      }),
    ).request(request());
    expect(rateThrows.status).toBe(503);

    const rateRefuses = await createCmsRelatedContentApp(
      dependencies({
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: input.rateScope !== 'party',
            limit: input.limit,
            remaining: 0,
            resetAt: 61_000,
          },
        }),
      }),
    ).request(request());
    expect(rateRefuses.status).toBe(429);
    expect(rateRefuses.headers.get('retry-after')).toBe('60');
    expect(rateRefuses.headers.get('ratelimit-limit')).toBe('120');
    expect(rateRefuses.headers.get('ratelimit-remaining')).toBe('0');
    expect(await rateRefuses.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 60, limit: 120, resetAt: 61_000 },
    });
  });

  it('rejects a malformed rate envelope as 502 without calling the port', async () => {
    const actRelatedContent = vi.fn(
      async (): Promise<CmsRelatedContentPortResult> => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'unreachable',
      }),
    );
    const response = await createCmsRelatedContentApp(
      dependencies({
        rateLimit: async () =>
          ({
            nonsense: true,
          }) as unknown as CmsRelatedContentResult<CmsRelatedContentRateDecision>,
        actRelatedContent,
      }),
    ).request(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
    expect(actRelatedContent).not.toHaveBeenCalled();
  });

  it('forwards rate port refusals without calling the mutation port', async () => {
    const actRelatedContent = vi.fn(
      async (): Promise<CmsRelatedContentPortResult> => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'unreachable',
      }),
    );
    const response = await createCmsRelatedContentApp(
      dependencies({
        rateLimit: async () => ({
          ok: false as const,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'rate authority unavailable',
        }),
        actRelatedContent,
      }),
    ).request(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(actRelatedContent).not.toHaveBeenCalled();
  });

  it('fails closed when the curated authority port throws after passing admission', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => {
          throw new Error('curated authority crashed');
        },
      }),
    ).request(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('15');
  });
});
