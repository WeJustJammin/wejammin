import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issueMessages,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CompositionUpdateDiffApiRequestSchema,
  CompositionUpdateDiffResourceSchema,
} from './pattern-update';

const instanceId = uid(110);
const instance = {
  id: instanceId,
  version: '2',
  revisionId: uid(111),
  path: '/header/0/hero',
  state: 'draft',
  linkMode: 'linked',
  pinnedPatternVersion: 2,
} as const;
const diff = {
  instance,
  targetPatternVersion: 3,
  paths: [
    {
      path: '/hero',
      base: { text: 'Old' },
      theirs: { text: 'New' },
      yours: null,
      collision: false,
    },
    {
      path: '/hero/cta',
      base: { label: 'Go' },
      theirs: { label: 'Start' },
      yours: { label: 'Begin' },
      collision: true,
    },
  ],
  collisionCount: 1,
  bulkEligible: false,
} as const;

describe('CMS-03C-14 update diff contract', () => {
  it('[P2-S12-AC-113] accepts only a UUID instanceId path and an empty strict query', () => {
    expect(
      CompositionUpdateDiffApiRequestSchema.parse({ instanceId, query: {} }),
    ).toEqual({ instanceId, query: {} });
    for (const candidate of [
      { instanceId, query: { debug: '1' } },
      { instanceId: 'x', query: {} },
      { query: {} },
      { instanceId },
    ])
      expect(isRefused(CompositionUpdateDiffApiRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-112] accepts the instance, the target version, the three-way paths, the collision count and bulk eligibility', () => {
    expect(CompositionUpdateDiffResourceSchema.parse(diff)).toEqual(diff);
  });

  it('[P2-S12-AC-114] answers an instance with no newer compatible version as an empty diff at its pinned version', () => {
    const empty = {
      instance,
      targetPatternVersion: 2,
      paths: [],
      collisionCount: 0,
      bulkEligible: false,
    };
    expect(CompositionUpdateDiffResourceSchema.parse(empty)).toEqual(empty);
    for (const candidate of [
      { ...empty, bulkEligible: true },
      { ...empty, paths: [diff.paths[0]] },
      { ...empty, collisionCount: 1 },
      { ...diff, targetPatternVersion: 2 },
      { ...diff, targetPatternVersion: 1 },
    ])
      expect(isRefused(CompositionUpdateDiffResourceSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-113] keeps collisionCount equal to the collision flags and bulkEligible only when nothing collides', () => {
    expect(
      issuePaths(CompositionUpdateDiffResourceSchema, {
        ...diff,
        collisionCount: 2,
      }),
    ).toEqual(['collisionCount']);
    expect(
      issuePaths(CompositionUpdateDiffResourceSchema, {
        ...diff,
        collisionCount: 0,
      }),
    ).toEqual(['collisionCount']);
    expect(
      issuePaths(CompositionUpdateDiffResourceSchema, {
        ...diff,
        bulkEligible: true,
      }),
    ).toEqual(['bulkEligible']);
    const clean = {
      ...diff,
      paths: [diff.paths[0]],
      collisionCount: 0,
      bulkEligible: true,
    };
    expect(CompositionUpdateDiffResourceSchema.safeParse(clean).success).toBe(
      true,
    );
    expect(
      CompositionUpdateDiffResourceSchema.safeParse({
        ...clean,
        bulkEligible: false,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-113] bounds the diff at 128 unique node paths, 256 KiB, and bounded JSON values that are null when absent', () => {
    const pathsOf = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        path: `/node${index}`,
        base: null,
        theirs: { n: index },
        yours: null,
        collision: false,
      }));
    expect(
      CompositionUpdateDiffResourceSchema.safeParse({
        ...diff,
        paths: pathsOf(128),
        collisionCount: 0,
        bulkEligible: true,
      }).success,
    ).toBe(true);
    expect(
      isRefused(CompositionUpdateDiffResourceSchema, {
        ...diff,
        paths: pathsOf(129),
        collisionCount: 0,
        bulkEligible: true,
      }),
    ).toBe(true);
    expect(
      issuePaths(CompositionUpdateDiffResourceSchema, {
        ...diff,
        paths: [diff.paths[0], diff.paths[0]],
        collisionCount: 0,
        bulkEligible: true,
      }),
    ).toEqual(['paths.1.path']);
    for (const path of [
      { ...diff.paths[0], base: undefined },
      { ...diff.paths[0], theirs: Number.NaN },
      { ...diff.paths[0], path: 'hero' },
      { ...diff.paths[0], collision: 'no' },
      { ...diff.paths[0], extra: 1 },
      without(diff.paths[0], 'yours'),
    ])
      expect(
        isRefused(CompositionUpdateDiffResourceSchema, {
          ...diff,
          paths: [path],
          collisionCount: 0,
        }),
      ).toBe(true);
    // 256 KiB total: 128 values of 2,100 characters are ~269 KiB.
    const heavy = Array.from({ length: 128 }, (_, index) => ({
      path: `/node${index}`,
      base: null,
      theirs: 'x'.repeat(2_100),
      yours: null,
      collision: false,
    }));
    expect(
      issueMessages(CompositionUpdateDiffResourceSchema, {
        ...diff,
        paths: heavy,
        collisionCount: 0,
        bulkEligible: true,
      }),
    ).toEqual(['diff_too_large']);
  });

  it('[P2-S12-AC-112] refuses a malformed instance summary and any member beyond the closed set', () => {
    for (const candidate of [
      { ...diff, instance: { ...instance, state: 'published' } },
      { ...diff, instance: { ...instance, linkMode: 'implicit' } },
      { ...diff, instance: { ...instance, pinnedPatternVersion: 0 } },
      { ...diff, instance: { ...instance, version: '0' } },
      { ...diff, instance: { ...instance, path: 'x'.repeat(513) } },
      { ...diff, instance: { ...instance, ownerId: uid(1) } },
      { ...diff, instance: without(instance, 'revisionId') },
      { ...diff, targetPatternVersion: 0 },
      { ...diff, collisionCount: 129 },
      { ...diff, collisionCount: -1 },
      { ...diff, ownerId: uid(1) },
      without(diff, 'bulkEligible'),
      without(diff, 'paths'),
    ])
      expect(isRefused(CompositionUpdateDiffResourceSchema, candidate)).toBe(
        true,
      );
  });
});
