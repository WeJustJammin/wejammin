import { beforeAll, describe, expect, it } from 'vitest';

import {
  ConflictRecordProposedValuesSchema,
  ConflictRecordResourceSchema,
  ConflictRecordStateSchema,
  ConflictResolutionRequestSchema,
  ConflictYoursSourceEvidenceSchema,
  ConflictYoursSourceSchema,
  cmsEditorialRoutePolicies,
} from './index';

// The record fixtures are built in beforeAll because a record that already
// names the resolving revision id cannot honestly model an open conflict: the
// resolved envelope it would invent is exactly the coupling under test.
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const uuid4 = '123e4567-e89b-42d3-a456-426614174003';
// A free UUID that is deliberately never bound to a record, so a resolution
// test cannot pass by reusing an id the fixture already claimed.
const uuid5 = '123e4567-e89b-42d3-a456-426614174004';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
let pointer = '';
let openRevisionBound: Record<string, unknown> = {};
let openProposedBound: Record<string, unknown> = {};
let resolvedBound: Record<string, unknown> = {};

beforeAll(() => {
  pointer = '/fields/' + uuid3;
  openRevisionBound = {
    id: uuid,
    version: '4',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    entryId: uuid,
    baseRevisionId: uuid2,
    theirsRevisionId: uuid3,
    yoursRevisionId: uuid4,
    yoursSource: 'revision',
    proposedValues: null,
    proposedValuesHash: null,
    changedPaths: [pointer],
    baseHash: hash,
    theirsHash: hash,
    yoursHash: hash,
    conflictHash: hash,
    resolvedRevisionId: null,
    resolvedByPersonId: null,
    resolvedAt: null,
  };
  openProposedBound = {
    ...openRevisionBound,
    yoursRevisionId: null,
    yoursSource: 'proposed',
    proposedValues: { [uuid3]: 1 },
    proposedValuesHash: hash,
  };
  resolvedBound = {
    ...openRevisionBound,
    state: 'resolved',
    resolvedRevisionId: uuid5,
    resolvedByPersonId: uuid2,
    resolvedAt: instant,
  };
});

/** nest(0) is one object level, so nest(n) carries JSON depth n + 1. */
const nest = (levels: number): Record<string, unknown> =>
  levels === 0 ? { leaf: 1 } : { child: nest(levels - 1) };

describe('ConflictYoursSource and ConflictRecordState vocabularies', () => {
  it('accepts exactly revision and proposed as the yours source', () => {
    for (const source of ['revision', 'proposed'])
      expect(ConflictYoursSourceSchema.safeParse(source).success).toBe(true);
    for (const source of ['both', 'none', 'local', ''])
      expect(ConflictYoursSourceSchema.safeParse(source).success).toBe(false);
  });

  it('accepts exactly open, resolved, and superseded as the record state', () => {
    for (const state of ['open', 'resolved', 'superseded'])
      expect(ConflictRecordStateSchema.safeParse(state).success).toBe(true);
    for (const state of ['pending', 'closed', 'draft', ''])
      expect(ConflictRecordStateSchema.safeParse(state).success).toBe(false);
  });

  it('binds the yours-side evidence branches to the canonical source vocabulary', () => {
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'revision',
        yoursRevisionId: uuid4,
      }).success,
    ).toBe(true);
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'proposed',
        yoursRevisionId: null,
        proposedValuesHash: hash,
      }).success,
    ).toBe(true);
    // No literal outside the canonical source set may open an evidence branch.
    for (const source of ['both', 'none', 'local', '']) {
      expect(ConflictYoursSourceSchema.safeParse(source).success).toBe(false);
      expect(
        ConflictYoursSourceEvidenceSchema.safeParse({
          source,
          yoursRevisionId: null,
          proposedValuesHash: hash,
        }).success,
      ).toBe(false);
    }
  });
});

describe('ConflictRecordResourceSchema yours-source coupling', () => {
  it('accepts an open revision-bound record', () => {
    expect(
      ConflictRecordResourceSchema.safeParse(openRevisionBound).success,
    ).toBe(true);
  });

  it('accepts an open proposed-bound record with bounded values and a hash', () => {
    expect(
      ConflictRecordResourceSchema.safeParse(openProposedBound).success,
    ).toBe(true);
  });

  it('rejects a proposed record that also names a revision id', () => {
    const result = ConflictRecordResourceSchema.safeParse({
      ...openProposedBound,
      yoursRevisionId: uuid4,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'yoursSource must bind to exactly one of yoursRevisionId or bounded proposedValues/hash',
      );
  });

  it('rejects a proposed record missing either the values or the hash', () => {
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openProposedBound,
        proposedValues: null,
      }).success,
    ).toBe(false);
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openProposedBound,
        proposedValuesHash: null,
      }).success,
    ).toBe(false);
  });

  it('rejects a revision record that also carries proposed values or hash', () => {
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        proposedValues: { [uuid3]: 1 },
      }).success,
    ).toBe(false);
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        proposedValuesHash: hash,
      }).success,
    ).toBe(false);
  });

  it('rejects a record that binds neither branch', () => {
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        yoursRevisionId: null,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown keys rather than ignoring divergent evidence', () => {
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        yoursProposedValuesHash: hash,
      }).success,
    ).toBe(false);
  });
});

describe('ConflictRecordResourceSchema resolved envelope', () => {
  it('accepts a fully populated resolved envelope', () => {
    expect(ConflictRecordResourceSchema.safeParse(resolvedBound).success).toBe(
      true,
    );
  });

  it('rejects a resolved record that leaves any resolution field null', () => {
    for (const field of [
      'resolvedRevisionId',
      'resolvedByPersonId',
      'resolvedAt',
    ] as const)
      expect(
        ConflictRecordResourceSchema.safeParse({
          ...resolvedBound,
          [field]: null,
        }).success,
      ).toBe(false);
  });

  it('rejects an open or superseded record that carries resolution fields', () => {
    for (const state of ['open', 'superseded'] as const)
      expect(
        ConflictRecordResourceSchema.safeParse({
          ...openRevisionBound,
          state,
          resolvedRevisionId: uuid5,
          resolvedByPersonId: uuid2,
          resolvedAt: instant,
        }).success,
      ).toBe(false);
  });
});

describe('ConflictRecordResourceSchema changed paths and envelope bounds', () => {
  it('requires 1-128 unique JSON Pointers', () => {
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        changedPaths: [],
      }).success,
    ).toBe(false);
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        changedPaths: Array.from(
          { length: 129 },
          (_, index) => '/fields/' + uuid3 + String(index),
        ),
      }).success,
    ).toBe(false);
  });

  it('keeps the meta envelope at id, version, timestamps, and state', () => {
    expect(
      ConflictRecordResourceSchema.safeParse(openRevisionBound).success,
    ).toBe(true);
    expect(
      ConflictRecordResourceSchema.safeParse({
        ...openRevisionBound,
        version: '4.5',
      }).success,
    ).toBe(false);
  });

  it('caps proposed values at 128 keys, 8 levels, and 256 KiB', () => {
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => ['k' + index, index]),
    );
    const tooDeep = { [uuid3]: nest(7) };
    const tooLarge = Object.fromEntries(
      Array.from({ length: 128 }, (_, index) => [
        'k' + String(index).padStart(3, '0'),
        'x'.repeat(3_000),
      ]),
    );
    for (const proposedValues of [tooManyKeys, tooDeep, tooLarge])
      expect(
        ConflictRecordProposedValuesSchema.safeParse(proposedValues).success,
      ).toBe(false);
    expect(
      ConflictRecordProposedValuesSchema.safeParse({ [uuid3]: nest(6) })
        .success,
    ).toBe(true);
  });
});

describe('proposedValues is persisted-only and reachable from no route', () => {
  it('is referenced by no route policy request or success schema', () => {
    const referenced = cmsEditorialRoutePolicies.flatMap((policy) => [
      policy.requestSchema,
      policy.successSchema,
    ]);
    expect(referenced).not.toContain('ConflictRecordResourceSchema');
    expect(
      cmsEditorialRoutePolicies.every(
        (policy) => !policy.requestSchema.includes('ConflictRecord'),
      ),
    ).toBe(true);
  });

  it('cannot be injected through the conflict resolution request', () => {
    const request = {
      entryId: uuid,
      conflictId: uuid2,
      baseRevision: '3',
      choices: [{ path: pointer, choice: 'theirs' }],
      expectedVersion: '7',
    } as const;
    expect(ConflictResolutionRequestSchema.safeParse(request).success).toBe(
      true,
    );
    for (const injected of [
      { proposedValues: { [uuid3]: 1 } },
      { proposedValuesHash: hash },
      { yoursSource: 'proposed' },
      { yoursRevisionId: uuid4 },
    ])
      expect(
        ConflictResolutionRequestSchema.safeParse({ ...request, ...injected })
          .success,
      ).toBe(false);
  });
});
