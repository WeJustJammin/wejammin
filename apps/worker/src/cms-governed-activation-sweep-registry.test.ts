import { CMS_GOVERNED_SCHEDULE_BLOCK_REASONS } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runProductionCmsGovernedActivationSweep } from './cms-governed-activation-sweep';
import {
  bindings,
  CLAIM_RPC,
  claimFor,
  completed,
  EXECUTE_RPC,
  logs,
  stubEdge,
} from './cms-governed-activation-sweep.test-support';
import { metricKeyConforms } from './cms-composition/observability-registry';

/*
 * [P2-S12-AC-263] The activation sweep emits `cms_governed_activation_total{subject_kind,action,outcome}` and
 * `cms_governed_schedule_blocked_total{reason}` (the two counters of the twelve that this Worker module owns):
 * every `cms_governed_*` counter key it logs is a registered key with closed label values, for every execution
 * outcome, every block reason and every subject kind, and a thrown tick.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const keysOf = (text: string): string[] =>
  (JSON.parse(text) as unknown[][]).flatMap((call) =>
    call.flatMap((entry) =>
      Object.keys(
        ((entry as { metrics?: Record<string, number> }).metrics ??
          {}) as Record<string, number>,
      ),
    ),
  );

const run = async (
  subjectKind: string,
  result: (claim: { scheduleId: string }) => Response,
): Promise<string[]> => {
  const claim = claimFor(1, { subjectKind });
  stubEdge({
    [CLAIM_RPC]: () => Response.json([claim]),
    [EXECUTE_RPC]: () => result(claim),
  });
  const logged = logs();
  await runProductionCmsGovernedActivationSweep(bindings);
  const text = logged();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  return keysOf(text).filter((key) => key.startsWith('cms_governed_'));
};

describe('the sweep emits only registered Slice 12 counters', () => {
  it.each(['template_version', 'pattern_version', 'taxonomy_version'])(
    'for a completed %s',
    async (subjectKind) => {
      const keys = await run(subjectKind, (claim) =>
        Response.json(completed(claim)),
      );
      expect(keys).toContain(
        `cms_governed_activation_total{action="activate",outcome="completed",subject_kind="${subjectKind}"}`,
      );
      for (const key of keys.filter((k) =>
        k.startsWith('cms_governed_activation_total'),
      ))
        expect(metricKeyConforms(key)).toBe(true);
    },
  );

  it.each(CMS_GOVERNED_SCHEDULE_BLOCK_REASONS)(
    'for a schedule blocked with %s',
    async (reasonCode) => {
      const keys = await run('template_version', (claim) =>
        Response.json({
          scheduleId: claim.scheduleId,
          outcome: 'blocked',
          reasonCode,
          actualUtc: null,
          deviationSeconds: null,
        }),
      );
      expect(keys).toContain(
        `cms_governed_schedule_blocked_total{reason="${reasonCode}"}`,
      );
      for (const key of keys.filter(
        (k) =>
          k.startsWith('cms_governed_activation_total') ||
          k.startsWith('cms_governed_schedule_blocked_total'),
      ))
        expect(metricKeyConforms(key)).toBe(true);
    },
  );

  it.each(['failed_retryable', 'already_completed'] as const)(
    'for a %s execution',
    async (outcome) => {
      const keys = await run('template_version', (claim) =>
        Response.json({
          scheduleId: claim.scheduleId,
          outcome,
          reasonCode: null,
          actualUtc: null,
          deviationSeconds: null,
        }),
      );
      const counters = keys.filter((k) =>
        k.startsWith('cms_governed_activation_total'),
      );
      expect(counters).toHaveLength(1);
      expect(metricKeyConforms(counters[0] as string)).toBe(true);
    },
  );

  it('for a thrown tick, under the error outcome', async () => {
    const keys = await run('template_version', () => {
      throw new Error('edge down');
    });
    const counters = keys.filter((k) =>
      k.startsWith('cms_governed_activation_total'),
    );
    expect(counters).toEqual([
      'cms_governed_activation_total{action="activate",outcome="error",subject_kind="template_version"}',
    ]);
    expect(metricKeyConforms(counters[0] as string)).toBe(true);
    expect(
      keys.some((k) => k.startsWith('cms_governed_schedule_blocked')),
    ).toBe(false);
  });
});
