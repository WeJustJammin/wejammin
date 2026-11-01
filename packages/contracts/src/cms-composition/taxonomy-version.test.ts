import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issueMessages,
  issuePaths,
  resourceMeta,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  TaxonomyVersionApiRequestSchema,
  TaxonomyVersionHeadersSchema,
  TaxonomyVersionRequestSchema,
  TaxonomyVersionResourceSchema,
  TaxonomyVersionsApiRequestSchema,
  TaxonomyVersionsPageSchema,
} from './taxonomy-version';

const request = {
  taxonomyKey: 'genre-tags',
  shape: 'hierarchical',
  allowedTypeKeys: ['profile', 'event'],
  allowedFieldKeys: ['genres'],
  canonicalOverlapDomains: ['role'],
  expectedVersion: null,
} as const;
const headers = {
  contentType: 'application/json',
  idempotencyKey: 'taxonomy-create-0001',
} as const;
const resource = {
  ...resourceMeta,
  state: 'draft',
  taxonomyId: uid(130),
  taxonomyKey: 'genre-tags',
  taxonomyVersion: 1,
  shape: 'hierarchical',
  allowedTypeKeys: ['profile', 'event'],
  allowedFieldKeys: ['genres'],
  canonicalOverlapDomains: ['role'],
} as const;

const keys = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

describe('CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135)', () => {
  it('[P2-S12-AC-124] accepts the exact draft request for a first version and for a successor', () => {
    expect(TaxonomyVersionRequestSchema.parse(request)).toEqual(request);
    expect(
      TaxonomyVersionRequestSchema.parse({ ...request, expectedVersion: '3' })
        .expectedVersion,
    ).toBe('3');
    expect(
      TaxonomyVersionRequestSchema.safeParse({
        ...request,
        shape: 'flat',
        canonicalOverlapDomains: [],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-125] bounds the vocabulary key to ^[a-z][a-z0-9-]{1,63}$ and reserves none', () => {
    for (const taxonomyKey of [
      'ab',
      `a${'b'.repeat(63)}`,
      'context',
      'selector',
      'new',
    ])
      expect(
        TaxonomyVersionRequestSchema.safeParse({ ...request, taxonomyKey })
          .success,
      ).toBe(true);
    for (const taxonomyKey of [
      '',
      'a',
      `a${'b'.repeat(64)}`,
      'Bad',
      'a_b',
      '1ab',
      ' ab',
    ])
      expect(
        issuePaths(TaxonomyVersionRequestSchema, { ...request, taxonomyKey }),
      ).toEqual(['taxonomyKey']);
  });

  it('[P2-S12-AC-125] closes the shape to flat or hierarchical', () => {
    for (const shape of ['graph', 'Flat', '', 'tree'])
      expect(
        isRefused(TaxonomyVersionRequestSchema, { ...request, shape }),
      ).toBe(true);
    expect(
      isRefused(TaxonomyVersionRequestSchema, without(request, 'shape')),
    ).toBe(true);
  });

  it('[P2-S12-AC-125] bounds the allowlists at 1 to 64 unique keys of the type and field key grammar', () => {
    for (const member of ['allowedTypeKeys', 'allowedFieldKeys'] as const) {
      expect(
        TaxonomyVersionRequestSchema.safeParse({
          ...request,
          [member]: keys('k', 64),
        }).success,
      ).toBe(true);
      for (const value of [
        [],
        keys('k', 65),
        ['Bad'],
        ['a'],
        ['has-dash'],
        ['1abc'],
        [`a${'b'.repeat(64)}`],
        ['ok', 'ok'],
      ])
        expect(
          issuePaths(TaxonomyVersionRequestSchema, {
            ...request,
            [member]: value,
          }).some((path) => path.startsWith(member)),
          `${member} ${JSON.stringify(value).slice(0, 40)}`,
        ).toBe(true);
    }
    expect(
      issueMessages(TaxonomyVersionRequestSchema, {
        ...request,
        allowedTypeKeys: ['ok', 'ok'],
      }),
    ).toEqual(['type_key_duplicate']);
    expect(
      issueMessages(TaxonomyVersionRequestSchema, {
        ...request,
        allowedFieldKeys: ['ok', 'ok'],
      }),
    ).toEqual(['field_key_duplicate']);
  });

  it('[P2-S12-AC-125] accepts 0 to 6 unique members of the six canonical domains', () => {
    const all = [
      'role',
      'instrument',
      'gear',
      'place',
      'rights',
      'jurisdiction',
    ];
    expect(
      TaxonomyVersionRequestSchema.safeParse({
        ...request,
        canonicalOverlapDomains: all,
      }).success,
    ).toBe(true);
    for (const canonicalOverlapDomains of [
      [...all, 'role'],
      ['role', 'role'],
      ['genre'],
      ['Role'],
      [''],
      'role',
      null,
    ])
      expect(
        isRefused(TaxonomyVersionRequestSchema, {
          ...request,
          canonicalOverlapDomains,
        }),
      ).toBe(true);
    expect(
      issueMessages(TaxonomyVersionRequestSchema, {
        ...request,
        canonicalOverlapDomains: ['role', 'role'],
      }),
    ).toEqual(['canonical_domain_duplicate']);
    // A declared domain with no registered provider is accepted at create.
    expect(
      TaxonomyVersionRequestSchema.safeParse({
        ...request,
        canonicalOverlapDomains: ['jurisdiction'],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-127] takes expectedVersion as null or a positive decimal and refuses any ownership or computed member', () => {
    for (const expectedVersion of ['0', '01', 1, '', undefined])
      expect(
        isRefused(TaxonomyVersionRequestSchema, {
          ...request,
          expectedVersion,
        }),
      ).toBe(true);
    for (const extra of [
      { ownerId: uid(1) },
      { taxonomyId: uid(1) },
      { state: 'active' },
      { taxonomyVersion: 2 },
      { terms: [] },
    ])
      expect(
        isRefused(TaxonomyVersionRequestSchema, { ...request, ...extra }),
      ).toBe(true);
  });

  it('[P2-S12-AC-127] ties If-Match to expectedVersion: absent on a first version, equal on a successor', () => {
    expect(TaxonomyVersionHeadersSchema.parse(headers)).toEqual(headers);
    expect(
      TaxonomyVersionHeadersSchema.safeParse({ ...headers, ifMatch: '"3"' })
        .success,
    ).toBe(true);
    for (const candidate of [
      { ...headers, ifMatch: 'W/"3"' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, contentType: 'text/plain' },
    ])
      expect(isRefused(TaxonomyVersionHeadersSchema, candidate)).toBe(true);
    const edit = { ...request, expectedVersion: '3' };
    expect(
      TaxonomyVersionApiRequestSchema.safeParse({ headers, body: request })
        .success,
    ).toBe(true);
    expect(
      TaxonomyVersionApiRequestSchema.safeParse({
        headers: { ...headers, ifMatch: '"3"' },
        body: edit,
      }).success,
    ).toBe(true);
    for (const candidate of [
      { headers, body: edit },
      { headers: { ...headers, ifMatch: '"4"' }, body: edit },
      { headers: { ...headers, ifMatch: '"3"' }, body: request },
    ])
      expect(issuePaths(TaxonomyVersionApiRequestSchema, candidate)).toEqual([
        'headers.ifMatch',
      ]);
  });
});

describe('TaxonomyVersionResource and cmsTaxonomyVersionsRead', () => {
  it('[P2-S12-AC-124] accepts the closed draft resource with its allowlists and declared domains', () => {
    expect(TaxonomyVersionResourceSchema.parse(resource)).toEqual(resource);
    for (const extra of [
      { ownerId: uid(1) },
      { terms: [] },
      { signature: 'x' },
    ])
      expect(
        isRefused(TaxonomyVersionResourceSchema, { ...resource, ...extra }),
      ).toBe(true);
  });

  it('[P2-S12-AC-124] shows exactly the eight definition states and a positive taxonomy version', () => {
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
        TaxonomyVersionResourceSchema.safeParse({ ...resource, state }).success,
      ).toBe(true);
    for (const candidate of [
      { ...resource, state: 'published' },
      { ...resource, taxonomyVersion: 0 },
      { ...resource, taxonomyVersion: 1.5 },
      { ...resource, shape: 'graph' },
      { ...resource, taxonomyId: 'x' },
      { ...resource, taxonomyKey: 'Bad' },
      { ...resource, allowedTypeKeys: [] },
      { ...resource, allowedFieldKeys: keys('k', 65) },
      { ...resource, canonicalOverlapDomains: ['role', 'role'] },
      { ...resource, canonicalOverlapDomains: ['genre'] },
      without(resource, 'taxonomyId'),
      without(resource, 'canonicalOverlapDomains'),
    ])
      expect(isRefused(TaxonomyVersionResourceSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-178] accepts only a UUID lineage taxonomyId path', () => {
    expect(
      TaxonomyVersionsApiRequestSchema.parse({ taxonomyId: uid(130) }),
    ).toEqual({ taxonomyId: uid(130) });
    for (const candidate of [
      {},
      { taxonomyId: 'genre-tags' },
      { taxonomyId: uid(130), query: {} },
      { taxonomyId: uid(130), ownerId: uid(1) },
    ])
      expect(isRefused(TaxonomyVersionsApiRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-177] lists at most 50 versions of one vocabulary, newest first, with a page version', () => {
    const versions = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...resource,
        id: uid(1000 + index),
        taxonomyVersion: count - index,
      }));
    expect(
      TaxonomyVersionsPageSchema.safeParse({ items: [], pageVersion: '1' })
        .success,
    ).toBe(true);
    expect(
      TaxonomyVersionsPageSchema.safeParse({
        items: versions(50),
        pageVersion: '7',
      }).success,
    ).toBe(true);
    expect(
      isRefused(TaxonomyVersionsPageSchema, {
        items: versions(51),
        pageVersion: '7',
      }),
    ).toBe(true);
    // Oldest first, a repeated version and a second vocabulary are not a version history.
    const [newest, older] = versions(2);
    for (const items of [
      [older, newest],
      [newest, { ...older, taxonomyVersion: newest?.taxonomyVersion }],
      [newest, { ...older, taxonomyId: uid(131) }],
    ])
      expect(
        issuePaths(TaxonomyVersionsPageSchema, { items, pageVersion: '7' }),
      ).toEqual(['items.1']);
    for (const candidate of [
      { items: [], pageVersion: '0' },
      { items: [], pageVersion: 7 },
      { items: [] },
      { pageVersion: '1' },
      { items: [], pageVersion: '1', nextCursor: null },
    ])
      expect(isRefused(TaxonomyVersionsPageSchema, candidate)).toBe(true);
  });
});
