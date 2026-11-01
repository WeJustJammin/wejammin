import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AccessibilityBindingInputSchema,
  CMS_EDITORIAL_JOB_TYPES,
  CMS_REVIEW_RECHECK_BATCH_MAX,
  CMS_SLICE_11_METRICS,
  ReviewDependencyKindSchema,
  ReviewDependencyRecheckJobSchema,
} from './index';
import {
  hash,
  hash2,
  uuid,
  uuid2,
  version,
  without,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-102] accessibility evidence binding input', () => {
  const input = {
    checkerKey: 'cms.a11y.structural',
    checkerVersion: version,
    revisionId: uuid,
    revisionContentHash: hash,
    dependencyHash: hash2,
  } as const;

  it('names exactly the five members the RPC recomputes from canonical rows', () => {
    expect(AccessibilityBindingInputSchema.parse(input)).toEqual(input);
    for (const key of Object.keys(input))
      expect(
        refused(
          AccessibilityBindingInputSchema,
          without(input, key as keyof typeof input),
        ),
        key,
      ).toBe(true);
    expect(
      refused(AccessibilityBindingInputSchema, {
        ...input,
        checkerKey: 'other',
      }),
    ).toBe(true);
    expect(
      refused(AccessibilityBindingInputSchema, { ...input, extra: 1 }),
    ).toBe(true);
    expect(
      refused(AccessibilityBindingInputSchema, {
        ...input,
        dependencyHash: 'x',
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-113] review dependency index and recheck job', () => {
  it('indexes the nine frozen dependency kinds', () => {
    expect(ReviewDependencyKindSchema.options).toEqual([
      'schema',
      'template',
      'block',
      'pattern',
      'term',
      'taxonomy_version',
      'locale_source',
      'relation_target',
      'settings',
    ]);
  });

  it('enqueues { eventId, kind, refId } and bounds a run at 500 reviews', () => {
    const job = { eventId: uuid, kind: 'schema', refId: uuid2 };
    expect(ReviewDependencyRecheckJobSchema.parse(job)).toEqual(job);
    expect(
      refused(ReviewDependencyRecheckJobSchema, { ...job, kind: 'media' }),
    ).toBe(true);
    expect(
      refused(ReviewDependencyRecheckJobSchema, { ...job, reviewId: uuid }),
    ).toBe(true);
    expect(
      refused(ReviewDependencyRecheckJobSchema, {
        kind: 'schema',
        refId: uuid2,
      }),
    ).toBe(true);
    expect(CMS_REVIEW_RECHECK_BATCH_MAX).toBe(500);
    expect(CMS_EDITORIAL_JOB_TYPES).toEqual({
      scheduleExecute: 'cms.publication_schedule.execute',
      dependencyRecheck: 'cms.review.dependency_recheck',
    });
  });
});

describe('[P2-S11-AC-010][P2-S11-AC-084] Slice 11 metrics', () => {
  it('lists the BE03b Slice 11 metrics with label sets that never carry an id, hash, reason text or person', () => {
    expect(CMS_SLICE_11_METRICS).toEqual({
      cms_review_submitted_total: ['risk_class', 'outcome'],
      cms_review_decision_total: ['decision', 'outcome'],
      cms_review_assignment_total: ['action', 'outcome'],
      cms_review_invalidated_total: ['reason'],
      cms_preflight_result_total: ['category', 'outcome', 'phase'],
      cms_preflight_latency_ms: ['category'],
      cms_a11y_checker_duration_ms: [],
      cms_schedule_blocked_total: ['reason'],
      cms_schedule_attempt_total: ['outcome'],
      cms_schedule_claim_batch_size: [],
      cms_preview_verify_total: ['valid'],
      cms_publication_lineage_conflict_total: [],
      cms_settings_snapshot_ordinal: [],
      cms_separation_of_duties_refusal_total: ['operation'],
    });
    for (const labels of Object.values(CMS_SLICE_11_METRICS))
      for (const label of labels)
        expect(label).not.toMatch(/^id$|Id$|hash|person|email|text|token/u);
  });

  it('is documented in the cms-publication runbook', () => {
    const runbook = readFileSync(
      'docs/runbooks/platform/cms-publication.md',
      'utf8',
    );
    for (const name of Object.keys(CMS_SLICE_11_METRICS))
      expect(runbook, name).toContain(name);
  });
});
