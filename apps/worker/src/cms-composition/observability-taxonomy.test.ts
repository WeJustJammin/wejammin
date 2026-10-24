import type { TaxonomyTermResource } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CompositionObservation } from './observability-observation';
import { metricKeyConforms } from './observability-registry';
import {
  createCmsTaxonomyApp,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
} from './taxonomy-routes';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] CMS-03C-03 counts the canonical taxonomy provider's outcomes from the refusal
 * it published (`canonical_overlap` is a match, `canonical_source_unavailable` an unbuilt domain) and lists the
 * stages the request really entered.
 */

const taxonomyId = 'd1200000-0000-4000-8000-000000000001';
const origin = 'https://cms.example.test';
const path = `/api/v1/cms/taxonomies/${taxonomyId}/terms/actions`;
const body = {
  taxonomyId,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: [],
  expectedVersion: '1',
} as const;
const resource: TaxonomyTermResource = {
  id: 'd1200000-0000-4000-8000-000000000002',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T04:00:00.000Z',
  updatedAt: '2026-09-28T04:00:00.000Z',
  lifecycle: 'active',
  taxonomyId,
  termId: 'd1200000-0000-4000-8000-000000000002',
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
};

const harness = (actTerm?: CmsTaxonomyDependencies['actTerm']) => {
  const telemetry = vi.fn<CmsTaxonomyDependencies['telemetry']>();
  const dependencies: CmsTaxonomyDependencies = {
    humanOrigins: [origin],
    now: () => 1_000,
    resolveSession: async () => ({
      ok: true,
      value: {
        userId: 'd1200000-0000-4000-8000-000000000003',
        actingPartyId: 'd1200000-0000-4000-8000-000000000004',
        capabilities: ['cms.taxonomy_curator'],
        mfaFresh: true,
      },
    }),
    rateLimit: async (input) => ({
      ok: true,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000,
      },
    }),
    actTerm: actTerm ?? (async () => ({ ok: true, value: resource })),
    telemetry,
  };
  const app = createCmsTaxonomyApp(dependencies);
  return {
    telemetry,
    send: (headers: Record<string, string> = {}) =>
      app.request(
        new Request(`https://api.example.test${path}`, {
          method: 'POST',
          headers: {
            origin,
            'content-type': 'application/json',
            'idempotency-key': 'taxonomy-action-0001',
            'if-match': '"1"',
            ...headers,
          },
          body: JSON.stringify(body),
        }),
      ),
  };
};

const refusal = (
  status: CmsTaxonomyError['status'],
  details: Record<string, unknown>,
): CmsTaxonomyError => ({
  ok: false,
  status,
  code: 'UNTRUSTED',
  message: 'private provider text must not escape',
  details,
});

const observationOf = (h: ReturnType<typeof harness>): CompositionObservation =>
  (
    h.telemetry.mock.calls[0]?.[0] as unknown as {
      observation: CompositionObservation;
    }
  ).observation;

describe('CMS-03C-03 canonical counters', () => {
  it('counts a canonical_overlap refusal as a match in the published domain, and the canonical id nowhere', async () => {
    const h = harness(async () =>
      refusal(422, {
        reasonCode: 'canonical_overlap',
        domain: 'instrument',
        canonicalId: 'd1200000-0000-4000-8000-0000000000aa',
      }),
    );
    expect((await h.send()).status).toBe(422);
    const observation = observationOf(h);
    expect(observation.metrics).toEqual({
      'cms_canonical_match_total{domain="instrument",outcome="match"}': 1,
    });
    expect(JSON.stringify(observation)).not.toContain('d1200000');
  });

  it('counts a canonical_source_unavailable refusal in both counters', async () => {
    const h = harness(async () =>
      refusal(422, {
        reasonCode: 'canonical_source_unavailable',
        domain: 'gear',
      }),
    );
    expect((await h.send()).status).toBe(422);
    expect(observationOf(h).metrics).toEqual({
      'cms_canonical_match_total{domain="gear",outcome="source_unavailable"}': 1,
      'cms_canonical_source_unavailable_total{domain="gear"}': 1,
    });
  });

  it('counts nothing for a clean success, an unrelated refusal, or a refusal the route would not publish', async () => {
    const ok = harness();
    expect((await ok.send()).status).toBe(200);
    expect(observationOf(ok).metrics).toEqual({});
    const other = harness(async () =>
      refusal(409, { reasonCode: 'taxonomy_not_active' }),
    );
    expect((await other.send()).status).toBe(409);
    expect(observationOf(other).metrics).toEqual({});
    // A canonical refusal whose domain is missing is dropped by the route's own allowlist, so nothing to count.
    const broken = harness(async () =>
      refusal(422, { reasonCode: 'canonical_source_unavailable' }),
    );
    await broken.send();
    expect(observationOf(broken).metrics).toEqual({});
  });

  it('only ever emits registered keys', async () => {
    for (const reasonCode of [
      'canonical_overlap',
      'canonical_source_unavailable',
    ]) {
      const h = harness(async () =>
        refusal(422, {
          reasonCode,
          domain: 'place',
          canonicalId: 'd1200000-0000-4000-8000-0000000000aa',
        }),
      );
      await h.send();
      for (const key of Object.keys(observationOf(h).metrics))
        expect(metricKeyConforms(key)).toBe(true);
    }
  });
});

describe('CMS-03C-03 request traces', () => {
  it('lists the stages of a committed term action in the BE03c order', async () => {
    const h = harness();
    await h.send();
    expect(observationOf(h).traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.idempotency',
      'cms.composition.rpc',
      'cms.composition.audit_outbox',
    ]);
  });

  it('lists no audit/outbox and carries the published code for a refused action', async () => {
    const h = harness(async () => refusal(503, {}));
    expect((await h.send()).status).toBe(503);
    expect(observationOf(h)).toMatchObject({
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
      ],
      dependency: 'cms_composition',
      retryable: true,
    });
    expect(observationOf(h).errorCode).toMatch(/^[A-Z_]+$/u);
  });

  it('lists only validation when the origin is refused', async () => {
    const h = harness();
    await h.send({ origin: 'https://evil.test' });
    expect(observationOf(h).traceSteps).toEqual(['cms.composition.validation']);
  });
});
