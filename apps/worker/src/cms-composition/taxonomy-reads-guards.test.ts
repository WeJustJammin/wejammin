import { ApiErrorSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Hono } from 'hono';

import { registerCmsTaxonomyDefinitionRoutes } from './taxonomy-definition-routes';
import { failure } from './taxonomy-definition-shared';
import {
  taxonomyDefinitionOrigin,
  taxonomySession,
} from './taxonomy-definition.test-support';
import {
  createReadsHarness,
  SELECTOR_PATH,
  SELECTOR_QUERY,
  TERMS_PATH,
} from './taxonomy-reads.test-support';

/** Guard branches of the two term-store reads: the session, the identity, the deadline and the port envelope. */
afterEach(() => {
  vi.useRealTimers();
});

const paths = [
  ['cmsTaxonomyTermsRead', TERMS_PATH],
  ['CMS-03C-17', `${SELECTOR_PATH}?${SELECTOR_QUERY}`],
] as const;

describe.each(paths)('%s guards', (_id, path) => {
  it('an invalid session envelope is a retryable 502 and the port is never called', async () => {
    const h = createReadsHarness({ resolveSession: async () => 'x' as never });
    expect((await h.request(path)).status).toBe(502);
    expect(h.readTerms).not.toHaveBeenCalled();
    expect(h.readSelector).not.toHaveBeenCalled();
  });

  it('a session refusal is relayed', async () => {
    const h = createReadsHarness({
      resolveSession: async () => failure(401, {}, undefined),
    });
    const reply = await h.request(path);
    expect(reply.status).toBe(401);
    expect(ApiErrorSchema.parse(await reply.json()).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('a malformed human identity is a 401', async () => {
    const h = createReadsHarness({
      resolveSession: async () => ({
        ok: true,
        value: { ...taxonomySession, userId: '' },
      }),
    });
    expect((await h.request(path)).status).toBe(401);
    expect(h.rateLimit).not.toHaveBeenCalled();
  });

  it('a port that answers a malformed envelope is a retryable 502', async () => {
    const h = createReadsHarness({
      readTerms: async () => 'x' as never,
      readSelector: async () => 'x' as never,
    });
    expect((await h.request(path)).status).toBe(502);
  });

  it.each([1, 2])(
    'a deadline that fires during quota bucket %i stops before the port (504)',
    async (slow) => {
      vi.useFakeTimers();
      let calls = 0;
      const h = createReadsHarness({
        deadlineMs: 5,
        rateLimit: async (input) => {
          if (++calls === slow) await new Promise((r) => setTimeout(r, 20));
          return {
            ok: true,
            value: {
              allowed: true,
              limit: input.limit,
              remaining: 1,
              resetAt: 60,
            },
          };
        },
      });
      const pending = h.request(path);
      await vi.advanceTimersByTimeAsync(30);
      expect((await pending).status).toBe(504);
      expect(h.readTerms).not.toHaveBeenCalled();
      expect(h.readSelector).not.toHaveBeenCalled();
    },
  );
});

describe.each(paths)('%s quota dependency faults', (_id, path) => {
  it('an invalid limiter envelope is a 502, a limiter refusal is relayed, a wrong ceiling is a 502', async () => {
    const garbage = createReadsHarness({ rateLimit: async () => 'x' as never });
    expect((await garbage.request(path)).status).toBe(502);
    const refused = createReadsHarness({
      rateLimit: async () => failure(503, {}, 5),
    });
    expect((await refused.request(path)).status).toBe(503);
    const wrong = createReadsHarness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: true, limit: 1, remaining: 0, resetAt: 60 },
      }),
    });
    expect((await wrong.request(path)).status).toBe(502);
    expect(garbage.readTerms).not.toHaveBeenCalled();
    expect(refused.readSelector).not.toHaveBeenCalled();
  });
});

describe('preflight of the term-store reads', () => {
  it('the write path preflight advertises POST and the write headers; a preflight without request id gets one', async () => {
    const h = createReadsHarness();
    const app = new Hono();
    registerCmsTaxonomyDefinitionRoutes(app, h.dependencies);
    const reply = await app.request('/api/v1/cms/taxonomies/versions', {
      method: 'OPTIONS',
      headers: { origin: taxonomyDefinitionOrigin },
    });
    expect(reply.status).toBe(204);
    expect(reply.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(reply.headers.get('access-control-allow-headers')).toContain(
      'Idempotency-Key',
    );
    expect(reply.headers.get('x-request-id')).not.toBeNull();
  });

  it.each(paths)('%s refuses a foreign origin', async (_id, path) => {
    const h = createReadsHarness();
    const reply = await h.request(path, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.test' },
    });
    expect(reply.status).toBe(403);
    expect(reply.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('the terms preflight refuses a malformed vocabulary id', async () => {
    const h = createReadsHarness();
    const reply = await h.request('/api/v1/cms/taxonomies/nope/terms', {
      method: 'OPTIONS',
    });
    expect(reply.status).toBe(400);
  });
});
