import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  createReadsHarness,
  SELECTOR_PATH,
  SELECTOR_QUERY,
  TERMS_PATH,
} from './taxonomy-reads.test-support';
import {
  TAXONOMY_RATES,
  TAXONOMY_RPC,
  type TaxonomyOperation,
} from './taxonomy-rpc-table';

/**
 * The Worker tables (`TAXONOMY_RPC`, `TAXONOMY_RATES`) and the live routes are pinned to the frozen registry rows:
 * method, path, deadline, rate class and both ceilings, CSRF, idempotency, If-Match and capability gate.
 */
const route = (operationId: string) => {
  const row = platformRegistrySet.routes.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (row === undefined) throw new Error(`registry row ${operationId} missing`);
  return row;
};

describe.each(Object.keys(TAXONOMY_RATES) as (keyof typeof TAXONOMY_RATES)[])(
  'rate table of %s matches its registry row',
  (operationId) => {
    const row = route(operationId);
    const rates = TAXONOMY_RATES[operationId];
    it('rate class, user and party ceilings and a 60-second window', () => {
      expect(rates.rateClass).toBe(row.rateClass);
      expect(rates.user).toBe(row.rateLimit);
      expect(rates.party).toBe(row.partyRateLimit);
      expect(row.rateWindowSeconds).toBe(60);
    });
  },
);

describe.each(Object.keys(TAXONOMY_RPC) as TaxonomyOperation[])(
  'transport table of %s matches its registry row',
  (operationId) => {
    const row = route(operationId);
    const spec = TAXONOMY_RPC[operationId];
    it('deadline, method and the write/read class', () => {
      expect(spec.deadlineMs).toBe(row.timeoutMs);
      expect(row.method === 'POST').toBe(spec.write);
      expect(row.idempotency === 'required' || row.idempotency === 'none').toBe(
        true,
      );
      expect(row.idempotency === 'required').toBe(spec.write);
      expect(row.csrf === 'required').toBe(spec.write);
    });
  },
);

describe('registry rows of the Worker-served taxonomy reads', () => {
  it('cmsTaxonomyTermsRead: curator, GET, no CSRF, no preconditions, 8,000 ms', () => {
    const row = route('cmsTaxonomyTermsRead');
    expect(row).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/taxonomies/{taxonomyId}/terms',
      capabilities: ['cms.taxonomy_curator'],
      csrf: 'none',
      idempotency: 'none',
      ifMatch: 'none',
      timeoutMs: 8_000,
      requestSchema: 'TaxonomyTermListApiRequestSchema',
      successSchema: 'TaxonomyTermListPageSchema',
    });
  });

  it('CMS-03C-17: author or editor (any of), GET, no CSRF, no preconditions, 8,000 ms', () => {
    const row = route('CMS-03C-17');
    expect(row).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/taxonomies/selector',
      capabilities: ['cms.author', 'cms.editor'],
      capabilityMode: 'any_of',
      csrf: 'none',
      idempotency: 'none',
      ifMatch: 'none',
      timeoutMs: 8_000,
      requestSchema: 'TaxonomySelectorApiRequestSchema',
      successSchema: 'TaxonomySelectorPageSchema',
    });
  });

  it('CMS-03C-03: curator, POST, CSRF, key and If-Match required, 60/120 per minute, 15,000 ms', () => {
    const row = route('CMS-03C-03');
    expect(row).toMatchObject({
      method: 'POST',
      path: '/api/v1/cms/taxonomies/{taxonomyId}/terms/actions',
      capabilities: ['cms.taxonomy_curator'],
      csrf: 'required',
      idempotency: 'required',
      ifMatch: 'required',
      rateClass: 'cms-taxonomy-write',
      rateLimit: 60,
      partyRateLimit: 120,
      rateWindowSeconds: 60,
      timeoutMs: 15_000,
      successSchema: 'TaxonomyTermResourceSchema',
    });
    expect(TAXONOMY_RPC['CMS-03C-03']).toMatchObject({
      rpc: 'cms_act_taxonomy_term',
      write: true,
      deadlineMs: 15_000,
    });
  });
});

describe('the live read routes answer on the registry paths and charge the registry classes', () => {
  it('terms read and selector', async () => {
    const h = createReadsHarness();
    await h.request(TERMS_PATH);
    await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
    const charged = h.rateLimit.mock.calls.map(
      ([input]) => input,
    ) as unknown as {
      operationId: string;
      rateClass: string;
      limit: number;
    }[];
    expect(charged.map((c) => [c.operationId, c.rateClass, c.limit])).toEqual([
      ['cmsTaxonomyTermsRead', 'cms-taxonomy-terms-read', 120],
      ['cmsTaxonomyTermsRead', 'cms-taxonomy-terms-read', 240],
      ['CMS-03C-17', 'cms-taxonomy-selector-read', 300],
      ['CMS-03C-17', 'cms-taxonomy-selector-read', 600],
    ]);
  });
});
