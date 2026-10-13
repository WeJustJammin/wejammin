import { describe, expect, it } from 'vitest';

import {
  CMS_CANONICAL_DOMAINS,
  CanonicalDomainSchema,
  CanonicalTaxonomyMatchRequestSchema,
  CanonicalTaxonomyMatchResultSchema,
} from './canonical-taxonomy-match';

const canonicalId = '123e4567-e89b-42d3-a456-426614174000';

const rejected = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  candidate: unknown,
): boolean => !schema.safeParse(candidate).success;

describe('CMS-03C-18 canonical taxonomy match contract (D10, DEC-135)', () => {
  it('[P2-S12-AC-136] closes the canonical domains to exactly role, instrument, gear, place, rights and jurisdiction', () => {
    expect([...CMS_CANONICAL_DOMAINS]).toEqual([
      'role',
      'instrument',
      'gear',
      'place',
      'rights',
      'jurisdiction',
    ]);
    for (const domain of CMS_CANONICAL_DOMAINS)
      expect(CanonicalDomainSchema.safeParse(domain).success).toBe(true);
    for (const domain of ['genre', 'Role', 'roles', '', 'person'])
      expect(CanonicalDomainSchema.safeParse(domain).success).toBe(false);
  });

  it('[P2-S12-AC-136] accepts one domain with 1 to 64 candidates of 1 to 160 characters', () => {
    const request = { domain: 'role', candidates: ['Guitarist'] };
    expect(CanonicalTaxonomyMatchRequestSchema.parse(request)).toEqual(request);
    const maximal = {
      domain: 'jurisdiction',
      candidates: Array.from({ length: 64 }, (_, index) =>
        index === 0 ? 'x'.repeat(160) : `candidate ${index}`,
      ),
    };
    expect(CanonicalTaxonomyMatchRequestSchema.safeParse(maximal).success).toBe(
      true,
    );
  });

  it('[P2-S12-AC-137] refuses zero or 65 candidates, an empty or 161-character candidate and a non-string candidate', () => {
    for (const candidate of [
      { domain: 'role', candidates: [] },
      {
        domain: 'role',
        candidates: Array.from({ length: 65 }, (_, index) => `c${index}`),
      },
      { domain: 'role', candidates: [''] },
      { domain: 'role', candidates: ['x'.repeat(161)] },
      { domain: 'role', candidates: [1] },
      { domain: 'role', candidates: 'Guitarist' },
      { domain: 'role' },
      { candidates: ['Guitarist'] },
    ])
      expect(rejected(CanonicalTaxonomyMatchRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-137] refuses a second domain, an unknown domain and any unknown member', () => {
    for (const candidate of [
      { domain: ['role', 'gear'], candidates: ['x'] },
      { domain: 'genre', candidates: ['x'] },
      { domain: 'role', candidates: ['x'], locale: 'en' },
      { domain: 'role', candidates: ['x'], fuzzy: true },
    ])
      expect(rejected(CanonicalTaxonomyMatchRequestSchema, candidate)).toBe(
        true,
      );
  });

  it('[P2-S12-AC-136] returns the discriminated no_match, match or source_unavailable result', () => {
    const noMatch = { outcome: 'no_match' };
    const match = {
      outcome: 'match',
      domain: 'role',
      canonicalId,
      canonicalKind: 'role.facet',
    };
    const unavailable = { outcome: 'source_unavailable', domain: 'gear' };
    for (const result of [noMatch, match, unavailable])
      expect(CanonicalTaxonomyMatchResultSchema.parse(result)).toEqual(result);
  });

  it('[P2-S12-AC-140] refuses a result that mixes outcomes, omits its members or carries an extra one', () => {
    for (const candidate of [
      {},
      { outcome: 'unknown' },
      { outcome: 'no_match', domain: 'role' },
      { outcome: 'match', domain: 'role', canonicalId },
      { outcome: 'match', canonicalId, canonicalKind: 'role.facet' },
      {
        outcome: 'match',
        domain: 'genre',
        canonicalId,
        canonicalKind: 'role.facet',
      },
      {
        outcome: 'match',
        domain: 'role',
        canonicalId: 'not-a-uuid',
        canonicalKind: 'role.facet',
      },
      {
        outcome: 'match',
        domain: 'role',
        canonicalId,
        canonicalKind: 'Role Facet',
      },
      {
        outcome: 'match',
        domain: 'role',
        canonicalId,
        canonicalKind: `a${'b'.repeat(96)}`,
      },
      {
        outcome: 'match',
        domain: 'role',
        canonicalId,
        canonicalKind: 'role.facet',
        label: 'Guitarist',
      },
      { outcome: 'source_unavailable' },
      { outcome: 'source_unavailable', domain: 'gear', canonicalId },
    ])
      expect(rejected(CanonicalTaxonomyMatchResultSchema, candidate)).toBe(
        true,
      );
    // canonicalKind: first character plus up to 95 more is the boundary.
    expect(
      CanonicalTaxonomyMatchResultSchema.safeParse({
        outcome: 'match',
        domain: 'role',
        canonicalId,
        canonicalKind: `a${'b'.repeat(95)}`,
      }).success,
    ).toBe(true);
  });
});
