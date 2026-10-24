import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CMS_CANONICAL_DOMAINS,
  CMS_DEFINITION_VERSION_STATES,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsTaxonomyKeySchema,
  TaxonomyShapeSchema,
  cmsCompositionCatalogCode,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_DOMAINS,
  CANONICAL_DOMAIN_LABEL,
  CANONICAL_DOMAIN_PROVIDER_BUILT,
  TAXONOMY_CATALOG_CODES,
  TAXONOMY_DEFINITION_STATES,
  TAXONOMY_KEY_REGEX,
  TAXONOMY_REASON_STATUS,
  TAXONOMY_SHAPES,
  taxonomyReason,
} from './taxonomy-vocabulary';

describe('taxonomy vocabulary mirrors the generated contract', () => {
  it('has the contract shapes and canonical domains in order', () => {
    expect([...TAXONOMY_SHAPES]).toEqual([...TaxonomyShapeSchema.options]);
    expect([...CANONICAL_DOMAINS]).toEqual([...CMS_CANONICAL_DOMAINS]);
    expect(Object.keys(CANONICAL_DOMAIN_LABEL)).toEqual([
      ...CMS_CANONICAL_DOMAINS,
    ]);
    expect(Object.keys(CANONICAL_DOMAIN_PROVIDER_BUILT)).toEqual([
      ...CMS_CANONICAL_DOMAINS,
    ]);
  });

  it('has the contract definition lifecycle', () => {
    expect([...TAXONOMY_DEFINITION_STATES]).toEqual([
      ...CMS_DEFINITION_VERSION_STATES,
    ]);
  });

  it('has the taxonomy catalog code of every status', () => {
    for (const status of [
      400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
    ])
      expect(TAXONOMY_CATALOG_CODES[status]).toBe(
        cmsCompositionCatalogCode('CMS-03C-16', status),
      );
    expect(Object.keys(TAXONOMY_CATALOG_CODES)).toHaveLength(12);
  });

  it('accepts and refuses the same vocabulary keys as the contract', () => {
    const samples = [
      'a',
      'ab',
      'a1',
      'a-b',
      'a_b',
      'A',
      '1a',
      '-a',
      'a-',
      'ab\n',
      '\nab',
      'a b',
      'é1',
      'a'.repeat(64),
      'a'.repeat(65),
      '',
      'instruments',
    ];
    expect(TAXONOMY_KEY_REGEX.source).toBe('^[a-z][a-z0-9-]{1,63}$');
    expect(TAXONOMY_KEY_REGEX.flags).toBe('u');
    for (const sample of samples)
      expect(TAXONOMY_KEY_REGEX.test(sample), JSON.stringify(sample)).toBe(
        CmsTaxonomyKeySchema.safeParse(sample).success,
      );
  });
});

describe('taxonomy reason tokens', () => {
  it('lists exactly the tokens the contract publishes per operation, each on its one status', () => {
    for (const operation of ['CMS-03C-16', 'CMS-03C-03'] as const) {
      const published = CMS_SLICE_12_OPERATION_REASONS[operation];
      for (const token of published)
        expect(
          taxonomyReason(operation, token, TAXONOMY_REASON_STATUS[token]),
          `${operation} ${token}`,
        ).toBe(token);
    }
    expect(Object.keys(TAXONOMY_REASON_STATUS).sort()).toEqual(
      [
        ...new Set([
          ...CMS_SLICE_12_OPERATION_REASONS['CMS-03C-03'],
          ...CMS_SLICE_12_OPERATION_REASONS['CMS-03C-16'],
        ]),
      ].sort(),
    );
  });

  it('accepts a token only for its operation and its own status', () => {
    expect(taxonomyReason('CMS-03C-16', 'capability_missing', 403)).toBe(
      'capability_missing',
    );
    expect(taxonomyReason('CMS-03C-16', 'capability_missing', 409)).toBeNull();
    expect(taxonomyReason('CMS-03C-16', 'taxonomy_not_active', 409)).toBeNull();
    expect(taxonomyReason('CMS-03C-03', 'taxonomy_not_active', 409)).toBe(
      'taxonomy_not_active',
    );
    expect(taxonomyReason('CMS-03C-03', 'canonical_overlap', 422)).toBe(
      'canonical_overlap',
    );
    expect(
      taxonomyReason('CMS-03C-03', 'canonical_source_unavailable', 409),
    ).toBeNull();
    expect(taxonomyReason('CMS-03C-03', 'CAPABILITY_REQUIRED', 403)).toBeNull();
    expect(taxonomyReason('CMS-03C-03', 'toString', 403)).toBeNull();
    expect(taxonomyReason('CMS-03C-03', 7, 403)).toBeNull();
  });
});

describe('canonical domain provider availability (FE03 :886)', () => {
  const MIGRATIONS = fileURLToPath(
    new URL('../../../../../supabase/migrations/', import.meta.url),
  );

  it('mirrors the release seed of the provider registry: only role is built', () => {
    const seed = readFileSync(
      `${MIGRATIONS}20261013300100_cms_canonical_domain_registry.sql`,
      'utf8',
    );
    const rows = [
      ...seed.matchAll(
        /^\s*\('([a-z]+)', '(built|unbuilt)', (?:'[^']*'|null)/gmu,
      ),
    ].map((match) => [match[1], match[2]]);
    expect(rows.map(([domain]) => domain)).toEqual([...CMS_CANONICAL_DOMAINS]);
    expect(
      Object.fromEntries(
        rows.map(([domain, state]) => [domain, state === 'built']),
      ),
    ).toEqual(CANONICAL_DOMAIN_PROVIDER_BUILT);
  });

  it('is the only migration that registers a provider, so a newer registry row fails this guard', () => {
    const writers = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith('.sql'))
      .filter((name) =>
        /insert\s+into\s+platform_private\.cms_canonical_domain_registry/iu.test(
          readFileSync(`${MIGRATIONS}${name}`, 'utf8'),
        ),
      );
    expect(writers).toEqual([
      '20261013300100_cms_canonical_domain_registry.sql',
    ]);
  });
});
