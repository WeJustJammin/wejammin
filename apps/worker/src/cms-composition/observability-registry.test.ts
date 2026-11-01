import {
  CMS_CANONICAL_DOMAINS,
  CMS_GOVERNED_SCHEDULE_BLOCK_REASONS,
  CMS_GOVERNED_SUBJECT_KINDS,
  CMS_LOCALE_NO_FALLBACK_REASONS,
  GovernedInvalidatedReasonSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { metricOutcome } from '../cms-editorial/route-telemetry';
import {
  CMS_REQUEST_OUTCOMES,
  CMS_SLICE_12_METRICS,
  CMS_SLICE_12_UNEMITTED_METRICS,
  metricKeyConforms,
} from './observability-registry';

/*
 * [P2-S12-AC-263] BE03c Observability lists twelve Slice 12 metrics with their labels (plus the two locale
 * counters named in the same section). The registry is the one executable form of that list; every label
 * value set is closed and none carries an id, label text, locale text, hash or person.
 */

const SPEC_METRICS = {
  cms_governed_review_total: ['subject_kind', 'outcome'],
  cms_governed_decision_total: ['decision', 'outcome'],
  cms_governed_activation_total: ['subject_kind', 'action', 'outcome'],
  cms_governed_review_invalidated_total: ['reason'],
  cms_governed_schedule_blocked_total: ['reason'],
  cms_pattern_linked_update_pending_total: [],
  cms_pattern_update_total: ['action', 'outcome'],
  cms_canonical_match_total: ['domain', 'outcome'],
  cms_canonical_source_unavailable_total: ['domain'],
  cms_related_target_ineligible_total: [],
  cms_locale_fanout_total: [],
  cms_locale_stale_total: [],
  cms_locale_limit_reached_total: [],
} as const;

describe('[P2-S12-AC-263] the Slice 12 metric registry', () => {
  it('names exactly the twelve metrics of BE03c Observability and cms_locale_stale_total with exactly their labels, plus the gate counter and the stale legal-field gauge', () => {
    const registered = Object.fromEntries(
      Object.entries(CMS_SLICE_12_METRICS).map(([name, labels]) => [
        name,
        Object.keys(labels),
      ]),
    );
    expect(registered).toEqual({
      ...SPEC_METRICS,
      cms_no_fallback_block_total: ['reason'],
      // DEC-208: the gauge the Worker samples each tick and hands to the stale locale legal-field alert.
      cms_locale_stale_legal_fields: [],
      // DEC-219/DEC-220: every failed, timed-out or malformed locale observability read (each also raises `locale_observability_unavailable`, DEC-220).
      cms_locale_observability_read_failed_total: [],
    });
  });

  it('keeps every label value set non-empty, closed and made of safe tokens', () => {
    for (const labels of Object.values(CMS_SLICE_12_METRICS))
      for (const values of Object.values(labels)) {
        expect(values.length).toBeGreaterThan(0);
        expect(new Set(values).size).toBe(values.length);
        for (const value of values)
          expect(value).toMatch(/^[a-z][a-z0-9_]{0,63}$/u);
      }
  });

  it('never names a label that could carry an id, label text, locale text, hash or person', () => {
    const labelNames = new Set(
      Object.values(CMS_SLICE_12_METRICS).flatMap((labels) =>
        Object.keys(labels),
      ),
    );
    for (const name of labelNames)
      expect(name).not.toMatch(
        /(^|_)(id|ids|hash|label|labels|locale|person|party|actor|user|name|text|key|email)($|_)/u,
      );
  });

  it('takes closed values from the contracts vocabularies', () => {
    const m = CMS_SLICE_12_METRICS;
    expect(m.cms_governed_review_total.subject_kind).toEqual([
      ...CMS_GOVERNED_SUBJECT_KINDS,
    ]);
    expect(m.cms_governed_decision_total.decision).toEqual([
      'approve',
      'reject',
    ]);
    expect(m.cms_governed_review_invalidated_total.reason).toEqual(
      GovernedInvalidatedReasonSchema.options,
    );
    expect(m.cms_governed_schedule_blocked_total.reason).toEqual([
      ...CMS_GOVERNED_SCHEDULE_BLOCK_REASONS,
    ]);
    expect(m.cms_pattern_update_total.action).toEqual(['accept', 'detach']);
    expect(m.cms_canonical_match_total.domain).toEqual([
      ...CMS_CANONICAL_DOMAINS,
    ]);
    expect(m.cms_canonical_match_total.outcome).toEqual([
      'match',
      'source_unavailable',
    ]);
    expect(m.cms_canonical_source_unavailable_total.domain).toEqual([
      ...CMS_CANONICAL_DOMAINS,
    ]);
    expect(m.cms_no_fallback_block_total.reason).toEqual([
      ...CMS_LOCALE_NO_FALLBACK_REASONS,
    ]);
  });

  it('keeps the request outcome vocabulary equal to what the shared route outcome mapper can return', () => {
    const produced = new Set<string>();
    for (let status = 100; status < 600; status += 1)
      produced.add(metricOutcome(status));
    expect([...produced].sort()).toEqual([...CMS_REQUEST_OUTCOMES].sort());
  });

  it('counts the activation metric under the request outcomes, the execution outcomes and the unknown subject kind the routes and the sweep already emit', () => {
    const activation = CMS_SLICE_12_METRICS.cms_governed_activation_total;
    expect(activation.action).toEqual(['activate', 'schedule', 'retire']);
    for (const outcome of [
      ...CMS_REQUEST_OUTCOMES,
      'completed',
      'blocked',
      'failed_retryable',
      'already_completed',
      'error',
    ])
      expect(activation.outcome).toContain(outcome);
    expect(activation.subject_kind).toContain('unknown');
  });
});

describe('[P2-S12-AC-263] metricKeyConforms', () => {
  it.each([
    'cms_governed_review_total{outcome="success",subject_kind="template_version"}',
    'cms_governed_decision_total{decision="reject",outcome="denied"}',
    'cms_pattern_linked_update_pending_total',
    'cms_related_target_ineligible_total',
    'cms_no_fallback_block_total{reason="no_fallback_stale"}',
    'cms_locale_fanout_total',
    'cms_locale_stale_total',
    'cms_locale_stale_legal_fields',
    'cms_locale_observability_read_failed_total',
  ])('accepts %s', (key) => {
    expect(metricKeyConforms(key)).toBe(true);
  });

  it.each([
    ['an unregistered metric', 'cms_made_up_total'],
    [
      'a label outside the set',
      'cms_governed_review_total{outcome="success",subject_kind="template_version",locale="fr-FR"}',
    ],
    [
      'a missing label',
      'cms_governed_review_total{subject_kind="template_version"}',
    ],
    [
      'an open label value',
      'cms_governed_review_total{outcome="success",subject_kind="d1200000-0000-4000-8000-000000000001"}',
    ],
    [
      'labels on a label-free metric',
      'cms_related_target_ineligible_total{outcome="success"}',
    ],
    ['a malformed key', 'cms_governed_review_total{outcome=success}'],
    [
      'a locale label on the stale counter (DEC-208: labels never carry a locale)',
      'cms_locale_stale_total{locale="fr-FR"}',
    ],
  ])('rejects %s', (_name, key) => {
    expect(metricKeyConforms(key)).toBe(false);
  });
});

describe('[P2-S12-AC-263] metrics with no Worker-observable event', () => {
  it('lists none: every registered Slice 12 counter now has an emitting seam', () => {
    // DEC-208 / DEC-213 gave the two locale counters a source (the scheduled database-side read) and the
    // cms.pattern.linked_update_scan job (P2-S12-AC-212, linked-scan/job.ts) increments the linked-update counter,
    // so nothing remains unemitted.
    expect(CMS_SLICE_12_UNEMITTED_METRICS).toEqual([]);
    expect(
      CMS_SLICE_12_UNEMITTED_METRICS.map((entry) => entry.metric),
    ).not.toContain('cms_pattern_linked_update_pending_total');
  });
});
