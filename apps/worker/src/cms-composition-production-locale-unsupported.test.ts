import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import type { CmsLocalePortInput } from './cms-composition/locale-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

// AC-055 (owner decision DEC-230): a locale outside the active content-type version's supportedLocales is 422
// LOCALE_VALIDATION_FAILED on the CMS-03C-04 write, never the 404 of a hidden entry. The database raises exactly
// `P0001 VALIDATION_FAILED` with no detail for it (cms_author_locale_variant, 20261014050200 line 158, asserted by
// supabase/tests/phase_02_slice_12_locale_config_enforcement.sql), so this test feeds that real token form.

const entryId = 'd2000000-0000-4000-8000-000000000011';
const sourceRevisionId = 'd2000000-0000-4000-8000-000000000012';
const fieldId = 'd2000000-0000-4000-8000-000000000015';
const input = (): CmsLocalePortInput => ({
  operationId: 'CMS-03C-04',
  request: new Request(
    `https://api.example.test/api/v1/cms/entries/${entryId}/locales/es-ES/variants`,
    { headers: { 'x-correlation-id': REQUEST_ID } },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId, locale: 'es-ES' },
  body: {
    entryId,
    locale: 'es-ES',
    sourceRevisionId,
    fields: [{ fieldId, value: 'Título traducido' }],
    fallbackChain: ['en-US'],
    noFallbackFieldIds: [],
    sourceHash: 'a'.repeat(64),
    expectedVersion: '1',
  },
  idempotencyKey: 'locale-unsupported-0001',
  ifMatch: '1',
});
const create = (fetchImpl: typeof fetch) =>
  createProductionCmsLocaleDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  });

describe('CMS-03C-04 unsupported locale on the write [P2-S12-AC-055]', () => {
  it('maps the bare database VALIDATION_FAILED of a locale outside supportedLocales to 422 LOCALE_VALIDATION_FAILED, not a 404', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ code: 'P0001', message: 'VALIDATION_FAILED' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const result = await create(fetchImpl as typeof fetch).authorLocale(
      input(),
      new AbortController().signal,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'LOCALE_VALIDATION_FAILED',
    });
    expect(result).not.toMatchObject({ status: 404 });
  });
});
