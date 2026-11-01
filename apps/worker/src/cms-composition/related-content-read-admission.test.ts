import { ApiErrorSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  PATH,
  readRequest,
  ruleRead,
} from './related-content-read.test-support';
import { createCmsRelatedContentApp } from './related-content-routes';
import { dependencies } from './related-content-routes.test-support';

const spies = () => {
  const read = vi.fn(async () => ({ ok: true as const, value: ruleRead() }));
  const rateLimit = vi.fn(dependencies().rateLimit);
  const resolveSession = vi.fn(dependencies().resolveSession);
  return { read, rateLimit, resolveSession };
};

describe('cmsRelatedContentRead admission order (BE00)', () => {
  const cases: ReadonlyArray<
    [string, () => Request, number, string, { session: boolean; rate: boolean }]
  > = [
    [
      'a foreign origin',
      () => readRequest({ origin: 'https://evil.example.test' }),
      403,
      'RELATED_CONTENT_FORBIDDEN',
      { session: false, rate: false },
    ],
    [
      'a request media type on a read',
      () => readRequest({ 'content-type': 'application/json' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      { session: false, rate: false },
    ],
  ];
  for (const [name, build, status, code, reached] of cases)
    it(`${name} is ${status} before the session${reached.session ? '' : ' and the quota'}`, async () => {
      const { read, rateLimit, resolveSession } = spies();
      const response = await createCmsRelatedContentApp(
        dependencies({ readRelatedContent: read, rateLimit, resolveSession }),
      ).request(build());
      expect(response.status).toBe(status);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(code);
      expect(resolveSession).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    });

  it('names an empty media allowlist on 415: a read accepts no request media', async () => {
    const response = await createCmsRelatedContentApp(dependencies()).request(
      readRequest({ 'content-type': 'text/plain' }),
    );
    expect(response.status).toBe(415);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
      allowedMediaTypes: [],
    });
  });

  it('answers 401 for a missing session before it validates the path', async () => {
    const { read, rateLimit } = spies();
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: read,
        rateLimit,
        resolveSession: async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'no session',
        }),
      }),
    ).request(
      readRequest({}, '/api/v1/cms/entries/not-a-uuid/related-content'),
    );
    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  const malformed: ReadonlyArray<[string, () => Request]> = [
    [
      'a non-UUID entry id',
      () => readRequest({}, '/api/v1/cms/entries/x/related-content'),
    ],
    ['a query string', () => readRequest({}, `${PATH}?limit=1`)],
    ['an empty query marker', () => readRequest({}, `${PATH}?`)],
    [
      'an Idempotency-Key header',
      () => readRequest({ 'idempotency-key': 'related-read-0001' }),
    ],
    ['an If-Match header', () => readRequest({ 'if-match': '"1"' })],
    [
      'a chunked transfer',
      () => readRequest({ 'transfer-encoding': 'chunked' }),
    ],
    ['a non-zero content length', () => readRequest({ 'content-length': '4' })],
  ];
  for (const [name, build] of malformed)
    it(`${name} is 400 and consumes no quota`, async () => {
      const { read, rateLimit } = spies();
      const response = await createCmsRelatedContentApp(
        dependencies({ readRelatedContent: read, rateLimit }),
      ).request(build());
      expect(response.status).toBe(400);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'INVALID_REQUEST',
      );
      expect(rateLimit).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    });

  it('is 403 capability_missing, before any quota, for a session with neither cms.author nor cms.editor', async () => {
    const { read, rateLimit } = spies();
    for (const [capabilities, actingPartyId] of [
      [[], '40000000-0000-4000-8000-000000000004'],
      [['cms.reviewer'], '40000000-0000-4000-8000-000000000004'],
      [['cms.author'], null],
    ] as const) {
      const response = await createCmsRelatedContentApp(
        dependencies({
          readRelatedContent: read,
          rateLimit,
          resolveSession: async () => ({
            ok: true,
            value: {
              userId: '10000000-0000-4000-8000-000000000001',
              actingPartyId,
              capabilities: [...capabilities],
              mfaFresh: true,
            },
          }),
        }),
      ).request(readRequest());
      expect(response.status).toBe(403);
      expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
        code: 'RELATED_CONTENT_FORBIDDEN',
        details: { reasonCode: 'capability_missing' },
      });
    }
    expect(rateLimit).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('admits an editor-only session', async () => {
    const { read } = spies();
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: read,
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: '10000000-0000-4000-8000-000000000001',
            actingPartyId: '40000000-0000-4000-8000-000000000004',
            capabilities: ['cms.editor'],
            mfaFresh: false,
          },
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(200);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('is 503 with Retry-After when the session resolver throws, and 502 for a malformed session envelope', async () => {
    const thrown = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => {
          throw new Error('boom');
        },
      }),
    ).request(readRequest());
    expect(thrown.status).toBe(503);
    expect(thrown.headers.get('retry-after')).toBe('15');
    const malformedEnvelope = await createCmsRelatedContentApp(
      dependencies({
        resolveSession: async () => ({ nope: true }) as never,
      }),
    ).request(readRequest());
    expect(malformedEnvelope.status).toBe(502);
  });
});
