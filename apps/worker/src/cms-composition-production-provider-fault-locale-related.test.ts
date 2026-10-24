import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import { PROVIDER_FAULTS } from './cms-composition-production-provider-fault.test-support';
import {
  act as relatedAct,
  json,
} from './cms-composition-production-related.test-support';
import type { CmsLocalePortInput } from './cms-composition/locale-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

/**
 * BE03c 1298-1302 (provider fault is a contract failure, scrubbed INTERNAL_ERROR 500) for the
 * locale (CMS-03C-04) and related-content (CMS-03C-05) adapters; BE00 172 (a 502/503/504 is
 * `DEPENDENCY_UNAVAILABLE` with `retryable: true`). The same fault table as the template and
 * pattern adapters (`cms-composition-production-provider-fault.test.ts`).
 */
const entryId = 'd2000000-0000-4000-8000-000000000001';
const localeInput = (): CmsLocalePortInput => ({
  operationId: 'CMS-03C-04',
  request: new Request(
    `https://api.example.test/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`,
    { headers: { 'x-correlation-id': REQUEST_ID } },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId, locale: 'fr-FR' },
  body: {
    entryId,
    locale: 'fr-FR',
    sourceRevisionId: 'd2000000-0000-4000-8000-000000000002',
    fields: [
      {
        fieldId: 'd2000000-0000-4000-8000-000000000005',
        value: 'Titre traduit',
      },
    ],
    fallbackChain: ['en-US'],
    noFallbackFieldIds: [],
    sourceHash: 'a'.repeat(64),
    expectedVersion: '1',
  },
  idempotencyKey: 'locale-command-0001',
  ifMatch: '1',
});
const localeAct = (fetchImpl: typeof fetch) =>
  createProductionCmsLocaleDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: localeInput().session }),
  }).authorLocale(localeInput(), new AbortController().signal);

const ADAPTERS = [
  { name: 'CMS-03C-04 author locale variant', call: localeAct },
  {
    name: 'CMS-03C-05 curate related content',
    call: (fetchImpl: typeof fetch) => relatedAct(fetchImpl),
  },
] as const;

describe.each(ADAPTERS)('$name: provider faults', ({ call }) => {
  it.each(PROVIDER_FAULTS)(
    'scrubs %s to 500 INTERNAL_ERROR',
    async (_name, status, payload) => {
      const fetchImpl = vi.fn(async () => json(payload, status));
      const result = await call(fetchImpl as typeof fetch);
      expect(result).toMatchObject({
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
      });
      expect(JSON.stringify(result)).not.toMatch(
        /PGRST|42702|actor_id|JWT|slow down|private/u,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('does not let a faulting status borrow a refusal from the message prose', async () => {
    const result = await call(
      vi.fn(async () =>
        json(
          { code: 'PGRST202', message: 'NOT_FOUND capability_missing' },
          404,
        ),
      ) as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false, status: 500 });
  });

  it('keeps a provider outage a 503 DEPENDENCY_UNAVAILABLE', async () => {
    const result = await call(
      vi.fn(async () => json({ code: 'PGRST000' }, 503)) as typeof fetch,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });
});
