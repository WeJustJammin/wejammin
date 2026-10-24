import { describe, expect, it, vi } from 'vitest';

import { createCmsLocaleApp } from './locale-routes';
import {
  deps as localeDeps,
  portError,
  request as localeRequest,
} from './locale-routes.test-support';
import type { CompositionObservation } from './observability-observation';
import { metricKeyConforms } from './observability-registry';
import { createCmsRelatedContentApp } from './related-content-routes';
import {
  dependencies as relatedDeps,
  request as relatedRequest,
  validResource,
  type CmsRelatedContentPortResult,
} from './related-content-routes.test-support';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] CMS-03C-05 counts `cms_related_target_ineligible_total` from the one uniform
 * 422 it publishes (never a target id, pin or exclusion), CMS-03C-04 counts `cms_locale_limit_reached_total` from
 * the 409 `locale_limit_reached` (never a locale), and both list the stages they really entered.
 */

const observed = (telemetry: {
  mock: { calls: unknown[][] };
}): CompositionObservation =>
  (
    telemetry.mock.calls[0]?.[0] as unknown as {
      observation: CompositionObservation;
    }
  ).observation;

const relatedRefusal = (
  status: 403 | 409 | 422,
  details: Record<string, unknown>,
): CmsRelatedContentPortResult => ({
  ok: false,
  status,
  code: 'PORT_CODE',
  message: 'private provider text',
  details,
});

describe('CMS-03C-05 emits cms_related_target_ineligible_total', () => {
  it('counts the uniform related_target_ineligible 422 once and carries no target pointer', async () => {
    const telemetry = vi.fn();
    const response = await createCmsRelatedContentApp(
      relatedDeps({
        telemetry,
        actRelatedContent: async () =>
          relatedRefusal(422, {
            reasonCode: 'related_target_ineligible',
            violations: [
              { path: '/pins/0', code: 'related_target_ineligible' },
            ],
          }),
      }),
    ).request(relatedRequest());
    expect(response.status).toBe(422);
    const observation = observed(telemetry);
    expect(observation.metrics).toEqual({
      cms_related_target_ineligible_total: 1,
    });
    expect(JSON.stringify(observation)).not.toContain('/pins');
  });

  it.each([
    [422, 'derived_rule_unknown'],
    [409, 'activation_conflict'],
  ] as const)(
    'counts nothing for a %i %s refusal',
    async (status, reasonCode) => {
      const telemetry = vi.fn();
      await createCmsRelatedContentApp(
        relatedDeps({
          telemetry,
          actRelatedContent: async () => relatedRefusal(status, { reasonCode }),
        }),
      ).request(relatedRequest());
      expect(observed(telemetry).metrics).toEqual({});
    },
  );

  it('counts nothing for a committed write and lists its stages through audit/outbox', async () => {
    const telemetry = vi.fn();
    const response = await createCmsRelatedContentApp(
      relatedDeps({
        telemetry,
        actRelatedContent: async () => ({ ok: true, value: validResource() }),
      }),
    ).request(relatedRequest());
    expect(response.status).toBe(201);
    expect(observed(telemetry)).toMatchObject({
      metrics: {},
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
        'cms.composition.audit_outbox',
      ],
    });
  });

  it('lists only validation when the origin is refused', async () => {
    const telemetry = vi.fn();
    await createCmsRelatedContentApp(relatedDeps({ telemetry })).request(
      relatedRequest({ origin: 'https://evil.test' }),
    );
    expect(observed(telemetry).traceSteps).toEqual([
      'cms.composition.validation',
    ]);
  });
});

describe('CMS-03C-04 emits cms_locale_limit_reached_total', () => {
  it('counts the 409 locale_limit_reached refusal once and carries no locale', async () => {
    const telemetry = vi.fn();
    const response = await createCmsLocaleApp(
      localeDeps({
        telemetry,
        authorLocale: async () =>
          portError(409, {
            reasonCode: 'locale_limit_reached',
            expectedVersion: '3',
          }),
      }),
    ).request(localeRequest());
    expect(response.status).toBe(409);
    const observation = observed(telemetry);
    expect(observation.metrics).toEqual({ cms_locale_limit_reached_total: 1 });
    expect(JSON.stringify(observation)).not.toContain('fr-FR');
    for (const key of Object.keys(observation.metrics))
      expect(metricKeyConforms(key)).toBe(true);
  });

  it('counts nothing for another 409 or a committed variant', async () => {
    const other = vi.fn();
    await createCmsLocaleApp(
      localeDeps({
        telemetry: other,
        authorLocale: async () =>
          portError(409, { reasonCode: 'FALLBACK_CHAIN_MISMATCH' }),
      }),
    ).request(localeRequest());
    expect(observed(other).metrics).toEqual({});
    const ok = vi.fn();
    expect(
      (
        await createCmsLocaleApp(localeDeps({ telemetry: ok })).request(
          localeRequest(),
        )
      ).status,
    ).toBe(201);
    expect(observed(ok)).toMatchObject({
      metrics: {},
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
        'cms.composition.audit_outbox',
      ],
    });
  });

  it('lists no audit/outbox for a refused write', async () => {
    const telemetry = vi.fn();
    await createCmsLocaleApp(
      localeDeps({ telemetry, authorLocale: async () => portError(503) }),
    ).request(localeRequest());
    expect(observed(telemetry)).toMatchObject({
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
      ],
      dependency: 'cms_composition',
      retryable: true,
    });
  });
});
