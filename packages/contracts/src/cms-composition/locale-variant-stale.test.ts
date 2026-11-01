import { describe, expect, it } from 'vitest';

import {
  LocaleVariantApiRequestSchema,
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
  staleFieldIds: [],
};

describe('per-field staleness on the variant resource (DEC-121)', () => {
  const stale = { ...resource, state: 'stale', staleFieldIds: [FIELD_ID] };

  it('[P2-S12-AC-235] carries staleFieldIds on the resource, required and never implied', () => {
    expect(LocaleVariantResourceSchema.parse(resource).staleFieldIds).toEqual(
      [],
    );
    expect(LocaleVariantResourceSchema.parse(stale).staleFieldIds).toEqual([
      FIELD_ID,
    ]);
    const { staleFieldIds: _omitted, ...withoutStale } = resource;
    void _omitted;
    expect(LocaleVariantResourceSchema.safeParse(withoutStale).success).toBe(
      false,
    );
    // The request never carries it: staleness is derived from the source hashes.
    expect(
      LocaleVariantRequestSchema.safeParse({ ...request, staleFieldIds: [] })
        .success,
    ).toBe(false);
  });

  it('[P2-S12-AC-235] is empty unless the variant state is stale', () => {
    for (const state of ['untranslated', 'draft', 'review', 'approved']) {
      const parsed = LocaleVariantResourceSchema.safeParse({
        ...stale,
        state,
      });
      expect(parsed.success, state).toBe(false);
      if (!parsed.success)
        expect(
          parsed.error.issues.map((issue) => issue.path.join('.')),
        ).toEqual(['staleFieldIds']);
    }
    expect(
      LocaleVariantResourceSchema.safeParse({ ...resource, state: 'stale' })
        .success,
    ).toBe(true);
  });

  it('[P2-S12-AC-235] bounds the stale fields at 128 unique UUIDs', () => {
    const ids = Array.from(
      { length: 129 },
      (_, index) =>
        `30000000-0000-4000-8000-${String(index + 500).padStart(12, '0')}`,
    );
    expect(
      LocaleVariantResourceSchema.safeParse({
        ...stale,
        staleFieldIds: ids.slice(0, 128),
      }).success,
    ).toBe(true);
    for (const staleFieldIds of [ids, ['not-a-uuid'], [FIELD_ID, FIELD_ID]])
      expect(
        LocaleVariantResourceSchema.safeParse({ ...stale, staleFieldIds })
          .success,
      ).toBe(false);
  });
});

describe('CMS-03C-04 If-Match operand', () => {
  const headers = {
    contentType: 'application/json',
    idempotencyKey: 'locale-variant-0001',
    ifMatch: '"2"',
  };

  it('[P2-S12-AC-056] ties the strong If-Match to the entry aggregate version expectedVersion, reported at headers.ifMatch', () => {
    const transport = {
      entryId: ENTRY_ID,
      locale: 'fr-CA',
      headers,
      body: request,
    };
    expect(LocaleVariantApiRequestSchema.safeParse(transport).success).toBe(
      true,
    );
    const mismatch = LocaleVariantApiRequestSchema.safeParse({
      ...transport,
      headers: { ...headers, ifMatch: '"3"' },
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success)
      expect(
        mismatch.error.issues.map((issue) => issue.path.join('.')),
      ).toEqual(['headers.ifMatch']);
  });
});
