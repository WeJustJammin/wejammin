import { describe, expect, it } from 'vitest';

import { ApiErrorSchema } from '../api-error';
import { CMS_SLICE_12_PREFLIGHT_PROVIDERS } from '../cms-composition/preflight-providers';
import {
  CMS_PREFLIGHT_CATEGORIES,
  CMS_PREFLIGHT_REGISTRY,
  CmsEditorialRefusalDetailsSchema,
  PreflightRefusalEntrySchema,
  PreflightReportSchema,
  PreflightResultSchema,
  aggregatePreflight,
  cmsPreflightFailedReasons,
  cmsPreflightUnavailableReasons,
} from './index';

const PATTERN_REASONS = [
  'pattern_not_active',
  'pattern_digest_changed',
  'nested_pattern_not_active',
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
  'pattern_block_rules_violated',
] as const;

const PATTERN_PROVIDER = {
  category: 'pattern',
  ownerSlice: '03c',
  providerKey: 'cms.pattern.active_digest',
  providerVersion: '1',
  providerKind: 'database',
  reasonCodes: [...PATTERN_REASONS],
} as const;

const patternEntry = (reasonCode: string) => ({
  category: 'pattern',
  outcome: 'failed',
  reasonCode,
});

const patternResult = (
  reasonCode: string,
  outcome: 'failed' | 'unavailable' = 'failed',
) => ({
  ...patternEntry(reasonCode),
  providerKey: PATTERN_PROVIDER.providerKey,
  providerVersion: PATTERN_PROVIDER.providerVersion,
  blockingCount: outcome === 'failed' ? 1 : 0,
  outcome,
});

const resultFor = (category: string) => {
  const provider = CMS_PREFLIGHT_REGISTRY.find(
    (row) => row.category === category,
  );
  return {
    category,
    outcome: 'passed',
    providerKey: provider?.providerKey ?? `preflight.${category}`,
    providerVersion: provider?.providerVersion ?? '1',
    reasonCode: null,
    blockingCount: 0,
  };
};

const reportFor = (reasonCode: string) => ({
  evaluatedAt: '2026-10-08T12:00:00Z',
  passed: false,
  results: CMS_PREFLIGHT_CATEGORIES.map((category) =>
    category === 'pattern' ? patternResult(reasonCode) : resultFor(category),
  ),
});

const refusalDetailsFor = (reasonCode: string) => ({
  reasonCode: 'preflight_failed',
  preflight: [patternEntry(reasonCode)],
});

const refused = (
  schema: { safeParse: (value: unknown) => { success: boolean } },
  value: unknown,
) => !schema.safeParse(value).success;

describe('BE03c pattern preflight provider (DEC-199)', () => {
  it('keeps the main registry and Slice 12 provider catalog on one active-digest row', () => {
    const main = CMS_PREFLIGHT_REGISTRY.find(
      (row) => row.category === 'pattern',
    );
    const slice12 = CMS_SLICE_12_PREFLIGHT_PROVIDERS.find(
      (row) => row.category === 'pattern',
    );
    expect(slice12).toEqual(PATTERN_PROVIDER);
    expect(main).toEqual({
      ...PATTERN_PROVIDER,
      registryVersion: '2',
      referenceKind: null,
    });
    expect(cmsPreflightFailedReasons('pattern')).toEqual([...PATTERN_REASONS]);
    expect(cmsPreflightUnavailableReasons('pattern')).toEqual([
      'provider_unavailable',
    ]);
  });

  it('[P2-S12-AC-211] DEC-247 publishes the re-proved CMS-03C-12 bounds as failed reasons, after nested_pattern_not_active', () => {
    const failed = cmsPreflightFailedReasons('pattern');
    for (const reasonCode of ['pattern_depth_exceeded', 'pattern_nodes_exceeded']) {
      expect(failed, reasonCode).toContain(reasonCode);
      expect(cmsPreflightUnavailableReasons('pattern')).not.toContain(
        reasonCode,
      );
    }
    expect(failed.indexOf('pattern_depth_exceeded')).toBe(
      failed.indexOf('nested_pattern_not_active') + 1,
    );
    expect(failed.indexOf('pattern_nodes_exceeded')).toBe(
      failed.indexOf('pattern_depth_exceeded') + 1,
    );
  });

  it('parses every closed pattern reason through result, report and refusal contracts', () => {
    for (const reasonCode of PATTERN_REASONS) {
      const result = patternResult(reasonCode);
      const entry = patternEntry(reasonCode);
      const details = refusalDetailsFor(reasonCode);
      expect(PreflightResultSchema.safeParse(result).success, reasonCode).toBe(
        true,
      );
      expect(
        PreflightRefusalEntrySchema.safeParse(entry).success,
        `${reasonCode}:entry`,
      ).toBe(true);
      expect(
        CmsEditorialRefusalDetailsSchema.safeParse(details).success,
        `${reasonCode}:details`,
      ).toBe(true);
      expect(
        ApiErrorSchema.safeParse({
          code: 'VALIDATION_FAILED',
          message: 'Refused.',
          requestId: '123e4567-e89b-42d3-a456-426614174000',
          details,
        }).success,
        `${reasonCode}:api`,
      ).toBe(true);
    }
  });

  it('rejects cross-category, unknown and unavailable misuse while retaining provider outage', () => {
    for (const schema of [PreflightResultSchema, PreflightRefusalEntrySchema]) {
      for (const reasonCode of PATTERN_REASONS) {
        const own = patternResult(reasonCode);
        const entry = patternEntry(reasonCode);
        expect(
          refused(
            schema,
            schema === PreflightResultSchema
              ? { ...own, category: 'taxonomy' }
              : { ...entry, category: 'taxonomy' },
          ),
          `${reasonCode}:taxonomy`,
        ).toBe(true);
        expect(
          refused(schema, schema === PreflightResultSchema ? own : entry),
          `${reasonCode}:own`,
        ).toBe(false);
        expect(
          refused(
            schema,
            schema === PreflightResultSchema
              ? { ...own, reasonCode: 'pattern_unknown' }
              : { ...entry, reasonCode: 'pattern_unknown' },
          ),
          `${reasonCode}:unknown`,
        ).toBe(true);
        expect(
          refused(
            schema,
            schema === PreflightResultSchema
              ? { ...own, reasonCode: 'provider_unavailable' }
              : { ...entry, reasonCode: 'provider_unavailable' },
          ),
          `${reasonCode}:failed-unavailable`,
        ).toBe(true);
        expect(
          refused(
            schema,
            schema === PreflightResultSchema
              ? { ...own, outcome: 'unavailable', blockingCount: 0 }
              : { ...entry, outcome: 'unavailable' },
          ),
          `${reasonCode}:unavailable`,
        ).toBe(true);
      }
      expect(
        schema.safeParse(
          schema === PreflightResultSchema
            ? patternResult('provider_unavailable', 'unavailable')
            : {
                category: 'pattern',
                outcome: 'unavailable',
                reasonCode: 'provider_unavailable',
              },
        ).success,
      ).toBe(true);
    }
  });

  it('requires exactly seventeen ordered results and aggregates pattern failure as blocking', () => {
    const passed = {
      evaluatedAt: '2026-10-08T12:00:00Z',
      passed: true,
      results: CMS_PREFLIGHT_CATEGORIES.map(resultFor),
    };
    expect(passed.results).toHaveLength(17);
    expect(passed.results.map((result) => result.category)).toEqual([
      ...CMS_PREFLIGHT_CATEGORIES,
    ]);
    expect(PreflightReportSchema.safeParse(passed).success).toBe(true);
    expect(
      PreflightReportSchema.safeParse({
        ...passed,
        results: passed.results.slice(0, 16),
      }).success,
    ).toBe(false);
    expect(
      PreflightReportSchema.safeParse({
        ...passed,
        results: [...passed.results, passed.results[0]],
      }).success,
    ).toBe(false);
    expect(
      PreflightReportSchema.safeParse({
        ...passed,
        results: [
          passed.results[1],
          passed.results[0],
          ...passed.results.slice(2),
        ],
      }).success,
    ).toBe(false);
    expect(
      PreflightReportSchema.safeParse({
        ...passed,
        results: [
          passed.results[0],
          passed.results[0],
          ...passed.results.slice(2),
        ],
      }).success,
    ).toBe(false);
    const failedReport = reportFor('pattern_not_active');
    expect(
      PreflightReportSchema.safeParse({ ...failedReport, passed: true })
        .success,
    ).toBe(false);
    for (const reasonCode of PATTERN_REASONS) {
      const report = reportFor(reasonCode);
      expect(PreflightReportSchema.safeParse(report).success, reasonCode).toBe(
        true,
      );
      const aggregate = aggregatePreflight(report.results as never);
      expect(aggregate.kind, reasonCode).toBe('failed');
      expect(aggregate.entries, reasonCode).toHaveLength(17);
      expect(
        aggregate.entries.find((entry) => entry.category === 'pattern'),
        reasonCode,
      ).toEqual(patternEntry(reasonCode));
    }
    const mixed = reportFor('pattern_not_active').results.map((result) =>
      result.category === 'accessibility'
        ? { ...result, outcome: 'unavailable', reasonCode: 'checker_failed' }
        : result,
    );
    expect(aggregatePreflight(mixed as never).kind).toBe('failed');
  });
});
