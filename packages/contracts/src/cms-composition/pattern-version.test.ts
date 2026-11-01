import { describe, expect, it } from 'vitest';

import {
  hash,
  instant,
  isRefused,
  issueMessages,
  issuePaths,
  resourceMeta,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  PatternLatestApiRequestSchema,
  PatternVersionApiRequestSchema,
  PatternVersionDetailSchema,
  PatternVersionHeadersSchema,
  PatternVersionRequestSchema,
  PatternVersionResourceSchema,
} from './pattern-version';

const tree = [
  {
    kind: 'block',
    key: 'hero',
    blockKey: 'profile.header',
    blockVersion: 1,
    props: { title: { text: 'Hello' } },
    children: [
      {
        kind: 'block',
        key: 'cta',
        blockKey: 'profile.action',
        blockVersion: 2,
        props: {},
        children: [],
      },
    ],
  },
  { kind: 'pattern', key: 'footer', patternId: uid(95), patternVersion: 3 },
] as const;

const request = {
  patternKey: 'hero-banner',
  compatibleTypeIds: [uid(91)],
  blockTree: tree,
  blockRegistryDigest: hash,
  expectedVersion: null,
} as const;

const headers = {
  contentType: 'application/json',
  idempotencyKey: 'pattern-create-0001',
} as const;

const resource = {
  ...resourceMeta,
  state: 'draft',
  patternId: uid(92),
  patternKey: 'hero-banner',
  patternVersion: 1,
  compatibleTypeIds: [uid(91)],
  nodeCount: 3,
  blockRegistryDigest: hash,
} as const;

describe('CMS-03C-12 pattern version request', () => {
  it('[P2-S12-AC-100] accepts the exact draft request for a first version and for a successor', () => {
    expect(PatternVersionRequestSchema.parse(request)).toEqual(request);
    expect(
      PatternVersionRequestSchema.parse({ ...request, expectedVersion: '4' })
        .expectedVersion,
    ).toBe('4');
    const withoutDigest = without(request, 'blockRegistryDigest');
    expect(PatternVersionRequestSchema.parse(withoutDigest)).toEqual(
      withoutDigest,
    );
  });

  it('[P2-S12-AC-189] refuses a reserved patternKey at /patternKey with key_reserved', () => {
    for (const patternKey of [
      'context',
      'versions',
      'selector',
      'nestable',
      'new',
    ]) {
      const candidate = { ...request, patternKey };
      expect(issuePaths(PatternVersionRequestSchema, candidate)).toEqual([
        'patternKey',
      ]);
      expect(issueMessages(PatternVersionRequestSchema, candidate)).toEqual([
        'key_reserved',
      ]);
    }
    expect(
      PatternVersionRequestSchema.safeParse({
        ...request,
        patternKey: 'selectors',
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-101] bounds compatibleTypeIds at 1 to 64 unique UUIDs', () => {
    expect(
      PatternVersionRequestSchema.safeParse({
        ...request,
        compatibleTypeIds: Array.from({ length: 64 }, (_, index) =>
          uid(500 + index),
        ),
      }).success,
    ).toBe(true);
    for (const compatibleTypeIds of [
      [],
      Array.from({ length: 65 }, (_, index) => uid(500 + index)),
      ['not-a-uuid'],
      [uid(91), uid(91)],
      [uid(91), uid(91).toUpperCase()],
    ])
      expect(
        issuePaths(PatternVersionRequestSchema, {
          ...request,
          compatibleTypeIds,
        }).some((path) => path.startsWith('compatibleTypeIds')),
      ).toBe(true);
  });

  it('[P2-S12-AC-101] requires a non-empty blockTree and reports a tree fault at its node', () => {
    expect(
      issuePaths(PatternVersionRequestSchema, { ...request, blockTree: [] }),
    ).toEqual(['blockTree']);
    expect(
      issuePaths(PatternVersionRequestSchema, {
        ...request,
        blockTree: [tree[0], tree[0]],
      }),
    ).toEqual(['blockTree.1.key']);
    expect(
      isRefused(PatternVersionRequestSchema, without(request, 'blockTree')),
    ).toBe(true);
  });

  it('[P2-S12-AC-103] takes expectedVersion as null or a positive decimal and the digest as an optional lowercase hash', () => {
    for (const expectedVersion of ['0', '01', 1, '-1', '', undefined])
      expect(
        isRefused(PatternVersionRequestSchema, { ...request, expectedVersion }),
      ).toBe(true);
    expect(
      isRefused(
        PatternVersionRequestSchema,
        without(request, 'expectedVersion'),
      ),
    ).toBe(true);
    for (const blockRegistryDigest of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      '',
      null,
    ])
      expect(
        issuePaths(PatternVersionRequestSchema, {
          ...request,
          blockRegistryDigest,
        }),
      ).toEqual(['blockRegistryDigest']);
  });

  it('[P2-S12-AC-100] refuses any member that carries owner, authority or a server-computed value', () => {
    for (const extra of [
      { ownerId: uid(1) },
      { patternId: uid(1) },
      { nodeCount: 3 },
      { state: 'active' },
      { patternVersion: 2 },
      { supersedesId: uid(1) },
    ])
      expect(
        isRefused(PatternVersionRequestSchema, { ...request, ...extra }),
      ).toBe(true);
  });
});

describe('CMS-03C-12 headers and transport', () => {
  it('[P2-S12-AC-103] requires JSON and a bounded key, with an exact strong If-Match only when editing', () => {
    expect(PatternVersionHeadersSchema.parse(headers)).toEqual(headers);
    expect(
      PatternVersionHeadersSchema.safeParse({ ...headers, ifMatch: '"4"' })
        .success,
    ).toBe(true);
    for (const candidate of [
      { ...headers, ifMatch: 'W/"4"' },
      { ...headers, ifMatch: '4' },
      { ...headers, ifMatch: '"0"' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, contentType: 'text/plain' },
      { ...headers, actorId: uid(1) },
    ])
      expect(isRefused(PatternVersionHeadersSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-103] ties If-Match to expectedVersion: absent on a first version, equal on a successor', () => {
    expect(
      PatternVersionApiRequestSchema.safeParse({ headers, body: request })
        .success,
    ).toBe(true);
    const edit = { ...request, expectedVersion: '4' };
    expect(
      PatternVersionApiRequestSchema.safeParse({
        headers: { ...headers, ifMatch: '"4"' },
        body: edit,
      }).success,
    ).toBe(true);
    // A successor without If-Match, with a different one, and a first version with one.
    for (const candidate of [
      { headers, body: edit },
      { headers: { ...headers, ifMatch: '"5"' }, body: edit },
      { headers: { ...headers, ifMatch: '"4"' }, body: request },
    ])
      expect(
        issuePaths(PatternVersionApiRequestSchema, candidate),
        JSON.stringify(candidate.headers),
      ).toEqual(['headers.ifMatch']);
    expect(isRefused(PatternVersionApiRequestSchema, { headers })).toBe(true);
  });
});

describe('PatternVersionResource and detail', () => {
  it('[P2-S12-AC-100] accepts the closed draft resource without any owner or release evidence', () => {
    expect(PatternVersionResourceSchema.parse(resource)).toEqual(resource);
    for (const extra of [
      { ownerId: uid(1) },
      { releaseDigest: hash },
      { signature: 'x' },
      { blockTree: [] },
    ])
      expect(
        isRefused(PatternVersionResourceSchema, { ...resource, ...extra }),
      ).toBe(true);
  });

  it('[P2-S12-AC-100] bounds nodeCount 1 to 512, compatibleTypeIds 1 to 64 and the patternVersion', () => {
    for (const nodeCount of [1, 512])
      expect(
        PatternVersionResourceSchema.safeParse({ ...resource, nodeCount })
          .success,
      ).toBe(true);
    for (const nodeCount of [0, 513, 1.5, -1, '3'])
      expect(
        isRefused(PatternVersionResourceSchema, { ...resource, nodeCount }),
      ).toBe(true);
    for (const candidate of [
      { ...resource, compatibleTypeIds: [] },
      {
        ...resource,
        compatibleTypeIds: Array.from({ length: 65 }, (_, index) =>
          uid(600 + index),
        ),
      },
      { ...resource, patternVersion: 0 },
      { ...resource, patternVersion: 1.5 },
      { ...resource, patternKey: 'context' },
      { ...resource, patternKey: 'Bad_Key' },
      { ...resource, patternId: 'x' },
      without(resource, 'patternId'),
      without(resource, 'nodeCount'),
      without(resource, 'blockRegistryDigest'),
    ])
      expect(isRefused(PatternVersionResourceSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-100] shows exactly the eight definition states', () => {
    for (const state of [
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
    ])
      expect(
        PatternVersionResourceSchema.safeParse({ ...resource, state }).success,
      ).toBe(true);
    for (const state of ['published', 'archived', 'open'])
      expect(
        isRefused(PatternVersionResourceSchema, { ...resource, state }),
      ).toBe(true);
  });

  it('[P2-S12-AC-171] adds the blockTree of 1 to 32 root nodes to the detail and keeps the tree rules', () => {
    const detail = { ...resource, blockTree: tree };
    expect(PatternVersionDetailSchema.parse(detail)).toEqual(detail);
    for (const candidate of [
      { ...resource, blockTree: [] },
      without(detail, 'blockTree'),
      { ...detail, blockTree: [tree[0], tree[0]] },
      { ...detail, ownerId: uid(1) },
      { ...detail, createdAt: instant.replace('Z', '') },
    ])
      expect(isRefused(PatternVersionDetailSchema, candidate)).toBe(true);
  });
});

describe('cmsPatternLatestRead path contract', () => {
  it('[P2-S12-AC-172] accepts only a grammar-valid, non-reserved path patternKey and no other member', () => {
    expect(
      PatternLatestApiRequestSchema.parse({ patternKey: 'hero-banner' }),
    ).toEqual({ patternKey: 'hero-banner' });
    for (const candidate of [
      { patternKey: 'context' },
      { patternKey: 'versions' },
      { patternKey: 'selector' },
      { patternKey: 'new' },
      { patternKey: 'Bad_Key' },
      { patternKey: '' },
      { patternKey: 'a' },
      { patternKey: 'hero-banner', ownerId: uid(1) },
      {},
    ])
      expect(isRefused(PatternLatestApiRequestSchema, candidate)).toBe(true);
  });
});
