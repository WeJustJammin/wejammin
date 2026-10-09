import { describe, expect, it } from 'vitest';

import {
  CMS_PREFLIGHT_CATEGORIES,
  CMS_PREFLIGHT_REGISTRY,
  PreflightRefusalEntrySchema,
  PreflightResultSchema,
  cmsPreflightFailedReasons,
  cmsPreflightUnavailableReasons,
} from './index';

/*
 * DEC-160 (BE03b D19, "Unavailable reasons"): a non-passed PreflightResult
 * carries a token of its category provider's CLOSED registered reason set.
 * `failed` takes a registered failed reason; `unavailable` takes
 * `provider_unavailable` for every database or reference-gate category and
 * `checker_failed` for the worker accessibility provider (category 11), and no
 * other unavailable token exists. The refusal entry of `details.preflight`
 * carries the same three members, so it holds the same invariants.
 */

const resultFor = (
  category: string,
  outcome: string,
  reasonCode: string | null,
) => ({
  category,
  outcome,
  providerKey: `preflight.${category}`,
  providerVersion: '1',
  reasonCode,
  blockingCount: outcome === 'passed' ? 0 : 1,
});

const entryFor = (
  category: string,
  outcome: string,
  reasonCode: string | null,
) => ({ category, outcome, reasonCode });

const registered = Object.fromEntries(
  CMS_PREFLIGHT_REGISTRY.map((row) => [row.category, row.reasonCodes]),
);

describe('[P2-S11-AC-093] the closed failed and unavailable reason sets (DEC-160)', () => {
  it('registers provider_unavailable for the sixteen non-worker categories and checker_failed for accessibility', () => {
    for (const category of CMS_PREFLIGHT_CATEGORIES)
      expect(cmsPreflightUnavailableReasons(category), category).toEqual(
        category === 'accessibility'
          ? ['checker_failed']
          : ['provider_unavailable'],
      );
  });

  it('derives each failed set from the registry column, without the unavailable reason', () => {
    for (const category of CMS_PREFLIGHT_CATEGORIES) {
      const failed = cmsPreflightFailedReasons(category);
      expect(failed.length, category).toBeGreaterThan(0);
      for (const reason of failed)
        expect(registered[category], `${category}:${reason}`).toContain(reason);
      for (const reason of cmsPreflightUnavailableReasons(category))
        expect(failed, `${category}:${reason}`).not.toContain(reason);
    }
    expect(cmsPreflightFailedReasons('accessibility')).toEqual([
      'blocking_finding',
    ]);
    expect(cmsPreflightFailedReasons('pattern')).toEqual([
      'provider_unbuilt_reference',
    ]);
    expect(cmsPreflightFailedReasons('schema')).toEqual([
      'schema_not_active',
      'schema_evidence_changed',
    ]);
  });

  for (const schemaName of ['result', 'refusal entry'] as const) {
    const build = schemaName === 'result' ? resultFor : entryFor;
    const schema =
      schemaName === 'result'
        ? PreflightResultSchema
        : PreflightRefusalEntrySchema;

    describe(schemaName, () => {
      it('accepts every registered failed reason of its own category', () => {
        for (const category of CMS_PREFLIGHT_CATEGORIES)
          for (const reason of cmsPreflightFailedReasons(category))
            expect(
              schema.safeParse(build(category, 'failed', reason)).success,
              `${category}:${reason}`,
            ).toBe(true);
      });

      it('refuses a failed reason registered for another category, an unavailable reason or an unregistered token', () => {
        for (const category of CMS_PREFLIGHT_CATEGORIES) {
          const own = new Set(cmsPreflightFailedReasons(category));
          for (const other of CMS_PREFLIGHT_CATEGORIES)
            for (const reason of cmsPreflightFailedReasons(other))
              if (!own.has(reason))
                expect(
                  schema.safeParse(build(category, 'failed', reason)).success,
                  `${category}:${reason}`,
                ).toBe(false);
          for (const reason of [
            ...cmsPreflightUnavailableReasons(category),
            'provider_timeout',
            'made_up_reason',
          ])
            expect(
              schema.safeParse(build(category, 'failed', reason)).success,
              `${category}:failed:${reason}`,
            ).toBe(false);
        }
      });

      it('accepts only the category unavailable reason for an unavailable result', () => {
        for (const category of CMS_PREFLIGHT_CATEGORIES) {
          const allowed = cmsPreflightUnavailableReasons(category);
          for (const reason of allowed)
            expect(
              schema.safeParse(build(category, 'unavailable', reason)).success,
              `${category}:${reason}`,
            ).toBe(true);
          for (const reason of [
            'provider_unavailable',
            'checker_failed',
            'provider_timeout',
            'dependency_down',
            ...cmsPreflightFailedReasons(category),
          ])
            if (!allowed.includes(reason))
              expect(
                schema.safeParse(build(category, 'unavailable', reason))
                  .success,
                `${category}:unavailable:${reason}`,
              ).toBe(false);
        }
      });

      it('mirrors the invariant that the reason is null exactly when the outcome is passed', () => {
        for (const category of CMS_PREFLIGHT_CATEGORIES) {
          expect(
            schema.safeParse(build(category, 'passed', null)).success,
            `${category}:passed`,
          ).toBe(true);
          expect(
            schema.safeParse(
              build(
                category,
                'passed',
                cmsPreflightFailedReasons(category)[0] ?? null,
              ),
            ).success,
            `${category}:passed+reason`,
          ).toBe(false);
          for (const outcome of ['failed', 'unavailable'])
            expect(
              schema.safeParse(build(category, outcome, null)).success,
              `${category}:${outcome}+null`,
            ).toBe(false);
        }
      });
    });
  }

  it('reports a wrong reason once, at the reasonCode member', () => {
    for (const [value, schema] of [
      [
        resultFor('schema', 'unavailable', 'provider_timeout'),
        PreflightResultSchema,
      ],
      [
        entryFor('schema', 'unavailable', 'provider_timeout'),
        PreflightRefusalEntrySchema,
      ],
      [entryFor('schema', 'failed', null), PreflightRefusalEntrySchema],
    ] as const) {
      const issues = schema.safeParse(value).error?.issues ?? [];
      expect(issues.map(({ path }) => path)).toEqual([['reasonCode']]);
    }
  });
});
