import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issueMessages,
  issuePaths,
  without,
} from './composition-fixtures.test-support';
import {
  CompositionInstanceResourceSchema,
  PatternInstanceApiRequestSchema,
  PatternInstanceHeadersSchema,
  PatternInstanceRequestSchema,
  PatternPlacementResourceSchema,
} from './pattern-instance';

const REVISION_ID = '10000000-0000-4000-8000-000000000001';
const PATTERN_ID = '20000000-0000-4000-8000-000000000002';
const INSTANCE_ID = '30000000-0000-4000-8000-000000000003';
const HASH = 'a'.repeat(64);

const request = {
  revisionId: REVISION_ID,
  patternId: PATTERN_ID,
  patternVersion: 2,
  linkMode: 'linked',
  slotPath: '/header/0',
  overrides: { '/title': { text: 'Example' } },
  blockRegistryDigest: HASH,
  expectedVersion: '3',
};
const resource = {
  id: INSTANCE_ID,
  version: '4',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  revisionId: REVISION_ID,
  path: '/header/0',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 2,
  patternId: PATTERN_ID,
  patternVersion: 2,
  blockRegistryDigest: HASH,
  linkMode: 'linked',
  conflictState: null,
};

describe('CMS-03C-02 pattern-instance wire contract', () => {
  it('accepts a bounded linked request and optional digest omission', () => {
    expect(PatternInstanceRequestSchema.parse(request)).toEqual(request);
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { '/optional': null, '/items': [1, { title: 'Safe' }] },
      }).success,
    ).toBe(true);
    const withoutDigest = { ...request, linkMode: 'detached' };
    delete (withoutDigest as Partial<typeof withoutDigest>).blockRegistryDigest;
    expect(PatternInstanceRequestSchema.parse(withoutDigest)).toEqual(
      withoutDigest,
    );
  });

  it('rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest', () => {
    for (const candidate of [
      { ...request, actorId: REVISION_ID },
      { ...request, revisionId: 'not-a-uuid' },
      { ...request, patternId: 'not-a-uuid' },
      { ...request, patternVersion: 0 },
      { ...request, patternVersion: 1.5 },
      { ...request, linkMode: 'implicit' },
      { ...request, slotPath: 'header/0' },
      { ...request, slotPath: '/header\nprivate' },
      { ...request, slotPath: `/${'x'.repeat(512)}` },
      { ...request, blockRegistryDigest: HASH.toUpperCase() },
      { ...request, expectedVersion: '0' },
    ])
      expect(PatternInstanceRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('[P2-S12-AC-028] bounds the slot path at 1 to 512 characters with no control character', () => {
    for (const slotPath of ['/', '/a', `/${'x'.repeat(511)}`])
      expect(
        PatternInstanceRequestSchema.safeParse({ ...request, slotPath })
          .success,
      ).toBe(true);
    for (const slotPath of [
      '',
      `/${'x'.repeat(512)}`,
      '/a\u0000b',
      '/a\u001fb',
    ])
      expect(
        isRefused(PatternInstanceRequestSchema, { ...request, slotPath }),
      ).toBe(true);
  });

  it('[P2-S12-AC-027] bounds the pattern version at a positive int32', () => {
    for (const patternVersion of [1, 2_147_483_647])
      expect(
        PatternInstanceRequestSchema.safeParse({ ...request, patternVersion })
          .success,
      ).toBe(true);
    for (const patternVersion of [0, -1, 1.5, 2_147_483_648])
      expect(
        isRefused(PatternInstanceRequestSchema, { ...request, patternVersion }),
      ).toBe(true);
  });

  it('bounds override key count, names, JSON depth, and non-JSON values', () => {
    const keys = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`/field${index}`, index]),
      );
    let tooDeep: unknown = 'leaf';
    for (let index = 0; index < 9; index += 1) tooDeep = { child: tooDeep };
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: keys(64),
      }).success,
    ).toBe(true);
    for (const overrides of [
      keys(65),
      { [`/${'x'.repeat(512)}`]: true },
      { '/nested': tooDeep },
      { '/bad': Number.NaN },
    ])
      expect(
        PatternInstanceRequestSchema.safeParse({ ...request, overrides })
          .success,
      ).toBe(false);
  });

  it('counts the override root when enforcing the locked depth-eight limit', () => {
    let allowed: unknown = 'leaf';
    for (let index = 0; index < 7; index += 1) allowed = { child: allowed };
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { '/nested': allowed },
      }).success,
    ).toBe(true);
    const oneLevelTooDeep = { child: allowed };
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { '/nested': oneLevelTooDeep },
      }).success,
    ).toBe(false);
  });

  it('[P2-S12-AC-028] accepts only normalized node paths as override keys and reports any other key at /overrides', () => {
    for (const key of ['/hero', '/hero/title', '/a/b/c', `/${'a'.repeat(64)}`])
      expect(
        PatternInstanceRequestSchema.safeParse({
          ...request,
          overrides: { [key]: 1 },
        }).success,
      ).toBe(true);
    for (const key of [
      'title',
      '',
      '/',
      '/Title',
      '/hero/',
      '//hero',
      '/hero//title',
      '/hero/../title',
      '/hero title',
      '/1hero',
      `/${'a'.repeat(65)}`,
      '/aaaaaaaaaaaaaaaa'.repeat(31),
    ]) {
      const candidate = { ...request, overrides: { '/ok': 1, [key]: 1 } };
      expect(issuePaths(PatternInstanceRequestSchema, candidate), key).toEqual([
        'overrides',
      ]);
      expect(
        issueMessages(PatternInstanceRequestSchema, candidate),
        key,
      ).toEqual(['override_key_not_node_path']);
    }
    // The empty override set is the common case: no node is overridden.
    expect(
      PatternInstanceRequestSchema.safeParse({ ...request, overrides: {} })
        .success,
    ).toBe(true);
    expect(
      isRefused(PatternInstanceRequestSchema, without(request, 'overrides')),
    ).toBe(true);
  });

  it('requires canonical JSON, idempotency, and a strong successor validator', () => {
    expect(
      PatternInstanceHeadersSchema.parse({
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"3"',
      }),
    ).toMatchObject({ ifMatch: '"3"' });
    for (const headers of [
      {
        contentType: 'text/plain',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'short',
        ifMatch: '"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: 'W/"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"0"',
      },
    ])
      expect(PatternInstanceHeadersSchema.safeParse(headers).success).toBe(
        false,
      );
  });

  it('[P2-S12-AC-013] ties the strong If-Match to the entry aggregate expectedVersion in the transport view', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 'pattern-insert-0001',
      ifMatch: '"3"',
    };
    expect(
      PatternInstanceApiRequestSchema.safeParse({ headers, body: request })
        .success,
    ).toBe(true);
    expect(
      issuePaths(PatternInstanceApiRequestSchema, {
        headers: { ...headers, ifMatch: '"4"' },
        body: request,
      }),
    ).toEqual(['headers.ifMatch']);
  });

  it('accepts only the closed browser-safe composition resource', () => {
    expect(CompositionInstanceResourceSchema.parse(resource)).toEqual(resource);
    for (const candidate of [
      { ...resource, ownerId: PATTERN_ID },
      { ...resource, state: 'published' },
      { ...resource, version: '0' },
      { ...resource, path: '/header\nprivate' },
      { ...resource, blockKey: 'unregistered block' },
      { ...resource, blockVersion: 0 },
      { ...resource, patternVersion: 0 },
      { ...resource, conflictState: 'overwritten' },
      { ...resource, linkMode: 'implicit' },
      { ...resource, blockRegistryDigest: 'private' },
    ])
      expect(
        CompositionInstanceResourceSchema.safeParse(candidate).success,
      ).toBe(false);
  });

  it('[P2-S12-AC-218] carries the authored position as a required non-negative int32 on every row', () => {
    for (const position of [0, 1, 511, 2_147_483_647])
      expect(
        CompositionInstanceResourceSchema.safeParse({ ...resource, position })
          .success,
      ).toBe(true);
    for (const position of [-1, 1.5, 2_147_483_648, '0', null])
      expect(
        isRefused(CompositionInstanceResourceSchema, { ...resource, position }),
      ).toBe(true);
    expect(
      isRefused(
        CompositionInstanceResourceSchema,
        without(resource, 'position'),
      ),
    ).toBe(true);
  });
});

describe('PatternPlacementResource (CMS-03C-02 201, DEC-175, DEC-181)', () => {
  const row = (index: number) => ({
    ...resource,
    id: `30000000-0000-4000-8000-${String(100000 + index).padStart(12, '0')}`,
    path: `/header/0/root${index}`,
    position: index,
  });
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => row(i));

  it('[P2-S12-AC-010] answers an items list of one or more rows, at most 512 after expansion', () => {
    expect(PatternPlacementResourceSchema.parse({ items: rows(1) })).toEqual({
      items: rows(1),
    });
    for (const count of [2, 32, 33, 512])
      expect(
        PatternPlacementResourceSchema.safeParse({ items: rows(count) })
          .success,
        String(count),
      ).toBe(true);
    for (const candidate of [{ items: [] }, { items: rows(513) }])
      expect(isRefused(PatternPlacementResourceSchema, candidate)).toBe(true);
    // The old single-row body is no longer a placement.
    expect(isRefused(PatternPlacementResourceSchema, resource)).toBe(true);
    expect(
      isRefused(PatternPlacementResourceSchema, { items: rows(1), total: 1 }),
    ).toBe(true);
    expect(isRefused(PatternPlacementResourceSchema, {})).toBe(true);
  });

  it('[P2-S12-AC-010] holds every row to the closed CompositionInstanceResource', () => {
    expect(
      issuePaths(PatternPlacementResourceSchema, {
        items: [row(0), { ...row(1), ownerId: PATTERN_ID }],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      isRefused(PatternPlacementResourceSchema, {
        items: [row(0), { ...row(1), blockKey: 'Not A Key' }],
      }),
    ).toBe(true);
    expect(
      isRefused(PatternPlacementResourceSchema, {
        items: [row(0), without(row(1), 'position')],
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-218] places every row on one revision, one pinned pattern version and one link mode', () => {
    for (const change of [
      { revisionId: '10000000-0000-4000-8000-0000000000ff' },
      { patternId: '20000000-0000-4000-8000-0000000000ff' },
      { patternVersion: 9 },
      { linkMode: 'detached' },
    ])
      expect(
        issuePaths(PatternPlacementResourceSchema, {
          items: [row(0), { ...row(1), ...change }],
        }),
        JSON.stringify(change),
      ).toEqual(['items.1']);
  });

  it('[P2-S12-AC-218] gives every row its own path and consecutive positions in forest order', () => {
    expect(
      issuePaths(PatternPlacementResourceSchema, {
        items: [row(0), { ...row(1), path: row(0).path }],
      }),
    ).toEqual(['items.1.path']);
    expect(
      issuePaths(PatternPlacementResourceSchema, {
        items: [row(0), { ...row(1), position: 2 }],
      }),
    ).toEqual(['items.1.position']);
    expect(
      issuePaths(PatternPlacementResourceSchema, {
        items: [row(1), row(0)],
      }),
    ).toEqual(['items.1.position']);
    // Positions are appended after the slot's current maximum, so the first
    // row of a later placement may start above zero.
    expect(
      PatternPlacementResourceSchema.safeParse({
        items: [row(5), row(6), row(7)],
      }).success,
    ).toBe(true);
  });
});
