import { describe, expect, it, vi } from 'vitest';

import { forwardCmsLocaleVariantMutation } from './cms-composition-platform-locale';

const origin = 'https://app.example.test';
const entryId = 'd1000000-0000-4000-8000-000000000001';
const sourceRevisionId = 'd1000000-0000-4000-8000-000000000002';
const fieldId = 'd1000000-0000-4000-8000-000000000005';
const body = {
  entryId,
  locale: 'fr-FR',
  sourceRevisionId,
  fields: [{ fieldId, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: 'a'.repeat(64),
  expectedVersion: '1',
};
const request = () =>
  new Request(
    `${origin}/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`,
    {
      method: 'POST',
      headers: {
        origin,
        cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
        'x-csrf-token': 'csrf-token-123',
        'content-type': 'application/json',
        'idempotency-key': 'locale-command-0001',
        'if-match': '"1"',
      },
      body: JSON.stringify(body),
    },
  );

describe('CMS-03C-04 first-party locale authoring proxy: the 33rd locale (D12)', () => {
  it('[P2-S12-AC-236] relays locale_limit_reached on the 409 of a 33rd locale variant and on no other status or token', async () => {
    // BE03c 392, 1530: the Worker keeps `reasonCode: locale_limit_reached` beside the versions, and
    // CmsLocaleVariantForm renders its fixed copy; a proxy that drops it leaves the author a generic conflict.
    const respond = async (
      status: 400 | 403 | 404 | 409 | 422,
      code: string,
      details: Record<string, unknown>,
    ) => {
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code,
              message: 'private provider text',
              requestId: 'd1000000-0000-4000-8000-000000000006',
              details,
            }),
            { status, headers: { 'content-type': 'application/json' } },
          ),
      );
      const response = await forwardCmsLocaleVariantMutation(
        request(),
        entryId,
        'fr-FR',
        { fetch },
      );
      expect(response.status).toBe(status);
      return ((await response.json()) as { details: unknown }).details;
    };
    expect(
      await respond(409, 'LOCALE_VERSION_CONFLICT', {
        reasonCode: 'locale_limit_reached',
        expectedVersion: '3',
        secret: 'do-not-disclose',
      }),
    ).toEqual({ reasonCode: 'locale_limit_reached', expectedVersion: '3' });
    expect(
      await respond(409, 'LOCALE_VERSION_CONFLICT', {
        reasonCode: 'locale_limit_exceeded',
      }),
    ).toEqual({});
    expect(
      await respond(409, 'LOCALE_VERSION_CONFLICT', {
        reasonCode: 'locale_limit_reached',
        activeFallbackChain: ['en-US'],
      }),
    ).toEqual({ reasonCode: 'locale_limit_reached' });
    for (const [status, code] of [
      [400, 'INVALID_REQUEST'],
      [403, 'LOCALE_FORBIDDEN'],
      [404, 'LOCALE_SOURCE_NOT_FOUND'],
      [422, 'LOCALE_VALIDATION_FAILED'],
    ] as const)
      expect(
        await respond(status, code, { reasonCode: 'locale_limit_reached' }),
      ).not.toHaveProperty('reasonCode');
  });
});
