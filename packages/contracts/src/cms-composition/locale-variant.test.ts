import { describe, expect, it } from 'vitest';

import {
  LocaleVariantHeadersSchema,
  LocaleVariantPathSchema,
  LocaleVariantRequestSchema,
  LocaleVariantResourceSchema,
} from './locale-variant';

const ENTRY_ID = '10000000-0000-4000-8000-000000000001';
const SOURCE_REVISION_ID = '20000000-0000-4000-8000-000000000002';
const FIELD_ID = '30000000-0000-4000-8000-000000000003';
const VARIANT_ID = '40000000-0000-4000-8000-000000000004';
const REVISION_ID = '50000000-0000-4000-8000-000000000005';
const HASH = 'a'.repeat(64);
const request = {
  entryId: ENTRY_ID,
  locale: 'fr-CA',
  sourceRevisionId: SOURCE_REVISION_ID,
  fields: [{ fieldId: FIELD_ID, value: { text: 'Bonjour' } }],
  fallbackChain: ['fr', 'en-US'],
  noFallbackFieldIds: [FIELD_ID],
  sourceHash: HASH,
  expectedVersion: '2',
};
const resource = {
  id: VARIANT_ID,
  version: '3',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  locale: 'fr-CA',
  sourceRevisionId: SOURCE_REVISION_ID,
  fallbackChain: ['fr', 'en-US'],
  noFallbackFieldIds: [FIELD_ID],
};

describe('CMS-03C-04 locale-variant wire contract', () => {
  it('accepts the strict path, request, and explicit no-fallback field set', () => {
    expect(
      LocaleVariantPathSchema.parse({ entryId: ENTRY_ID, locale: 'fr-CA' }),
    ).toEqual({
      entryId: ENTRY_ID,
      locale: 'fr-CA',
    });
    expect(LocaleVariantRequestSchema.parse(request)).toEqual(request);
    expect(
      LocaleVariantRequestSchema.safeParse({
        ...request,
        fields: [{ fieldId: FIELD_ID, value: null }],
        fallbackChain: [],
        noFallbackFieldIds: [],
      }).success,
    ).toBe(true);
  });

  it('rejects malformed addressing, caller authority, hashes, and versions', () => {
    for (const path of [
      { entryId: 'private', locale: 'fr-CA' },
      { entryId: ENTRY_ID, locale: 'fr_CA' },
      { entryId: ENTRY_ID, locale: 'fr-CA', ownerId: ENTRY_ID },
    ])
      expect(LocaleVariantPathSchema.safeParse(path).success).toBe(false);
    for (const candidate of [
      { ...request, ownerId: ENTRY_ID },
      { ...request, entryId: 'private' },
      { ...request, locale: 'fr_CA' },
      { ...request, sourceRevisionId: 'private' },
      { ...request, sourceHash: HASH.toUpperCase() },
      { ...request, expectedVersion: '0' },
    ])
      expect(LocaleVariantRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('bounds and deduplicates localizable fields and fallback selections', () => {
    for (const candidate of [
      { ...request, fields: [] },
      {
        ...request,
        fields: Array.from({ length: 129 }, () => request.fields[0]),
      },
      { ...request, fields: [request.fields[0], request.fields[0]] },
      { ...request, fields: [{ fieldId: 'private', value: 'x' }] },
      { ...request, fields: [{ fieldId: FIELD_ID, value: Number.NaN }] },
      {
        ...request,
        fields: [{ fieldId: FIELD_ID, value: 'x', privateValue: 'private' }],
      },
      { ...request, fallbackChain: Array.from({ length: 17 }, () => 'fr') },
      { ...request, fallbackChain: ['fr', 'fr'] },
      { ...request, fallbackChain: ['fr_CA'] },
      {
        ...request,
        noFallbackFieldIds: Array.from({ length: 129 }, () => FIELD_ID),
      },
      { ...request, noFallbackFieldIds: [FIELD_ID, FIELD_ID] },
      { ...request, noFallbackFieldIds: ['private'] },
    ])
      expect(LocaleVariantRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('requires idempotent JSON and a strong source-version validator', () => {
    expect(
      LocaleVariantHeadersSchema.parse({
        contentType: 'application/json',
        idempotencyKey: 'locale-variant-0001',
        ifMatch: '"2"',
      }),
    ).toMatchObject({ ifMatch: '"2"' });
    for (const headers of [
      {
        contentType: 'text/plain',
        idempotencyKey: 'locale-variant-0001',
        ifMatch: '"2"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'short',
        ifMatch: '"2"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'locale-variant-0001',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'locale-variant-0001',
        ifMatch: 'W/"2"',
      },
    ])
      expect(LocaleVariantHeadersSchema.safeParse(headers).success).toBe(false);
  });

  it('accepts only the closed state and safe locale resource', () => {
    expect(LocaleVariantResourceSchema.parse(resource)).toEqual(resource);
    for (const state of [
      'untranslated',
      'draft',
      'review',
      'approved',
      'stale',
    ])
      expect(
        LocaleVariantResourceSchema.safeParse({ ...resource, state }).success,
      ).toBe(true);
    for (const candidate of [
      { ...resource, ownerId: ENTRY_ID },
      { ...resource, state: 'published' },
      { ...resource, entryId: 'private' },
      { ...resource, revisionId: 'private' },
      { ...resource, locale: 'fr_CA' },
      { ...resource, sourceRevisionId: 'private' },
      { ...resource, fallbackChain: Array.from({ length: 17 }, () => 'fr') },
      {
        ...resource,
        noFallbackFieldIds: Array.from({ length: 129 }, () => FIELD_ID),
      },
    ])
      expect(LocaleVariantResourceSchema.safeParse(candidate).success).toBe(
        false,
      );
  });
});
