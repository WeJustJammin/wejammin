import { TaxonomyVersionRequestSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildTaxonomyVersionRequest,
  type TaxonomyDesignerFields,
} from './taxonomy-designer-request';

const fields = (
  overrides: Partial<TaxonomyDesignerFields> = {},
): TaxonomyDesignerFields => ({
  taxonomyKey: 'instruments',
  shape: 'hierarchical',
  typeKeys: ['article', 'profile'],
  fieldKeys: ['tags'],
  domains: ['role'],
  expectedVersion: null,
  ...overrides,
});
const issuesOf = (overrides: Partial<TaxonomyDesignerFields>) => {
  const built = buildTaxonomyVersionRequest(fields(overrides));
  if (built.ok) throw new Error('expected issues');
  return built.issues.map(({ code, field }) => [code, field]);
};

describe('buildTaxonomyVersionRequest', () => {
  it('builds exactly the contract request, with domains in canonical order', () => {
    const built = buildTaxonomyVersionRequest(
      fields({
        domains: ['jurisdiction', 'role', 'gear'],
        expectedVersion: '3',
      }),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({
      taxonomyKey: 'instruments',
      shape: 'hierarchical',
      allowedTypeKeys: ['article', 'profile'],
      allowedFieldKeys: ['tags'],
      canonicalOverlapDomains: ['role', 'gear', 'jurisdiction'],
      expectedVersion: '3',
    });
    expect(TaxonomyVersionRequestSchema.safeParse(built.value).success).toBe(
      true,
    );
    expect(built.body).toBe(JSON.stringify(built.value));
    expect(Object.keys(built.value)).toEqual(
      Object.keys(TaxonomyVersionRequestSchema.shape),
    );
  });

  it('accepts a vocabulary that declares no domain', () => {
    const built = buildTaxonomyVersionRequest(fields({ domains: [] }));
    expect(built.ok && built.value.canonicalOverlapDomains).toEqual([]);
  });

  it('trims the key and keeps the entry order of the allowlists', () => {
    const built = buildTaxonomyVersionRequest(
      fields({ taxonomyKey: '  moods ', typeKeys: ['profile', 'article'] }),
    );
    expect(built.ok && built.value.taxonomyKey).toBe('moods');
    expect(built.ok && built.value.allowedTypeKeys).toEqual([
      'profile',
      'article',
    ]);
  });

  it('names every problem at its field, in field order', () => {
    expect(
      issuesOf({
        taxonomyKey: 'Bad Key',
        shape: '',
        typeKeys: [],
        fieldKeys: [],
      }),
    ).toEqual([
      ['taxonomy_key_invalid', 'taxonomyKey'],
      ['shape_required', 'shape'],
      ['type_keys_required', 'allowedTypeKeys'],
      ['field_keys_required', 'allowedFieldKeys'],
    ]);
  });

  it('refuses allowlists past 64 keys and duplicates the contract would refuse', () => {
    const many = Array.from({ length: 65 }, (_, index) => `type_${index}`);
    expect(issuesOf({ typeKeys: many })).toEqual([
      ['type_keys_exceeded', 'allowedTypeKeys'],
    ]);
    expect(issuesOf({ fieldKeys: many })).toEqual([
      ['field_keys_exceeded', 'allowedFieldKeys'],
    ]);
    expect(issuesOf({ typeKeys: ['article', 'article'] })).toEqual([
      ['type_keys_duplicate', 'allowedTypeKeys'],
    ]);
    expect(issuesOf({ fieldKeys: ['tags', 'tags'] })).toEqual([
      ['field_keys_duplicate', 'allowedFieldKeys'],
    ]);
  });

  it('refuses a key or field key outside the contract grammar', () => {
    expect(issuesOf({ typeKeys: ['Article'] })).toEqual([
      ['type_keys_invalid', 'allowedTypeKeys'],
    ]);
    expect(issuesOf({ fieldKeys: ['a b'] })).toEqual([
      ['field_keys_invalid', 'allowedFieldKeys'],
    ]);
  });

  it('refuses a parent version that is not a version, and a duplicate or unknown domain', () => {
    expect(issuesOf({ expectedVersion: '0' })).toEqual([
      ['version_invalid', 'form'],
    ]);
    expect(issuesOf({ expectedVersion: '9223372036854775808' })).toEqual([
      ['version_invalid', 'form'],
    ]);
    expect(
      buildTaxonomyVersionRequest(
        fields({ expectedVersion: '9223372036854775807' }),
      ).ok,
    ).toBe(true);
    expect(issuesOf({ domains: ['role', 'role'] })).toEqual([
      ['domain_duplicate', 'canonicalOverlapDomains'],
    ]);
    expect(issuesOf({ domains: ['planet' as 'role'] })).toEqual([
      ['domain_unknown', 'canonicalOverlapDomains'],
    ]);
  });

  it('every problem carries fixed copy', () => {
    const built = buildTaxonomyVersionRequest(
      fields({ taxonomyKey: '', shape: '' }),
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    for (const issue of built.issues)
      expect(issue.message.length).toBeGreaterThan(10);
    expect(new Set(built.issues.map((issue) => issue.message)).size).toBe(
      built.issues.length,
    );
  });
});
