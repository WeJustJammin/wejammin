import { ApiErrorSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  entryId,
  fieldId,
  noFallbackFieldId,
  readDeps,
  readRequest,
  resolution,
  translatedRead,
  untranslatedRead,
} from './locale-read.test-support';
import {
  createCmsLocaleApp,
  type CmsLocaleError,
  type CmsLocaleReadInput,
} from './locale-routes';
import { resource } from './locale-routes.test-support';

type Port = (input: CmsLocaleReadInput, signal: AbortSignal) => Promise<never>;

const failing = (
  status: CmsLocaleError['status'],
  details?: Record<string, unknown>,
): Port =>
  (async () => ({
    ok: false,
    status,
    code: 'ANY',
    message: 'private provider text',
    ...(details === undefined ? {} : { details }),
  })) as unknown as Port;

describe('cmsLocaleVariantRead port refusals (BE03c error matrix and catalog cms.03c.locale.v1)', () => {
  const mapped: ReadonlyArray<
    [
      number,
      string,
      Record<string, unknown> | undefined,
      Record<string, unknown>,
    ]
  > = [
    [400, 'INVALID_REQUEST', undefined, {}],
    [401, 'UNAUTHENTICATED', undefined, { recoveryAction: 'reauthenticate' }],
    [
      403,
      'LOCALE_FORBIDDEN',
      { reasonCode: 'capability_missing' },
      { reasonCode: 'capability_missing' },
    ],
    [404, 'LOCALE_SOURCE_NOT_FOUND', { leaked: 'private entry title' }, {}],
    [500, 'INTERNAL_ERROR', { cause: 'sql' }, {}],
  ];
  for (const [status, code, source, details] of mapped)
    it(`relays ${status} as ${code} with bounded details`, async () => {
      const response = await createCmsLocaleApp(
        readDeps({ readLocaleVariant: failing(status as never, source) }),
      ).request(readRequest());
      expect(response.status).toBe(status);
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe(code);
      expect(error.message).toBe(
        `${code}: locale operation rejected or unavailable.`,
      );
      expect(error.details).toEqual(details);
    });

  it('drops a 403 token the read may not publish, and any other member', async () => {
    for (const source of [
      { reasonCode: 'locale_limit_reached' },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH' },
      { reasonCode: 'CAPABILITY_REQUIRED' },
      { reasonCode: 'capability_missing', policy: 'secret' },
      undefined,
    ]) {
      const response = await createCmsLocaleApp(
        readDeps({ readLocaleVariant: failing(403, source) }),
      ).request(readRequest());
      const details = ApiErrorSchema.parse(await response.json()).details;
      expect(JSON.stringify(details), JSON.stringify(source)).toBe(
        source?.reasonCode === 'capability_missing'
          ? '{"reasonCode":"capability_missing"}'
          : '{}',
      );
    }
  });

  it('folds a 409 or 422 from the port (not declared for a bounded read) into a scrubbed 500', async () => {
    for (const status of [409, 422] as const) {
      const response = await createCmsLocaleApp(
        readDeps({
          readLocaleVariant: failing(status, {
            currentVersion: '9',
            reasonCode: 'FALLBACK_CHAIN_MISMATCH',
            activeFallbackChain: ['en-US'],
          }),
        }),
      ).request(readRequest());
      expect(response.status, String(status)).toBe(500);
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.details).toEqual({});
    }
  });

  it('relays dependency statuses with the retry hint and Retry-After', async () => {
    for (const status of [502, 503, 504] as const) {
      const response = await createCmsLocaleApp(
        readDeps({ readLocaleVariant: failing(status) }),
      ).request(readRequest());
      expect(response.status).toBe(status);
      expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
    }
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: (async () => ({
          ok: false,
          status: 503,
          code: 'X',
          message: 'm',
          retryAfterSeconds: 15,
        })) as unknown as Port,
      }),
    ).request(readRequest());
    expect(response.headers.get('retry-after')).toBe('15');
  });

  it('is 503 when the port throws and 502 when it breaks the envelope', async () => {
    const thrown = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: async () => {
          throw new Error('socket');
        },
      }),
    ).request(readRequest());
    expect(thrown.status).toBe(503);
    expect(thrown.headers.get('retry-after')).toBe('15');
    const broken = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: (async () => ({ ok: true })) as unknown as Port,
      }),
    ).request(readRequest());
    expect(broken.status).toBe(502);
  });
});

describe('cmsLocaleVariantRead response contract', () => {
  const other = '20000000-0000-4000-8000-000000000002';
  const answers: ReadonlyArray<[string, unknown]> = [
    ['a bare variant resource instead of the read', resource],
    ['an empty object', {}],
    ['an extra member beside the five', { ...translatedRead(), etag: '"2"' }],
    [
      'a variant of another entry',
      translatedRead({ variant: { ...resource, entryId: other } }),
    ],
    ['the answer for another locale', translatedRead({ locale: 'de-DE' })],
    [
      'a variant claiming the untranslated state',
      translatedRead({ variant: { ...resource, state: 'untranslated' } }),
    ],
    [
      'a variant of another locale',
      translatedRead({ variant: { ...resource, locale: 'de-DE' } }),
    ],
    [
      'stored values with no variant',
      { ...untranslatedRead(), fields: [{ fieldId, value: 'x' }] },
    ],
    [
      'a duplicated stored field',
      translatedRead({
        fields: [
          { fieldId, value: 'a' },
          { fieldId, value: 'b' },
        ],
      }),
    ],
    [
      'a duplicated resolution',
      translatedRead({
        resolutions: [resolution(fieldId), resolution(fieldId)],
      }),
    ],
    [
      'a resolution of another locale',
      translatedRead({
        resolutions: [resolution(fieldId, { locale: 'de-DE' })],
      }),
    ],
    [
      'a no_fallback field resolved through the chain',
      translatedRead({
        resolutions: [
          resolution(noFallbackFieldId, {
            mode: 'no_fallback',
            provenance: 'localized_fallback',
            resolvedFromLocale: 'en-US',
          }),
        ],
      }),
    ],
    [
      'a resolution with private members',
      translatedRead({
        resolutions: [
          { ...resolution(fieldId), text: 'Source title' } as never,
        ],
      }),
    ],
    [
      'a variant with private members',
      translatedRead({ variant: { ...resource, ownerId: entryId } as never }),
    ],
    [
      'more than sixteen fallback locales',
      translatedRead({
        activeFallbackChain: Array.from(
          { length: 17 },
          (_, i) => `ab-c${'abcdefghijklmnopq'[i]}`,
        ),
      }),
    ],
  ];
  for (const [name, value] of answers)
    it(`is 502 for ${name}`, async () => {
      const response = await createCmsLocaleApp(
        readDeps({
          readLocaleVariant: (async () => ({
            ok: true,
            value,
          })) as unknown as Port,
        }),
      ).request(readRequest());
      expect(response.status).toBe(502);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'DEPENDENCY_UNAVAILABLE',
      );
    });

  it('compares the entry and locale case-insensitively', async () => {
    const response = await createCmsLocaleApp(
      readDeps({
        readLocaleVariant: async () => ({
          ok: true,
          value: translatedRead({
            locale: 'FR-fr',
            variant: { ...resource, entryId: entryId.toUpperCase() },
            resolutions: [resolution(fieldId, { locale: 'FR-FR' })],
          }),
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(200);
  });
});

describe('cmsLocaleVariantRead deadline', () => {
  it('aborts the port and answers 504 at 8,000 ms (the Tier 1 read ceiling)', async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const response = createCmsLocaleApp(
        readDeps({
          readLocaleVariant: (_input, signal) =>
            new Promise(() =>
              signal.addEventListener('abort', () => {
                aborted = true;
              }),
            ),
        }),
      ).request(readRequest());
      await vi.advanceTimersByTimeAsync(7_999);
      expect(aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((await response).status).toBe(504);
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
