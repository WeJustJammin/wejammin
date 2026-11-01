import {
  ApiErrorSchema,
  RelatedContentRuleReadSchema,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { PARTY_ID, USER_ID } from '../cms-editorial-production.test-support';
import {
  ENTRY_ID,
  PATH,
  readRequest,
  REQUEST_ID,
  ruleRead,
  storedRule,
} from './related-content-read.test-support';
import {
  createCmsRelatedContentApp,
  type CmsRelatedContentDependencies,
} from './related-content-routes';
import { dependencies } from './related-content-routes.test-support';

const serving = (rule = storedRule()) =>
  vi.fn<CmsRelatedContentDependencies['readRelatedContent']>(async () => ({
    ok: true,
    value: ruleRead(rule),
  }));

describe('cmsRelatedContentRead route (DEC-195)', () => {
  it('answers 200 with the stored rule, a strong ETag of its version, no-store and the request id', async () => {
    const read = serving();
    const response = await createCmsRelatedContentApp(
      dependencies({ readRelatedContent: read }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=UTF-8',
    );
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    const answer = RelatedContentRuleReadSchema.parse(await response.json());
    expect(answer).toEqual(ruleRead());
  });

  it('answers 200 { rule: null } with no ETag when no rule is active', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: async () => ({ ok: true, value: ruleRead(null) }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBeNull();
    expect(await response.json()).toEqual({ rule: null });
  });

  it('hands the port the operation, the verified session, the request id and the path entry only', async () => {
    const read = serving();
    await createCmsRelatedContentApp(
      dependencies({ readRelatedContent: read }),
    ).request(readRequest());
    expect(read).toHaveBeenCalledTimes(1);
    const input = read.mock.calls[0]?.[0];
    expect(input?.operationId).toBe('cmsRelatedContentRead');
    expect(input?.requestId).toBe(REQUEST_ID);
    expect(input?.path).toEqual({ entryId: ENTRY_ID });
    expect(input?.session).toMatchObject({
      userId: USER_ID,
      actingPartyId: PARTY_ID,
    });
    expect(Object.keys(input ?? {}).sort()).toEqual([
      'operationId',
      'path',
      'request',
      'requestId',
      'session',
    ]);
  });

  it('charges the user bucket (300) then the party bucket (600) of the read class before the port', async () => {
    const order: string[] = [];
    const rateLimit = vi.fn(
      async (input: { rateScope: string; limit: number }) => {
        order.push(`rate:${input.rateScope}`);
        return {
          ok: true as const,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: input.limit - 1,
            resetAt: 2_000,
          },
        };
      },
    );
    await createCmsRelatedContentApp(
      dependencies({
        rateLimit,
        readRelatedContent: async () => {
          order.push('port');
          return { ok: true, value: ruleRead() };
        },
      }),
    ).request(readRequest());
    expect(order).toEqual(['rate:user', 'rate:party', 'port']);
    expect(rateLimit.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsRelatedContentRead',
      rateClass: 'cms-related-content-read',
      rateScope: 'user',
      actorId: USER_ID,
      actingPartyId: PARTY_ID,
      principalClass: 'human',
      limit: 300,
      windowSeconds: 60,
    });
    expect(rateLimit.mock.calls[1]?.[0]).toMatchObject({
      rateScope: 'party',
      actorId: PARTY_ID,
      limit: 600,
      rateClass: 'cms-related-content-read',
    });
  });

  it('answers 429 with Retry-After from either bucket and never reaches the port', async () => {
    for (const denied of ['user', 'party'] as const) {
      const read = serving();
      const response = await createCmsRelatedContentApp(
        dependencies({
          readRelatedContent: read,
          rateLimit: async (input) => ({
            ok: true,
            value: {
              allowed: input.rateScope !== denied,
              limit: input.limit,
              remaining: input.rateScope === denied ? 0 : input.limit - 1,
              resetAt: 31_000,
            },
          }),
        }),
      ).request(readRequest());
      expect(response.status, denied).toBe(429);
      expect(response.headers.get('retry-after')).toBe('30');
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.details).toEqual({
        retryAfterSeconds: 30,
        limit: denied === 'user' ? 300 : 600,
        resetAt: 31_000,
      });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('refuses a decision whose limit is not the bucket limit as a dependency failure', async () => {
    const read = serving();
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: read,
        rateLimit: async () => ({
          ok: true,
          value: { allowed: true, limit: 60, remaining: 59, resetAt: 2_000 },
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(502);
    expect(read).not.toHaveBeenCalled();
  });

  it('answers the preflight for GET and POST on the shared path for an allowed origin only', async () => {
    const app = createCmsRelatedContentApp(dependencies());
    const allowed = await app.request(PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://cms.example.test' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, POST, OPTIONS',
    );
    const refused = await app.request(PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(refused.status).toBe(403);
  });

  it('emits one telemetry event named for the read with its outcome', async () => {
    const telemetry = vi.fn();
    await createCmsRelatedContentApp(
      dependencies({ telemetry, readRelatedContent: serving() }),
    ).request(readRequest());
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsRelatedContentRead',
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
    });
  });
});
