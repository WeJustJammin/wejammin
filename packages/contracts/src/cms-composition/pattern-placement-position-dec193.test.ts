import { describe, expect, it } from 'vitest';

import {
  PatternPlacementResourceSchema,
  type CompositionInstanceResource,
} from './pattern-instance';

const REVISION_ID = '10000000-0000-4000-8000-000000000001';
const PATTERN_ID = '20000000-0000-4000-8000-000000000002';
const OTHER_ID = '90000000-0000-4000-8000-000000000009';
const HASH = 'a'.repeat(64);

const row = (
  index: number,
  position: number,
  version = '1',
): CompositionInstanceResource => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  version,
  contentHash: HASH,
  createdAt: '2026-10-16T12:00:00Z',
  updatedAt: '2026-10-16T12:00:00Z',
  state: 'active',
  revisionId: REVISION_ID,
  path: `/body/0/root${index}`,
  position,
  blockKey: 'text',
  blockVersion: 2,
  patternId: PATTERN_ID,
  patternVersion: 4,
  blockRegistryDigest: HASH,
  linkMode: 'linked',
  conflictState: null,
});

const rows = (
  positions: readonly number[],
  versions: readonly string[] = [],
): CompositionInstanceResource[] =>
  positions.map((position, index) =>
    row(index, position, versions[index] ?? '1'),
  );

const refusedAt = (
  value: unknown,
  path: readonly (string | number)[],
): void => {
  const result = PatternPlacementResourceSchema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: [...path] })]),
  );
};

describe('[DEC-193] placement response retains ordered path positions', () => {
  // BE03c:1485 permits retired-path positions plus new paths above the slot max.
  // Public rows carry no prior-state/slot history; the server proves allocation.
  it.each([
    ['retained and new paths', [1, 10], ['7', '1']],
    [
      'several retained paths and new tail',
      [1, 4, 10, 11],
      ['5', '3', '1', '1'],
    ],
    [
      'int32 endpoints and retained bigint row version',
      [0, 2_147_483_647],
      ['9223372036854775807', '1'],
    ],
  ] as const)(
    '[DEC-193-POS-01] accepts %s without renumbering positions or versions',
    (_label, positions, versions) => {
      const resource = { items: rows(positions, versions) };
      const parsed = PatternPlacementResourceSchema.parse(resource);
      expect(parsed).toEqual(resource);
      expect(parsed.items.map((item) => item.position)).toEqual([...positions]);
      expect(parsed.items.map((item) => item.version)).toEqual([...versions]);
    },
  );

  it.each(['linked', 'detached'] as const)(
    '[DEC-193-POS-02] retains consecutive placements in %s mode',
    (linkMode) => {
      const resource = {
        items: rows([9, 10, 11], ['4', '1', '1']).map((item) => ({
          ...item,
          linkMode,
        })),
      };
      expect(PatternPlacementResourceSchema.parse(resource)).toEqual(resource);
    },
  );

  it('[DEC-193-POS-03] accepts a single retained path above zero', () => {
    const resource = { items: [row(0, 10, '9007199254740993')] };
    expect(PatternPlacementResourceSchema.parse(resource)).toEqual(resource);
  });

  it.each([
    [[10, 1], 1],
    [[1, 10, 9], 2],
    [[3, 1, 2], 1],
  ] as const)(
    '[DEC-193-POS-04] refuses unsorted positions %j at row %s',
    (positions, index) => {
      refusedAt({ items: rows(positions) }, ['items', index, 'position']);
    },
  );

  it.each([
    [[1, 1], 1],
    [[1, 10, 10], 2],
  ] as const)(
    '[DEC-193-POS-05] refuses duplicate positions %j at row %s',
    (positions, index) => {
      refusedAt({ items: rows(positions) }, ['items', index, 'position']);
    },
  );

  // Consecutive controls isolate each refusal from the sparse-position defect.
  it.each([
    ['revision', { revisionId: OTHER_ID }],
    ['pattern identity', { patternId: OTHER_ID }],
    ['pattern version', { patternVersion: 5 }],
    ['nullable pattern identity', { patternId: null }],
    ['nullable pattern version', { patternVersion: null }],
    ['link mode', { linkMode: 'detached' }],
  ] as const)(
    '[DEC-193-POS-06] retains the common %s pin',
    (_label, change) => {
      refusedAt({ items: [row(0, 1, '7'), { ...row(1, 2), ...change }] }, [
        'items',
        1,
      ]);
    },
  );

  it.each(['path', 'id'] as const)(
    '[DEC-193-POS-07] refuses duplicate row %s',
    (field) => {
      const first = row(0, 1, '7');
      const second = { ...row(1, 2), [field]: first[field] };
      refusedAt({ items: [first, second] }, ['items', 1, field]);
    },
  );

  it.each(['id', 'revisionId', 'patternId'] as const)(
    '[DEC-193-POS-08] retains UUID validation for %s',
    (field) => {
      refusedAt(
        { items: [row(0, 1), { ...row(1, 2), [field]: 'not-a-uuid' }] },
        ['items', 1, field],
      );
    },
  );

  it.each(['', 'body/0/root1', '/body\nroot1', `/${'x'.repeat(512)}`])(
    '[DEC-193-POS-09] retains row path validation for %j',
    (path) => {
      refusedAt({ items: [row(0, 1), { ...row(1, 2), path }] }, [
        'items',
        1,
        'path',
      ]);
    },
  );

  it.each([-1, 1.5, 2_147_483_648, '2', null])(
    '[DEC-193-POS-10] retains non-negative int32 position validation for %j',
    (position) => {
      refusedAt({ items: [row(0, 1), { ...row(1, 2), position }] }, [
        'items',
        1,
        'position',
      ]);
    },
  );

  it.each([
    'id',
    'revisionId',
    'path',
    'position',
    'patternId',
    'patternVersion',
    'linkMode',
    'version',
  ])('[DEC-193-POS-11] requires row %s', (field) => {
    const missing: Record<string, unknown> = { ...row(1, 2) };
    Reflect.deleteProperty(missing, field);
    refusedAt({ items: [row(0, 1), missing] }, ['items', 1, field]);
  });

  it.each(['0', '-1', '01', '9223372036854775808', 1])(
    '[DEC-193-POS-12] retains lossless positive row-version validation for %s',
    (version) => {
      refusedAt({ items: [row(0, 1), { ...row(1, 2), version }] }, [
        'items',
        1,
        'version',
      ]);
    },
  );

  it.each([
    'ownerId',
    'sessionId',
    'signingKey',
    'previousState',
    'isNewPath',
    'priorPosition',
    'slotMaximum',
  ])('[DEC-193-POS-13] refuses unregistered row field %s', (field) => {
    refusedAt({ items: [row(0, 1), { ...row(1, 2), [field]: OTHER_ID }] }, [
      'items',
      1,
    ]);
  });

  it('[DEC-193-POS-14] preserves the closed placement wrapper', () => {
    const result = PatternPlacementResourceSchema.safeParse({
      items: rows([1, 2]),
      ownerId: OTHER_ID,
    });
    expect(result).toMatchObject({
      success: false,
      error: {
        issues: [{ path: [], code: 'unrecognized_keys', keys: ['ownerId'] }],
      },
    });
  });
});
