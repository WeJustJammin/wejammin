import { describe, expect, it } from 'vitest';

import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_TIMEOUT_MS,
  CMS_A11Y_CHECKER_VERSION,
  CMS_PREFLIGHT_CATEGORIES,
  CMS_PREFLIGHT_EVIDENCE_MAX_AGE_SECONDS,
  CMS_PREFLIGHT_PHASES,
  CMS_PREFLIGHT_REGISTRY,
  AccessibilityRunOutcomeSchema,
  PreflightCategorySchema,
  PreflightEvidenceSchema,
  PreflightOutcomeSchema,
  PreflightReportSchema,
  PreflightResultSchema,
  PreflightRefusalEntrySchema,
  aggregatePreflight,
  cmsPreflightCategoriesForPhase,
  cmsPreflightEvidenceIsFresh,
  cmsPreflightExecutionOutcome,
  preflightResultForAccessibilityEvidence,
} from './index';
import { hash, hash2 } from './workflow-fixtures.test-support';

const instant = '2026-10-08T12:00:00Z';

const passedResult = (category: string) => ({
  category,
  outcome: 'passed',
  providerKey: `preflight.${category}`,
  providerVersion: '1',
  reasonCode: null,
  blockingCount: 0,
});

const report = (
  override: Record<
    string,
    (typeof CMS_PREFLIGHT_CATEGORIES)[number] | unknown
  > = {},
) => ({
  evaluatedAt: instant,
  passed: true,
  results: CMS_PREFLIGHT_CATEGORIES.map((category) => passedResult(category)),
  ...override,
});

const failedAt = (category: string, reasonCode: string, outcome = 'failed') =>
  report({
    passed: false,
    results: CMS_PREFLIGHT_CATEGORIES.map((c) =>
      c === category
        ? { ...passedResult(c), outcome, reasonCode, blockingCount: 1 }
        : passedResult(c),
    ),
  });

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-093] publication preflight registry (D19)', () => {
  it('lists the seventeen categories in registry order and types the enum from them', () => {
    expect(CMS_PREFLIGHT_CATEGORIES).toEqual([
      'contract',
      'schema',
      'template',
      'block',
      'pattern',
      'taxonomy',
      'settings',
      'relation',
      'privacy',
      'security',
      'accessibility',
      'media',
      'route',
      'locale',
      'migration',
      'domain_binding',
      'revocation',
    ]);
    expect(PreflightCategorySchema.options).toEqual([
      ...CMS_PREFLIGHT_CATEGORIES,
    ]);
    expect(PreflightOutcomeSchema.options).toEqual([
      'passed',
      'failed',
      'unavailable',
    ]);
  });

  it('mirrors the code-owned registry rows: one row per category in order (CI parity with the enum)', () => {
    expect(CMS_PREFLIGHT_REGISTRY.map((row) => row.category)).toEqual([
      ...CMS_PREFLIGHT_CATEGORIES,
    ]);
    expect(CMS_PREFLIGHT_REGISTRY).toHaveLength(17);
    expect(
      new Set(CMS_PREFLIGHT_REGISTRY.map((row) => row.category)).size,
    ).toBe(17);
    for (const row of CMS_PREFLIGHT_REGISTRY) {
      expect(row.registryVersion).toBe('1');
      expect(row.providerVersion).toBe('1');
      expect(['database', 'worker', 'reference_gate']).toContain(
        row.providerKind,
      );
    }
  });

  it('serves the six unbuilt domains with the generic reference gate and its reference kind', () => {
    const gates = CMS_PREFLIGHT_REGISTRY.filter(
      (row) => row.providerKind === 'reference_gate',
    );
    expect(gates.map((row) => [row.category, row.referenceKind])).toEqual([
      ['pattern', 'pattern'],
      ['taxonomy', 'taxonomy'],
      ['privacy', 'privacy'],
      ['media', 'media'],
      ['route', 'route'],
      ['locale', 'locale'],
    ]);
    for (const row of gates) {
      expect(row.providerKey).toBe('preflight.reference_gate');
      expect(row.reasonCodes).toEqual(['provider_unbuilt_reference']);
    }
    for (const row of CMS_PREFLIGHT_REGISTRY.filter(
      (r) => r.providerKind !== 'reference_gate',
    ))
      expect(row.referenceKind).toBeNull();
  });

  it('registers the structural accessibility checker as the only worker provider', () => {
    const workers = CMS_PREFLIGHT_REGISTRY.filter(
      (row) => row.providerKind === 'worker',
    );
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({
      category: 'accessibility',
      providerKey: CMS_A11Y_CHECKER_KEY,
      providerVersion: CMS_A11Y_CHECKER_VERSION,
      reasonCodes: ['blocking_finding', 'checker_failed'],
    });
    expect(CMS_A11Y_CHECKER_KEY).toBe('cms.a11y.structural');
    expect(CMS_A11Y_CHECKER_VERSION).toBe('1');
    expect(CMS_A11Y_CHECKER_TIMEOUT_MS).toBe(2_000);
  });

  it('gives each database provider exactly its declared reason codes', () => {
    const reasons = Object.fromEntries(
      CMS_PREFLIGHT_REGISTRY.map((row) => [row.category, row.reasonCodes]),
    );
    expect(reasons).toMatchObject({
      contract: ['value_invalid', 'validators_changed'],
      schema: ['schema_not_active', 'schema_evidence_changed'],
      template: [
        'template_not_active',
        'template_incompatible',
        'template_changed',
      ],
      block: ['block_withdrawn', 'block_digest_changed'],
      settings: ['settings_changed'],
      relation: ['relation_target_unavailable', 'relation_version_changed'],
      security: ['unsafe_content'],
      migration: ['migration_in_progress'],
      domain_binding: ['binding_not_allowlisted'],
      revocation: [
        'entry_unavailable',
        'reviewer_authority_changed',
        'publisher_authority_ended',
      ],
    });
    for (const row of CMS_PREFLIGHT_REGISTRY)
      expect(row.providerKey).toMatch(/^[a-z][a-z0-9._-]{0,127}$/u);
    expect(
      CMS_PREFLIGHT_REGISTRY.filter((r) => r.providerKind === 'database').map(
        (r) => r.providerKey,
      ),
    ).toEqual(
      [
        'contract',
        'schema',
        'template',
        'block',
        'settings',
        'relation',
        'security',
        'migration',
        'domain_binding',
        'revocation',
      ].map((c) => `preflight.${c}`),
    );
  });

  it('evaluates every category in every registry phase and CMS-03B-08 has no phase', () => {
    expect(CMS_PREFLIGHT_PHASES).toEqual([
      'submit',
      'schedule',
      'publish',
      'execute',
    ]);
    for (const phase of CMS_PREFLIGHT_PHASES)
      expect(cmsPreflightCategoriesForPhase(phase)).toEqual([
        ...CMS_PREFLIGHT_CATEGORIES,
      ]);
  });
});

describe('[P2-S11-AC-097] PreflightResult and PreflightReport', () => {
  it('ties reasonCode to the outcome: null exactly when passed', () => {
    const base = {
      category: 'schema',
      providerKey: 'preflight.schema',
      providerVersion: '1',
      blockingCount: 0,
    };
    expect(
      PreflightResultSchema.safeParse({
        ...base,
        outcome: 'passed',
        reasonCode: null,
      }).success,
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'passed',
        reasonCode: 'schema_not_active',
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'failed',
        reasonCode: null,
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'unavailable',
        reasonCode: null,
      }),
    ).toBe(true);
    expect(
      PreflightResultSchema.safeParse({
        ...base,
        outcome: 'failed',
        reasonCode: 'schema_not_active',
        blockingCount: 1,
      }).success,
    ).toBe(true);
  });

  it('takes a failed reason only from the category provider reason set; the unavailable reason is DEC-160 (preflight-reasons.test.ts)', () => {
    const base = {
      category: 'schema',
      providerKey: 'preflight.schema',
      providerVersion: '1',
      blockingCount: 1,
    };
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'failed',
        reasonCode: 'unsafe_content',
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'failed',
        reasonCode: 'Not_Lowercase',
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'unavailable',
        reasonCode: 'provider_timeout',
      }),
    ).toBe(true);
    expect(
      PreflightResultSchema.safeParse({
        ...base,
        outcome: 'unavailable',
        reasonCode: 'provider_unavailable',
      }).success,
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'unavailable',
        reasonCode: 'Provider Timeout',
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, {
        ...base,
        outcome: 'unavailable',
        reasonCode: `a${'b'.repeat(64)}`,
      }),
    ).toBe(true);
  });

  it('bounds blockingCount (0-1000), the provider key and version, and rejects unknown members', () => {
    const base = {
      category: 'schema',
      outcome: 'passed',
      providerKey: 'preflight.schema',
      providerVersion: '1',
      reasonCode: null,
      blockingCount: 0,
    };
    expect(
      PreflightResultSchema.safeParse({ ...base, blockingCount: 1_000 })
        .success,
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, { ...base, blockingCount: 1_001 }),
    ).toBe(true);
    expect(refused(PreflightResultSchema, { ...base, blockingCount: -1 })).toBe(
      true,
    );
    expect(
      refused(PreflightResultSchema, {
        ...base,
        providerKey: 'Preflight.Schema',
      }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, { ...base, providerVersion: '0' }),
    ).toBe(true);
    expect(
      refused(PreflightResultSchema, { ...base, category: 'unknown' }),
    ).toBe(true);
    expect(refused(PreflightResultSchema, { ...base, findingText: 'x' })).toBe(
      true,
    );
  });

  it('accepts a report of exactly seventeen results in registry order whose passed flag is true only when all pass', () => {
    expect(PreflightReportSchema.safeParse(report()).success).toBe(true);
    expect(
      PreflightReportSchema.safeParse(failedAt('security', 'unsafe_content'))
        .success,
    ).toBe(true);
    expect(refused(PreflightReportSchema, report({ passed: false }))).toBe(
      true,
    );
    expect(
      refused(
        PreflightReportSchema,
        failedAt('security', 'unsafe_content').results && {
          ...failedAt('security', 'unsafe_content'),
          passed: true,
        },
      ),
    ).toBe(true);
    expect(
      PreflightReportSchema.safeParse(
        failedAt('accessibility', 'checker_failed', 'unavailable'),
      ).success,
    ).toBe(true);
  });

  it('refuses a short, long, duplicated or reordered result list', () => {
    const results = report().results;
    expect(
      refused(PreflightReportSchema, report({ results: results.slice(0, 16) })),
    ).toBe(true);
    expect(
      refused(
        PreflightReportSchema,
        report({ results: [...results, results[0]] }),
      ),
    ).toBe(true);
    expect(
      refused(
        PreflightReportSchema,
        report({ results: [results[1], results[0], ...results.slice(2)] }),
      ),
    ).toBe(true);
    expect(
      refused(
        PreflightReportSchema,
        report({ results: [results[0], results[0], ...results.slice(2)] }),
      ),
    ).toBe(true);
    expect(
      refused(
        PreflightReportSchema,
        report({ evaluatedAt: '2026-10-08T12:00:00' }),
      ),
    ).toBe(true);
    expect(refused(PreflightReportSchema, { ...report(), extra: 1 })).toBe(
      true,
    );
  });

  it('aggregates without short-circuit: failed beats unavailable beats passed', () => {
    expect(aggregatePreflight(report().results).kind).toBe('passed');
    const mixed = report().results.map((r) =>
      r.category === 'accessibility'
        ? {
            ...r,
            outcome: 'unavailable',
            reasonCode: 'checker_failed',
            blockingCount: 0,
          }
        : r.category === 'security'
          ? {
              ...r,
              outcome: 'failed',
              reasonCode: 'unsafe_content',
              blockingCount: 2,
            }
          : r,
    );
    const aggregate = aggregatePreflight(mixed as never);
    expect(aggregate.kind).toBe('failed');
    expect(aggregate.entries).toHaveLength(17);
    const onlyUnavailable = report().results.map((r) =>
      r.category === 'accessibility'
        ? { ...r, outcome: 'unavailable', reasonCode: 'checker_failed' }
        : r,
    );
    expect(aggregatePreflight(onlyUnavailable as never).kind).toBe(
      'unavailable',
    );
  });

  it('projects refusal details with category, outcome and reason only (no counts or finding text)', () => {
    const aggregate = aggregatePreflight(
      failedAt('security', 'unsafe_content').results as never,
    );
    for (const entry of aggregate.entries) {
      expect(Object.keys(entry).sort()).toEqual([
        'category',
        'outcome',
        'reasonCode',
      ]);
      expect(PreflightRefusalEntrySchema.safeParse(entry).success).toBe(true);
    }
    expect(
      refused(PreflightRefusalEntrySchema, {
        category: 'security',
        outcome: 'failed',
        reasonCode: 'unsafe_content',
        blockingCount: 1,
      }),
    ).toBe(true);
  });

  it('maps execution outcomes: failed blocks the schedule and unavailable retries it', () => {
    expect(cmsPreflightExecutionOutcome('failed')).toBe('blocked');
    expect(cmsPreflightExecutionOutcome('unavailable')).toBe(
      'failed_retryable',
    );
    expect(cmsPreflightExecutionOutcome('passed')).toBe('proceed');
  });
});

describe('[P2-S11-AC-101][P2-S11-AC-102] accessibility PreflightEvidence (DEC-150)', () => {
  const evidence = {
    category: 'accessibility',
    providerKey: 'cms.a11y.structural',
    providerVersion: '1',
    outcome: 'healthy',
    blockingCount: 0,
    inputHash: hash,
    bindingHash: hash2,
    evaluatedAt: instant,
  } as const;

  it('uses the BE05c run-state vocabulary and no per-category outcome', () => {
    expect(AccessibilityRunOutcomeSchema.options).toEqual([
      'healthy',
      'blocked',
      'failed',
    ]);
    expect(PreflightEvidenceSchema.parse(evidence)).toEqual(evidence);
    for (const outcome of [
      'passed',
      'unavailable',
      'requested',
      'running',
      'stale',
    ])
      expect(
        refused(PreflightEvidenceSchema, { ...evidence, outcome }),
        outcome,
      ).toBe(true);
  });

  it('enforces the BE05c invariants: healthy has no blocking finding and blocked has one', () => {
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, blockingCount: 1 }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, {
        ...evidence,
        outcome: 'blocked',
        blockingCount: 0,
      }),
    ).toBe(true);
    expect(
      PreflightEvidenceSchema.safeParse({
        ...evidence,
        outcome: 'blocked',
        blockingCount: 3,
      }).success,
    ).toBe(true);
    expect(
      PreflightEvidenceSchema.safeParse({
        ...evidence,
        outcome: 'failed',
        blockingCount: 0,
      }).success,
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, {
        ...evidence,
        blockingCount: 1_001,
        outcome: 'blocked',
      }),
    ).toBe(true);
  });

  it('is accessibility-only, strict and fully bound', () => {
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, category: 'security' }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, {
        ...evidence,
        providerKey: 'other.checker',
      }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, providerVersion: 'v1' }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, bindingHash: 'x' }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, inputHash: undefined }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, findings: [] }),
    ).toBe(true);
    expect(
      refused(PreflightEvidenceSchema, { ...evidence, evaluatedAt: 'now' }),
    ).toBe(true);
  });

  it('maps the run state to the category result (healthy passes; blocked fails; failed is unavailable)', () => {
    expect(preflightResultForAccessibilityEvidence(evidence)).toEqual({
      category: 'accessibility',
      outcome: 'passed',
      providerKey: 'cms.a11y.structural',
      providerVersion: '1',
      reasonCode: null,
      blockingCount: 0,
    });
    expect(
      preflightResultForAccessibilityEvidence({
        ...evidence,
        outcome: 'blocked',
        blockingCount: 2,
      }),
    ).toMatchObject({
      outcome: 'failed',
      reasonCode: 'blocking_finding',
      blockingCount: 2,
    });
    expect(
      preflightResultForAccessibilityEvidence({
        ...evidence,
        outcome: 'failed',
      }),
    ).toMatchObject({
      outcome: 'unavailable',
      reasonCode: 'checker_failed',
      blockingCount: 0,
    });
    for (const outcome of ['healthy', 'blocked', 'failed'] as const)
      expect(
        PreflightResultSchema.safeParse(
          preflightResultForAccessibilityEvidence({
            ...evidence,
            outcome,
            blockingCount: outcome === 'blocked' ? 1 : 0,
          }),
        ).success,
      ).toBe(true);
  });

  it('accepts evidence only within 60 seconds of the RPC instant', () => {
    expect(CMS_PREFLIGHT_EVIDENCE_MAX_AGE_SECONDS).toBe(60);
    const now = Date.parse(instant);
    expect(cmsPreflightEvidenceIsFresh(instant, now)).toBe(true);
    expect(cmsPreflightEvidenceIsFresh('2026-10-08T11:59:00Z', now)).toBe(true);
    expect(cmsPreflightEvidenceIsFresh('2026-10-08T11:58:59Z', now)).toBe(
      false,
    );
    expect(cmsPreflightEvidenceIsFresh('2026-10-08T12:01:00Z', now)).toBe(true);
    expect(cmsPreflightEvidenceIsFresh('2026-10-08T12:01:01Z', now)).toBe(
      false,
    );
    expect(cmsPreflightEvidenceIsFresh('not-an-instant', now)).toBe(false);
  });
});
