import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { platformRegistrySet } from '@wejammin/contracts';

import { RunbookSchema } from './registry-primitives.ts';

/**
 * Lane M request: every Slice 10 editorial telemetry event names the runbook id
 * `cms-editorial`, so the nine CMS-03B routes of the registry must point at the
 * same document (`docs/runbooks/platform/cms-editorial.md`), not at the generic
 * operational-endpoints runbook. The Slice 11 composition routes that share the
 * editorial route defaults keep their own runbook.
 */
const CMS_EDITORIAL_RUNBOOK = 'docs/runbooks/platform/cms-editorial.md';
const SLICE_10_OPERATIONS = [
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-03',
  'CMS-03B-04',
  'CMS-03B-10',
  'CMS-03B-11',
  'CMS-03B-12',
  'CMS-03B-13',
  'CMS-03B-14',
] as const;

const REPOSITORY_ROOT = new URL('../../../', import.meta.url);

describe('platform registry: the Slice 10 editorial routes name the cms-editorial runbook', () => {
  it('accepts the cms-editorial runbook as a canonical path', () => {
    expect(RunbookSchema.safeParse(CMS_EDITORIAL_RUNBOOK).success).toBe(true);
  });

  for (const operationId of SLICE_10_OPERATIONS)
    it(`${operationId} points at the cms-editorial runbook`, () => {
      const route = platformRegistrySet.routes.find(
        (entry) => entry.operationId === operationId,
      );
      expect(route?.runbook).toBe(CMS_EDITORIAL_RUNBOOK);
    });

  it('leaves the other editorial-default routes on their own runbook', () => {
    const others = platformRegistrySet.routes.filter(
      (entry) =>
        entry.owner === 'Editorial' &&
        !(SLICE_10_OPERATIONS as readonly string[]).includes(entry.operationId),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const entry of others)
      expect(entry.runbook).not.toBe(CMS_EDITORIAL_RUNBOOK);
  });

  it('names only runbooks that exist in the repository', () => {
    for (const entry of platformRegistrySet.routes)
      expect(
        existsSync(new URL(entry.runbook, REPOSITORY_ROOT)),
        `${entry.operationId}: ${entry.runbook}`,
      ).toBe(true);
  });
});
