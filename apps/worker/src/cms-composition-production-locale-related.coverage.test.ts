import {
  CMS_SLICE_11_CONFLICT_REASONS,
  CMS_SLICE_11_FORBIDDEN_REASONS,
  CMS_SLICE_11_VALIDATION_REASONS,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import {
  readAs as relatedReadAs,
  readInput as relatedReadInput,
} from './cms-composition-production-related-read.test-support';
import {
  act as relatedAct,
  json as relatedJson,
  portInput as relatedPortInput,
  raised as relatedRaised,
  resource as relatedResource,
} from './cms-composition-production-related.test-support';
import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import {
  authority,
  localeReadInput,
  OTHER_PARTY,
  OTHER_USER,
  signal,
  throwingResponse,
} from './cms-composition-production-locale-related.coverage.test-support';
import {
  READ_PATH,
  translatedRead,
} from './cms-composition/locale-read.test-support';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

/*
 * BE03c admission: the Worker pins the server-resolved identity, so a port input that claims another user or
 * party than the one `resolveSession` bound to that very request is a 401 before any transport (never an RPC with a
 * forged context). A response whose accessors throw is a provider fault: a 503 dependency failure with the scrubbed
 * catalog body, never a leak of the thrown message.
 */

describe('pinned server identity (cmsLocaleVariantRead, cmsRelatedContentRead, CMS-03C-05)', () => {
  const claims = [
    ['another user', { userId: OTHER_USER, actingPartyId: PARTY_ID }],
    ['another acting party', { userId: USER_ID, actingPartyId: OTHER_PARTY }],
  ] as const;

  it.each(claims)(
    'cmsLocaleVariantRead refuses an input claiming %s with a 401 and no RPC',
    async (_label, claim) => {
      const fetchImpl = vi.fn(async () => relatedJson(translatedRead()));
      const dependencies = createProductionCmsLocaleDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
        ...authority,
      });
      const request = new Request(`https://api.example.test${READ_PATH}`);
      expect((await dependencies.resolveSession(request, signal())).ok).toBe(
        true,
      );
      const base = localeReadInput(request);
      const result = await dependencies.readLocaleVariant(
        { ...base, session: { ...base.session, ...claim } },
        signal(),
      );
      expect(result).toMatchObject({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(claims)(
    'cmsRelatedContentRead refuses an input claiming %s with a 401 and no RPC',
    async (_label, claim) => {
      const fetchImpl = vi.fn(async () => relatedJson({ rule: null }));
      const dependencies = createProductionCmsRelatedContentDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
        ...authority,
      });
      const base = relatedReadInput();
      expect(
        (await dependencies.resolveSession(base.request, signal())).ok,
      ).toBe(true);
      const result = await dependencies.readRelatedContent(
        { ...base, session: { ...base.session, ...claim } },
        signal(),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(claims)(
    'CMS-03C-05 refuses an input claiming %s with a 401 and no RPC',
    async (_label, claim) => {
      const fetchImpl = vi.fn(async () => relatedJson(relatedResource));
      const dependencies = createProductionCmsRelatedContentDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
        ...authority,
      });
      const base = relatedPortInput();
      expect(
        (await dependencies.resolveSession(base.request, signal())).ok,
      ).toBe(true);
      const result = await dependencies.actRelatedContent(
        { ...base, session: { ...base.session, ...claim } },
        signal(),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('provider faults that throw while the answer is read', () => {
  it('cmsLocaleVariantRead answers a scrubbed 503 and never the thrown message', async () => {
    const dependencies = createProductionCmsLocaleDependencies({
      environment,
      fetchImpl: (async () => throwingResponse()) as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
      resolveSession: async () => ({
        ok: true,
        value: localeReadInput(new Request('https://api.example.test/'))
          .session,
      }),
    });
    const result = await dependencies.readLocaleVariant(
      localeReadInput(new Request(`https://api.example.test${READ_PATH}`)),
      signal(),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('provider private');
  });

  it('cmsRelatedContentRead answers a scrubbed 503 and never the thrown message', async () => {
    const result = await relatedReadAs((async () =>
      throwingResponse()) as typeof fetch);
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('provider private');
  });

  it('CMS-03C-05 answers a scrubbed 503 and never the thrown message', async () => {
    const result = await relatedAct((async () =>
      throwingResponse()) as typeof fetch);
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('provider private');
  });
});

describe('CMS-03C-04 conflict answers that are not a product payload', () => {
  it.each([
    ['null', null],
    ['a string', 'conflict'],
    ['an array', [409]],
  ])(
    'scrubs a 409 whose body is %s into a 500 with no chain detail',
    async (_label, payload) => {
      const result = await createProductionCmsLocaleDependencies({
        environment,
        fetchImpl: (async () => relatedJson(payload, 409)) as typeof fetch,
        resolveSession: async () => ({
          ok: true,
          value: localeReadInput(new Request('https://api.example.test/'))
            .session,
        }),
      }).authorLocale(
        {
          operationId: 'CMS-03C-04',
          request: new Request('https://api.example.test/x'),
          requestId: REQUEST_ID,
          session: localeReadInput(new Request('https://api.example.test/'))
            .session,
          path: {
            entryId: 'd2000000-0000-4000-8000-000000000001',
            locale: 'fr-FR',
          },
          body: {
            entryId: 'd2000000-0000-4000-8000-000000000001',
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
        },
        signal(),
      );
      expect(result).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result)).not.toContain('activeFallbackChain');
    },
  );
});

describe('CMS-03C-05 serialization CAS refusal', () => {
  it.each(['VERSION_MISMATCH', 'STALE_EDIT_PRESENCE'])(
    'maps a 40001 whose whole message is the CAS token %s to a 409 conflict, never a 503',
    async (token) => {
      const result = await relatedAct((async () =>
        relatedJson(
          {
            code: '40001',
            message: token,
            details: '{"expectedVersion":"1","currentVersion":"3"}',
            hint: null,
          },
          409,
        )) as typeof fetch);
      expect(result).toMatchObject({ ok: false, status: 409 });
    },
  );

  it('treats an engine 40001 serialization failure as a scrubbed 500', async () => {
    const result = await relatedAct((async () =>
      relatedRaised(
        'could not serialize access',
        null,
        400,
        '40001',
      )) as typeof fetch);
    expect(result).toMatchObject({ ok: false, status: 500 });
  });
});

describe('related-content production configuration', () => {
  it.each([
    ['deadlineMs below 1', { deadlineMs: 0 }],
    ['deadlineMs above the default', { deadlineMs: 15_001 }],
    ['fractional deadlineMs', { deadlineMs: 1.5 }],
    ['maxResponseBytes below 1', { maxResponseBytes: 0 }],
    ['fractional maxResponseBytes', { maxResponseBytes: 1.5 }],
  ])('rejects %s', (_label, overrides) => {
    expect(() =>
      createProductionCmsRelatedContentDependencies({
        environment,
        fetchImpl: vi.fn() as typeof fetch,
        ...overrides,
      }),
    ).toThrow('Invalid CMS related-content production configuration.');
  });
});

/*
 * BE03c 1298-1302: a reason another editorial domain generates is not in this operation's catalog, so it is a contract
 * failure answered as the scrubbed 500 - never the 403, 409 or 422 (with that foreign reason) its token maps to.
 */
describe('related-content refuses a foreign editorial reason', () => {
  const foreign = [
    ['Slice 11 forbidden', CMS_SLICE_11_FORBIDDEN_REASONS[1]],
    ['Slice 11 conflict', CMS_SLICE_11_CONFLICT_REASONS[0]!],
    ['Slice 11 validation', CMS_SLICE_11_VALIDATION_REASONS[0]!],
  ] as const;

  it.each(foreign)(
    'CMS-03C-05 scrubs a %s reason into a 500',
    async (_label, reason) => {
      const result = await relatedAct((async () =>
        relatedRaised(reason)) as typeof fetch);
      expect(result).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result)).not.toContain(reason);
    },
  );

  it.each(foreign)(
    'cmsRelatedContentRead scrubs a %s reason into a 500',
    async (_label, reason) => {
      const result = await relatedReadAs((async () =>
        relatedRaised(reason)) as typeof fetch);
      expect(result).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result)).not.toContain(reason);
    },
  );
});
