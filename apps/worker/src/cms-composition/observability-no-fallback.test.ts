import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildRouteEvent,
  type RouteFacts,
} from '../cms-editorial/route-telemetry';
import type { CmsEditorialError } from '../cms-editorial/types';
import { metricKeyConforms } from './observability-registry';

/*
 * [P2-S12-AC-051] [P2-S12-AC-263] A `no_fallback` field whose target-locale value is missing (or stale) fails the
 * 03b `locale` preflight category and blocks the publication or schedule request; the Slice 11 route event
 * counts it as `cms_no_fallback_block_total{reason}` from the PUBLISHED preflight members, beside its existing
 * `cms_preflight_result_total`.
 */

const policy = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const metrics = (
  operationId: string,
  status: number,
  facts: RouteFacts,
): Record<string, number> =>
  buildRouteEvent(
    {
      request: new Request('https://web.test/x'),
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      policy: policy(operationId),
      startedAt: 100,
      now: 140,
    },
    new Response(null, { status }),
    facts,
  ).metrics ?? {};

const refusal = (
  preflight: readonly Record<string, unknown>[],
): CmsEditorialError => ({
  ok: false,
  status: 422,
  code: 'VALIDATION_FAILED',
  message: 'x',
  details: { reasonCode: 'preflight_failed', preflight },
});

const noFallback = (all: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(all).filter(([key]) =>
      key.startsWith('cms_no_fallback_block_total'),
    ),
  );

describe('cms_no_fallback_block_total from a refused preflight', () => {
  it.each([
    ['CMS-03B-07', 'no_fallback_missing'],
    ['CMS-03B-09', 'no_fallback_missing'],
    ['CMS-03B-09', 'no_fallback_stale'],
    ['CMS-03B-07', 'locale_variant_not_approved'],
    ['CMS-03B-05', 'no_fallback_missing'],
  ] as const)(
    'counts a %s refusal whose locale category failed with %s once',
    (operationId, reason) => {
      const published = noFallback(
        metrics(operationId, 422, {
          error: refusal([
            { category: 'locale', outcome: 'failed', reasonCode: reason },
            { category: 'accessibility', outcome: 'passed', reasonCode: null },
          ]),
        }),
      );
      expect(published).toEqual({
        [`cms_no_fallback_block_total{reason="${reason}"}`]: 1,
      });
      for (const key of Object.keys(published))
        expect(metricKeyConforms(key)).toBe(true);
    },
  );

  it('keeps the existing preflight counter beside it', () => {
    const all = metrics('CMS-03B-09', 422, {
      error: refusal([
        {
          category: 'locale',
          outcome: 'failed',
          reasonCode: 'no_fallback_missing',
        },
      ]),
    });
    expect(
      all[
        'cms_preflight_result_total{category="locale",outcome="failed",phase="publish"}'
      ],
    ).toBe(1);
  });

  it('counts nothing for a passed, unavailable, other-category or unknown-reason entry', () => {
    expect(
      noFallback(
        metrics('CMS-03B-09', 422, {
          error: refusal([
            { category: 'locale', outcome: 'passed', reasonCode: null },
            {
              category: 'locale',
              outcome: 'unavailable',
              reasonCode: 'provider_unbuilt_reference',
            },
            {
              category: 'contract',
              outcome: 'failed',
              reasonCode: 'no_fallback_missing',
            },
            {
              category: 'locale',
              outcome: 'failed',
              reasonCode: 'Titre secret du champ',
            },
          ]),
        }),
      ),
    ).toEqual({});
  });

  it('counts nothing on an operation that evaluates no preflight', () => {
    expect(
      noFallback(
        metrics('CMS-03B-06', 422, {
          error: refusal([
            {
              category: 'locale',
              outcome: 'failed',
              reasonCode: 'no_fallback_missing',
            },
          ]),
        }),
      ),
    ).toEqual({});
  });
});
