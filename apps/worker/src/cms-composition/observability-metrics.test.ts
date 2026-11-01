import { describe, expect, it } from 'vitest';

import { metricKeyConforms } from './observability-registry';
import { factsOf, noteFacts, noteRefusal } from './observability-facts';
import {
  compositionMetrics,
  invalidationMetrics,
} from './observability-metrics';
import { noFallbackBlockMetrics } from './observability-no-fallback';

/*
 * [P2-S12-AC-263] [P2-S12-AC-051] BE03c Observability: each Slice 12 counter is emitted at the event it
 * names, from closed facts only. A refusal contributes its published `reasonCode` and `domain` (never its
 * message, violations or any other member), a request contributes the closed members it decoded.
 */

const request = (): Request => new Request('https://api.example.test/x');

const metricsFor = (
  operationId: string,
  status: number,
  note: (req: Request) => void = () => undefined,
): Record<string, number> => {
  const req = request();
  note(req);
  return compositionMetrics(operationId, status, factsOf(req));
};

describe('[P2-S12-AC-263] governed review submit and decision counters', () => {
  it.each([
    ['template_version', 201, 'success'],
    ['pattern_version', 409, 'conflict'],
    ['taxonomy_version', 403, 'denied'],
    ['template_version', 429, 'rate_limited'],
    ['pattern_version', 422, 'invalid'],
    ['taxonomy_version', 503, 'failed'],
  ] as const)(
    'counts a %s submit answered %i once as outcome %s',
    (subjectKind, status, outcome) => {
      expect(
        metricsFor('CMS-03C-06', status, (req) =>
          noteFacts(req, { subjectKind }),
        ),
      ).toEqual({
        [`cms_governed_review_total{outcome="${outcome}",subject_kind="${subjectKind}"}`]: 1,
      });
    },
  );

  it('counts nothing for a submit whose body was never decoded', () => {
    expect(metricsFor('CMS-03C-06', 400)).toEqual({});
  });

  it.each([
    ['approve', 200, 'success'],
    ['reject', 200, 'success'],
    ['approve', 403, 'denied'],
    ['reject', 409, 'conflict'],
  ] as const)(
    'counts a %s decision answered %i once as outcome %s',
    (decision, status, outcome) => {
      expect(
        metricsFor('CMS-03C-07', status, (req) => noteFacts(req, { decision })),
      ).toEqual({
        [`cms_governed_decision_total{decision="${decision}",outcome="${outcome}"}`]: 1,
      });
    },
  );

  it('keeps the invalidation out of the request counters: a decision refused as dependency_changed counts the decision alone', () => {
    expect(
      metricsFor('CMS-03C-07', 409, (req) => {
        noteFacts(req, { decision: 'approve' });
        noteRefusal(req, 409, { reasonCode: 'dependency_changed' });
      }),
    ).toEqual({
      'cms_governed_decision_total{decision="approve",outcome="conflict"}': 1,
    });
    expect(
      metricsFor('CMS-03C-09', 409, (req) =>
        noteRefusal(req, 409, { reasonCode: 'dependency_changed' }),
      ),
    ).toEqual({});
  });
});

const invalidatedFor = (
  operationId: string,
  note: (req: Request) => void,
): Record<string, number> => {
  const req = request();
  note(req);
  return invalidationMetrics(operationId, factsOf(req));
};

describe('[P2-S12-AC-263] cms_governed_review_invalidated_total', () => {
  it.each(['CMS-03C-07', 'CMS-03C-09'])(
    'counts a committed dependency_changed refusal of %s as one invalidation',
    (operationId) => {
      expect(
        invalidatedFor(operationId, (req) =>
          noteRefusal(req, 409, { reasonCode: 'dependency_changed' }),
        ),
      ).toEqual({
        'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
      });
    },
  );

  it('does not count another 409 reason, another status, or an operation that cannot raise it', () => {
    expect(
      invalidatedFor('CMS-03C-09', (req) =>
        noteRefusal(req, 409, { reasonCode: 'activation_conflict' }),
      ),
    ).toEqual({});
    expect(
      invalidatedFor('CMS-03C-07', (req) =>
        noteRefusal(req, 422, { reasonCode: 'dependency_changed' }),
      ),
    ).toEqual({});
    expect(
      invalidatedFor('CMS-03C-08', (req) =>
        noteRefusal(req, 409, { reasonCode: 'dependency_changed' }),
      ),
    ).toEqual({});
    expect(invalidatedFor('CMS-03C-07', () => undefined)).toEqual({});
  });
});

describe('[P2-S12-AC-263] pattern update counter', () => {
  it.each([
    ['accept', 200, 'success'],
    ['detach', 200, 'success'],
    ['accept', 409, 'conflict'],
    ['detach', 422, 'invalid'],
  ] as const)(
    'counts a CMS-03C-15 %s answered %i as outcome %s',
    (action, status, outcome) => {
      expect(
        metricsFor('CMS-03C-15', status, (req) =>
          noteFacts(req, { updateAction: action }),
        ),
      ).toEqual({
        [`cms_pattern_update_total{action="${action}",outcome="${outcome}"}`]: 1,
      });
    },
  );

  it('counts nothing for the diff read, which is not an update action', () => {
    expect(
      metricsFor('CMS-03C-14', 200, (req) =>
        noteFacts(req, { updateAction: 'accept' }),
      ),
    ).toEqual({});
  });
});

describe('[P2-S12-AC-263] canonical taxonomy counters', () => {
  it.each(['CMS-03C-03'])(
    'counts a canonical_overlap refusal of %s as a match in its published domain',
    (operationId) => {
      expect(
        metricsFor(operationId, 422, (req) =>
          noteRefusal(req, 422, {
            reasonCode: 'canonical_overlap',
            domain: 'instrument',
            canonicalId: 'd1200000-0000-4000-8000-000000000001',
          }),
        ),
      ).toEqual({
        'cms_canonical_match_total{domain="instrument",outcome="match"}': 1,
      });
    },
  );

  it.each(['CMS-03C-03', 'CMS-03C-06', 'CMS-03C-09'])(
    'counts a canonical_source_unavailable refusal of %s in both counters',
    (operationId) => {
      expect(
        metricsFor(operationId, 422, (req) =>
          noteRefusal(req, 422, {
            reasonCode: 'canonical_source_unavailable',
            domain: 'rights',
          }),
        ),
      ).toEqual({
        'cms_canonical_match_total{domain="rights",outcome="source_unavailable"}': 1,
        'cms_canonical_source_unavailable_total{domain="rights"}': 1,
      });
    },
  );

  it('drops a canonical refusal whose domain is not a closed canonical domain instead of inventing a label', () => {
    for (const domain of ['role" , locale="fr-FR', 'ROLE', 7, undefined]) {
      expect(
        metricsFor('CMS-03C-03', 422, (req) =>
          noteRefusal(req, 422, {
            reasonCode: 'canonical_source_unavailable',
            domain,
          }),
        ),
      ).toEqual({});
    }
  });
});

describe('[P2-S12-AC-263] related-content and locale counters', () => {
  it('counts the uniform related_target_ineligible refusal of CMS-03C-05 once', () => {
    expect(
      metricsFor('CMS-03C-05', 422, (req) =>
        noteRefusal(req, 422, { reasonCode: 'related_target_ineligible' }),
      ),
    ).toEqual({ cms_related_target_ineligible_total: 1 });
  });

  it('counts the 409 locale_limit_reached refusal of CMS-03C-04 once', () => {
    expect(
      metricsFor('CMS-03C-04', 409, (req) =>
        noteRefusal(req, 409, { reasonCode: 'locale_limit_reached' }),
      ),
    ).toEqual({ cms_locale_limit_reached_total: 1 });
  });

  it('counts neither on a different operation or a different status', () => {
    expect(
      metricsFor('CMS-03C-04', 422, (req) =>
        noteRefusal(req, 422, { reasonCode: 'related_target_ineligible' }),
      ),
    ).toEqual({});
    expect(
      metricsFor('CMS-03C-05', 409, (req) =>
        noteRefusal(req, 409, { reasonCode: 'locale_limit_reached' }),
      ),
    ).toEqual({});
  });
});

describe('[P2-S12-AC-263] closed facts only', () => {
  it('stores only the reason token and the closed domain of a refusal', () => {
    const req = request();
    noteRefusal(req, 422, {
      reasonCode: 'canonical_overlap',
      domain: 'role',
      canonicalId: 'd1200000-0000-4000-8000-000000000001',
      message: 'Term "Gérant secret" overlaps',
      violations: [{ path: '/label', message: 'label text' }],
    });
    expect(factsOf(req).refusal).toEqual({
      status: 422,
      reasonCode: 'canonical_overlap',
      domain: 'role',
    });
  });

  it('ignores an unknown reason token and non-record details', () => {
    const req = request();
    noteRefusal(req, 409, { reasonCode: 'a free-form reason with a label' });
    expect(factsOf(req).refusal).toEqual({ status: 409 });
    noteRefusal(req, 500, 'not details');
    expect(factsOf(req).refusal).toEqual({ status: 500 });
  });

  it('only ever produces keys the registry accepts, for every operation, status and refusal', () => {
    const operations = [
      'CMS-03C-03',
      'CMS-03C-04',
      'CMS-03C-05',
      'CMS-03C-06',
      'CMS-03C-07',
      'CMS-03C-09',
      'CMS-03C-15',
    ];
    const refusals: Record<string, unknown>[] = [
      {},
      { reasonCode: 'dependency_changed' },
      { reasonCode: 'canonical_overlap', domain: 'place' },
      { reasonCode: 'canonical_source_unavailable', domain: 'gear' },
      { reasonCode: 'related_target_ineligible' },
      { reasonCode: 'locale_limit_reached' },
    ];
    let seen = 0;
    for (const operationId of operations)
      for (const status of [200, 201, 202, 400, 401, 403, 409, 422, 429, 503])
        for (const details of refusals) {
          const req = request();
          noteFacts(req, {
            subjectKind: 'template_version',
            decision: 'approve',
            updateAction: 'detach',
          });
          noteRefusal(req, status, details);
          for (const key of Object.keys({
            ...compositionMetrics(operationId, status, factsOf(req)),
            ...invalidationMetrics(operationId, factsOf(req)),
          })) {
            seen += 1;
            expect(metricKeyConforms(key)).toBe(true);
          }
        }
    expect(seen).toBeGreaterThan(100);
  });
});

describe('[P2-S12-AC-051] [P2-S12-AC-263] cms_no_fallback_block_total', () => {
  it.each([
    'no_fallback_missing',
    'no_fallback_stale',
    'locale_variant_not_approved',
  ] as const)(
    'counts a failed locale gate with the closed reason %s once per evaluation',
    (reason) => {
      expect(
        noFallbackBlockMetrics([
          { category: 'locale', outcome: 'failed', reason },
        ]),
      ).toEqual({
        [`cms_no_fallback_block_total{reason="${reason}"}`]: 1,
      });
    },
  );

  it('counts nothing for a passed, unavailable, other-category or unknown-reason entry', () => {
    expect(
      noFallbackBlockMetrics([
        { category: 'locale', outcome: 'passed', reason: null },
        {
          category: 'locale',
          outcome: 'unavailable',
          reason: 'provider_unbuilt_reference',
        },
        {
          category: 'accessibility',
          outcome: 'failed',
          reason: 'no_fallback_missing',
        },
        { category: 'locale', outcome: 'failed', reason: 'a free-form reason' },
        { category: 'locale', outcome: 'failed', reason: null },
      ]),
    ).toEqual({});
  });

  it('sums repeated failures of the same reason, one per evaluation', () => {
    expect(
      noFallbackBlockMetrics([
        {
          category: 'locale',
          outcome: 'failed',
          reason: 'no_fallback_missing',
        },
        {
          category: 'locale',
          outcome: 'failed',
          reason: 'no_fallback_missing',
        },
      ]),
    ).toEqual({
      'cms_no_fallback_block_total{reason="no_fallback_missing"}': 2,
    });
  });
});
