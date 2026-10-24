import { ApiErrorSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  entryId,
  READ_PATH,
  readDeps,
  readRequest,
  translatedRead,
} from './locale-read.test-support';
import { createCmsLocaleApp } from './locale-routes';

const spies = () => {
  const read = vi.fn(async () => ({
    ok: true as const,
    value: translatedRead(),
  }));
  const base = readDeps();
  return {
    read,
    rateLimit: vi.fn(base.rateLimit),
    resolveSession: vi.fn(base.resolveSession),
  };
};

describe('cmsLocaleVariantRead admission order (BE00)', () => {
  const cases: ReadonlyArray<[string, () => Request, number, string]> = [
    [
      'a foreign origin',
      () => readRequest({ origin: 'https://evil.example.test' }),
      403,
      'LOCALE_FORBIDDEN',
    ],
    [
      'a request media type on a read',
      () => readRequest({ 'content-type': 'application/json' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
  ];
  for (const [name, build, status, code] of cases)
    it(`${name} is ${status} before the session and the quota`, async () => {
      const { read, rateLimit, resolveSession } = spies();
      const response = await createCmsLocaleApp(
        readDeps({ readLocaleVariant: read, rateLimit, resolveSession }),
      ).request(build());
      expect(response.status).toBe(status);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(code);
      expect(resolveSession).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    });

  it('names an empty media allowlist on 415: a read accepts no request media', async () => {
    const response = await createCmsLocaleApp(readDeps()).request(
      readRequest({ 'content-type': 'text/plain' }),
    );
    expect(response.status).toBe(415);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
      allowedMediaTypes: [],
    });
  });

  it('answers 401 for a missing session before it validates the path', async () => {
    const { read, rateLimit } = spies();
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: read,
        rateLimit,
        resolveSession: async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'no session',
        }),
      }),
    ).request(readRequest({}, '/api/v1/cms/entries/not-a-uuid/locales/fr_FR'));
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
      () => readRequest({}, '/api/v1/cms/entries/x/locales/fr-FR'),
    ],
    [
      'a malformed locale tag',
      () => readRequest({}, `/api/v1/cms/entries/${entryId}/locales/fr_FR`),
    ],
    [
      'a one-letter locale tag',
      () => readRequest({}, `/api/v1/cms/entries/${entryId}/locales/f`),
    ],
    ['a query string', () => readRequest({}, `${READ_PATH}?limit=1`)],
    ['an empty query marker', () => readRequest({}, `${READ_PATH}?`)],
    [
      'an Idempotency-Key header',
      () => readRequest({ 'idempotency-key': 'locale-read-0001' }),
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
      const response = await createCmsLocaleApp(
        readDeps({ readLocaleVariant: read, rateLimit }),
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
      const response = await createCmsLocaleApp(
        readDeps({
          readLocaleVariant: read,
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
        code: 'LOCALE_FORBIDDEN',
        details: { reasonCode: 'capability_missing' },
      });
    }
    expect(rateLimit).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('admits an editor-only session', async () => {
    const { read } = spies();
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: read,
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
    const thrown = await createCmsLocaleApp(
      readDeps({
        resolveSession: async () => {
          throw new Error('boom');
        },
      }),
    ).request(readRequest());
    expect(thrown.status).toBe(503);
    expect(thrown.headers.get('retry-after')).toBe('15');
    const malformedEnvelope = await createCmsLocaleApp(
      readDeps({
        resolveSession: async () => ({ nope: true }) as never,
      }),
    ).request(readRequest());
    expect(malformedEnvelope.status).toBe(502);
  });
});
