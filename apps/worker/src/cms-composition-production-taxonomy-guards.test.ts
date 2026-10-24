import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACT_PATH,
  ACT_REQUEST_ID,
  ACT_TAXONOMY_ID,
  actBody,
  createActHarness,
} from './cms-composition-production-taxonomy-act.test-support';
import {
  createTaxonomyProductionHarness,
  taxonomyDefinitionId,
  taxonomySession,
} from './cms-composition/taxonomy-definition.test-support';
import {
  SELECTOR_PATH,
  TERMS_PATH,
} from './cms-composition/taxonomy-reads.test-support';
import type { CmsTaxonomyPortInput } from './cms-composition/taxonomy-contracts';

/** The ports repeat the strict transport contract themselves: a hand-built input never reaches the database. */
afterEach(() => vi.restoreAllMocks());

const get = (path: string, init: RequestInit = {}) =>
  new Request(`https://api.example.test${path}`, {
    headers: { 'x-request-id': ACT_REQUEST_ID },
    ...init,
  });
const base = (request: Request) => ({
  request,
  requestId: ACT_REQUEST_ID,
  session: taxonomySession,
});
const signal = () => new AbortController().signal;

describe('production term-store readers: defensive contract', () => {
  it.each([
    ['a POST', get(TERMS_PATH, { method: 'POST', body: '{}' })],
    ['another path', get('/api/v1/cms/taxonomies/x/terms')],
    ['an If-Match header', get(TERMS_PATH, { headers: { 'if-match': '"1"' } })],
    [
      'a content-length',
      get(TERMS_PATH, { headers: { 'content-length': '2' } }),
    ],
  ])(
    'readTerms refuses %s with a bare 400 and no network',
    async (_n, request) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const h = createTaxonomyProductionHarness(fetchImpl);
      expect(
        await h.dependencies.readTerms(
          {
            ...base(request),
            operationId: 'cmsTaxonomyTermsRead',
            taxonomyId: taxonomyDefinitionId,
            query: { limit: 25 },
          },
          signal(),
        ),
      ).toMatchObject({ ok: false, status: 400 });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('readTerms refuses a non-lineage id and a foreign operation id', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createTaxonomyProductionHarness(fetchImpl);
    for (const input of [
      { taxonomyId: 'nope', operationId: 'cmsTaxonomyTermsRead' },
      { taxonomyId: taxonomyDefinitionId, operationId: 'CMS-03C-17' },
    ])
      expect(
        await h.dependencies.readTerms(
          {
            ...base(get(TERMS_PATH)),
            query: { limit: 25 },
            ...input,
          } as never,
          signal(),
        ),
      ).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['a POST', get(SELECTOR_PATH, { method: 'POST', body: '{}' })],
    ['another path', get('/api/v1/cms/taxonomies/other')],
  ])(
    'readSelector refuses %s with a bare 400 and no network',
    async (_n, request) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const h = createTaxonomyProductionHarness(fetchImpl);
      expect(
        await h.dependencies.readSelector(
          {
            ...base(request),
            operationId: 'CMS-03C-17',
            query: {
              typeKey: 'article',
              fieldKey: 'f1',
              locale: 'en',
              limit: 50,
            },
          },
          signal(),
        ),
      ).toMatchObject({ ok: false, status: 400 });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('readSelector refuses a foreign operation id', async () => {
    const h = createTaxonomyProductionHarness(vi.fn<typeof fetch>());
    expect(
      await h.dependencies.readSelector(
        {
          ...base(get(SELECTOR_PATH)),
          operationId: 'cmsTaxonomyTermsRead',
          query: {
            typeKey: 'article',
            fieldKey: 'f1',
            locale: 'en',
            limit: 50,
          },
        } as never,
        signal(),
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });
});

describe('production term action port: defensive contract', () => {
  const input = (
    overrides: Partial<CmsTaxonomyPortInput> = {},
    request?: Request,
  ): CmsTaxonomyPortInput => ({
    operationId: 'CMS-03C-03',
    request:
      request ??
      new Request(`https://api.example.test${ACT_PATH}`, {
        method: 'POST',
        headers: {
          'idempotency-key': 'taxonomy-action-0001',
          'if-match': '"7"',
          'x-request-id': ACT_REQUEST_ID,
        },
      }),
    requestId: ACT_REQUEST_ID,
    session: {
      userId: taxonomySession.userId,
      actingPartyId: taxonomySession.actingPartyId,
      capabilities: ['cms.taxonomy_curator'],
      mfaFresh: false,
    },
    path: { taxonomyId: ACT_TAXONOMY_ID },
    body: actBody(),
    idempotencyKey: 'taxonomy-action-0001',
    ifMatch: '7',
    ...overrides,
  });

  it('a session without the curator capability is a 403 capability_missing before any network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createActHarness(fetchImpl);
    expect(
      await h.dependencies.actTerm(
        input({
          session: {
            userId: taxonomySession.userId,
            actingPartyId: taxonomySession.actingPartyId,
            capabilities: ['cms.editor'],
            mfaFresh: false,
          },
        }),
        signal(),
      ),
    ).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['another operation id', { operationId: 'CMS-03C-16' as never }],
    [
      'a body for another vocabulary',
      { body: actBody({ taxonomyId: taxonomySession.userId }) },
    ],
    ['an operand the headers do not repeat', { ifMatch: '8' }],
  ])('%s is a bare 400', async (_n, overrides) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createActHarness(fetchImpl);
    expect(
      await h.dependencies.actTerm(input(overrides), signal()),
    ).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
