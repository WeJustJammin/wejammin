import { describe, expect, it } from 'vitest';

import {
  hash,
  isRefused,
  issueMessages,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CompositionUpdateApiRequestSchema,
  CompositionUpdateHeadersSchema,
  CompositionUpdateRequestSchema,
  CompositionUpdateResourceSchema,
  PatternUpdateChoiceSchema,
} from './pattern-update';

const instanceId = uid(110);
const target = { instanceId, expectedVersion: '2', choices: [] } as const;
const accept = {
  action: 'accept',
  targetPatternVersion: 3,
  instances: [target],
  expectedVersion: '5',
} as const;
const detach = {
  action: 'detach',
  instances: [target],
  expectedVersion: '5',
} as const;
const headers = {
  contentType: 'application/json',
  idempotencyKey: 'pattern-update-0001',
  ifMatch: '"5"',
} as const;

const resourceRow = {
  id: uid(120),
  version: '3',
  contentHash: hash,
  createdAt: '2026-10-13T12:00:00Z',
  updatedAt: '2026-10-13T12:00:00Z',
  state: 'active',
  revisionId: uid(111),
  path: '/header/0/hero',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId: uid(112),
  patternVersion: 3,
  blockRegistryDigest: hash,
  linkMode: 'linked',
  conflictState: 'none',
} as const;

describe('CMS-03C-15 pattern update request', () => {
  it('[P2-S12-AC-118] discriminates accept (with a target version) and detach, each with 1 to 32 instances', () => {
    expect(CompositionUpdateRequestSchema.parse(accept)).toEqual(accept);
    expect(CompositionUpdateRequestSchema.parse(detach)).toEqual(detach);
    // `choices` defaults to an empty list when omitted.
    expect(
      CompositionUpdateRequestSchema.parse({
        ...accept,
        instances: [{ instanceId, expectedVersion: '2' }],
      }),
    ).toEqual(accept);
  });

  it('[P2-S12-AC-119] bounds the instances at 1 to 32 with a bulk request carrying no choices', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        instanceId: uid(800 + index),
        expectedVersion: '1',
        choices: [],
      }));
    for (const count of [1, 2, 32])
      expect(
        CompositionUpdateRequestSchema.safeParse({
          ...accept,
          instances: many(count),
        }).success,
      ).toBe(true);
    for (const instances of [[], many(33)])
      expect(
        isRefused(CompositionUpdateRequestSchema, { ...accept, instances }),
      ).toBe(true);
    // Choices are allowed only for a single-instance request.
    const choice = { path: '/hero', choice: 'yours' };
    const bulk = [{ ...many(2)[0], choices: [choice] }, many(2)[1]];
    expect(
      issuePaths(CompositionUpdateRequestSchema, {
        ...accept,
        instances: bulk,
      }),
    ).toEqual(['instances.0.choices']);
    expect(
      issueMessages(CompositionUpdateRequestSchema, {
        ...accept,
        instances: bulk,
      }),
    ).toEqual(['choices_single_instance_only']);
    expect(
      CompositionUpdateRequestSchema.safeParse({
        ...accept,
        instances: [{ ...target, choices: [choice] }],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-119] refuses a repeated instance and a repeated choice path', () => {
    expect(
      issuePaths(CompositionUpdateRequestSchema, {
        ...accept,
        instances: [target, { ...target, expectedVersion: '3' }],
      }),
    ).toEqual(['instances.1.instanceId']);
    expect(
      issuePaths(CompositionUpdateRequestSchema, {
        ...accept,
        instances: [
          { ...target, instanceId: instanceId.toUpperCase() },
          target,
        ],
      }),
    ).toEqual(['instances.1.instanceId']);
    const dup = [
      { path: '/hero', choice: 'yours' },
      { path: '/hero', choice: 'theirs' },
    ];
    expect(
      issuePaths(CompositionUpdateRequestSchema, {
        ...accept,
        instances: [{ ...target, choices: dup }],
      }),
    ).toEqual(['instances.0.choices.1.path']);
  });

  it('[P2-S12-AC-119] bounds choices at 128 and each choice to a node path and yours or theirs', () => {
    const choices = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        path: `/node${index}`,
        choice: 'theirs' as const,
      }));
    expect(
      CompositionUpdateRequestSchema.safeParse({
        ...accept,
        instances: [{ ...target, choices: choices(128) }],
      }).success,
    ).toBe(true);
    expect(
      isRefused(CompositionUpdateRequestSchema, {
        ...accept,
        instances: [{ ...target, choices: choices(129) }],
      }),
    ).toBe(true);
    expect(
      PatternUpdateChoiceSchema.parse({ path: '/a/b', choice: 'yours' }),
    ).toEqual({ path: '/a/b', choice: 'yours' });
    for (const candidate of [
      { path: 'hero', choice: 'yours' },
      { path: '/Hero', choice: 'yours' },
      { path: '/hero', choice: 'both' },
      { path: '/hero', choice: 'Yours' },
      { path: '/hero' },
      { choice: 'yours' },
      { path: '/hero', choice: 'yours', value: 1 },
      { path: `/${'a'.repeat(512)}`, choice: 'yours' },
    ])
      expect(isRefused(PatternUpdateChoiceSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-119] refuses an unknown action, a target version outside int32 and a member the action does not name', () => {
    for (const candidate of [
      { ...accept, action: 'merge' },
      { ...accept, targetPatternVersion: 0 },
      { ...accept, targetPatternVersion: 2_147_483_648 },
      { ...accept, targetPatternVersion: 1.5 },
      without(accept, 'targetPatternVersion'),
      { ...detach, targetPatternVersion: 3 },
      { ...accept, expectedVersion: '0' },
      { ...accept, expectedVersion: 5 },
      without(accept, 'expectedVersion'),
      { ...accept, instances: [{ ...target, expectedVersion: '0' }] },
      { ...accept, instances: [{ ...target, instanceId: 'x' }] },
      { ...accept, instances: [without(target, 'expectedVersion')] },
      { ...accept, instances: [{ ...target, ownerId: uid(1) }] },
      { ...accept, revisionId: uid(1) },
    ])
      expect(isRefused(CompositionUpdateRequestSchema, candidate)).toBe(true);
    expect(
      CompositionUpdateRequestSchema.safeParse({
        ...accept,
        targetPatternVersion: 2_147_483_647,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-121] requires a key and the strong If-Match equal to the entry expectedVersion', () => {
    expect(CompositionUpdateHeadersSchema.parse(headers)).toEqual(headers);
    for (const candidate of [
      without(headers, 'ifMatch'),
      { ...headers, ifMatch: 'W/"5"' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, contentType: 'text/plain' },
    ])
      expect(isRefused(CompositionUpdateHeadersSchema, candidate)).toBe(true);
    for (const body of [accept, detach]) {
      expect(
        CompositionUpdateApiRequestSchema.safeParse({ headers, body }).success,
      ).toBe(true);
      expect(
        issuePaths(CompositionUpdateApiRequestSchema, {
          headers: { ...headers, ifMatch: '"6"' },
          body,
        }),
      ).toEqual(['headers.ifMatch']);
    }
  });
});

describe('CompositionUpdateResource (CMS-03C-15 200)', () => {
  it('[P2-S12-AC-118] answers 1 to 32 closed composition instance items', () => {
    const items = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...resourceRow,
        id: uid(900 + index),
        path: `/header/0/n${index}`,
        position: index,
      }));
    for (const count of [1, 32])
      expect(
        CompositionUpdateResourceSchema.safeParse({ items: items(count) })
          .success,
      ).toBe(true);
    for (const candidate of [
      { items: [] },
      { items: items(33) },
      { items: [{ ...resourceRow, ownerId: uid(1) }] },
      { items: [without(resourceRow, 'position')] },
      {},
      { items: items(1), total: 1 },
    ])
      expect(isRefused(CompositionUpdateResourceSchema, candidate)).toBe(true);
  });
});
