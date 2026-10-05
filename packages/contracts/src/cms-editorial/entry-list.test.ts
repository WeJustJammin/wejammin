import { describe, expect, it } from 'vitest';

import { EntryListPageSchema, EntryListQuerySchema } from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';

const validSummary = {
  id: uuid,
  revisionNumber: '4',
  locale: 'en-US',
  state: 'draft',
  contentHash: hash,
  createdAt: instant,
  authorClass: 'human-author',
} as const;

const validPage = {
  items: [validSummary],
  nextCursor: null,
  pageVersion: '4',
} as const;

describe('CMS-03B-02 entry list query', () => {
  it('parses the canonical query and defaults limit to 25', () => {
    expect(EntryListQuerySchema.parse({})).toEqual({ limit: 25 });
    const canonical = EntryListQuerySchema.parse({
      cursor: 'opaque-keyset-cursor',
      limit: 10,
      state: 'draft',
      contentTypeId: uuid,
    });
    expect(canonical).toEqual({
      cursor: 'opaque-keyset-cursor',
      limit: 10,
      state: 'draft',
      contentTypeId: uuid,
    });
  });

  it('keeps the declared default when limit is absent and accepts an explicit window', () => {
    expect(EntryListQuerySchema.parse({ state: 'published' }).limit).toBe(25);
    expect(EntryListQuerySchema.parse({ limit: 1 }).limit).toBe(1);
    expect(EntryListQuerySchema.parse({ limit: 50 }).limit).toBe(50);
  });

  it('refuses unknown keys and any caller-supplied ownership identifier', () => {
    expect(EntryListQuerySchema.safeParse({ extra: 1 }).success).toBe(false);
    for (const leaked of [
      'ownerId',
      'partyId',
      'createdByPersonId',
      'entryId',
      'revisionId',
    ])
      expect(
        EntryListQuerySchema.safeParse({ limit: 25, [leaked]: uuid }).success,
      ).toBe(false);
  });

  it('bounds the cursor at 512 characters and accepts null', () => {
    expect(
      EntryListQuerySchema.safeParse({ cursor: 'a'.repeat(512) }).success,
    ).toBe(true);
    expect(
      EntryListQuerySchema.safeParse({ cursor: 'a'.repeat(513) }).success,
    ).toBe(false);
    expect(EntryListQuerySchema.safeParse({ cursor: null }).success).toBe(true);
    expect(EntryListQuerySchema.safeParse({ cursor: '' }).success).toBe(true);
    expect(EntryListQuerySchema.safeParse({ cursor: 7 }).success).toBe(false);
  });

  it('bounds the window to 1..50 and refuses non-integers', () => {
    expect(EntryListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(EntryListQuerySchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(EntryListQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
    expect(EntryListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(EntryListQuerySchema.safeParse({ limit: 2.5 }).success).toBe(false);
    expect(EntryListQuerySchema.safeParse({ limit: '25' }).success).toBe(false);
  });

  it('accepts only the closed revision states and a UUID content type', () => {
    for (const state of [
      'draft',
      'submitted',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ] as const)
      expect(EntryListQuerySchema.safeParse({ state }).success).toBe(true);
    for (const state of ['archived', 'active', 'deleted', ''])
      expect(EntryListQuerySchema.safeParse({ state }).success).toBe(false);

    expect(EntryListQuerySchema.safeParse({ contentTypeId: uuid }).success).toBe(
      true,
    );
    expect(
      EntryListQuerySchema.safeParse({ contentTypeId: 'nope' }).success,
    ).toBe(false);
    expect(
      EntryListQuerySchema.safeParse({ contentTypeId: uuid2 }).success,
    ).toBe(true);
  });
});

describe('CMS-03B-02 entry list page', () => {
  it('parses the canonical page envelope', () => {
    expect(EntryListPageSchema.parse(validPage)).toEqual(validPage);
    expect(
      EntryListPageSchema.safeParse({
        ...validPage,
        nextCursor: 'opaque-keyset-cursor',
      }).success,
    ).toBe(true);
  });

  it('never returns more than 50 summaries while accepting the exact bound', () => {
    expect(
      EntryListPageSchema.safeParse({
        ...validPage,
        items: Array.from({ length: 50 }, () => validSummary),
      }).success,
    ).toBe(true);
    expect(
      EntryListPageSchema.safeParse({
        ...validPage,
        items: Array.from({ length: 51 }, () => validSummary),
      }).success,
    ).toBe(false);
    expect(
      EntryListPageSchema.safeParse({ ...validPage, items: [] }).success,
    ).toBe(true);
  });

  it('bounds the next cursor at 512 characters and requires the member', () => {
    expect(
      EntryListPageSchema.safeParse({
        ...validPage,
        nextCursor: 'a'.repeat(512),
      }).success,
    ).toBe(true);
    expect(
      EntryListPageSchema.safeParse({
        ...validPage,
        nextCursor: 'a'.repeat(513),
      }).success,
    ).toBe(false);
    expect(
      EntryListPageSchema.safeParse({ ...validPage, nextCursor: null }).success,
    ).toBe(true);
    const { nextCursor: _nextCursor, ...withoutCursor } = validPage;
    void _nextCursor;
    expect(EntryListPageSchema.safeParse(withoutCursor).success).toBe(false);
  });

  it('requires a valid page version and refuses anything but a version string', () => {
    expect(validPage.pageVersion).toBe('4');
    expect(
      EntryListPageSchema.safeParse({ ...validPage, pageVersion: '0' }).success,
    ).toBe(false);
    expect(
      EntryListPageSchema.safeParse({ ...validPage, pageVersion: 4 }).success,
    ).toBe(false);
    const { pageVersion: _pageVersion, ...withoutVersion } = validPage;
    void _pageVersion;
    expect(EntryListPageSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it('validates every nested revision summary row', () => {
    for (const bad of [
      { ...validSummary, state: 'archived' },
      { ...validSummary, contentHash: 'short' },
      { ...validSummary, authorClass: '' },
      { ...validSummary, revisionNumber: '0' },
      { ...validSummary, locale: 'e' },
      { ...validSummary, id: 'not-a-uuid' },
    ])
      expect(
        EntryListPageSchema.safeParse({ ...validPage, items: [bad] }).success,
      ).toBe(false);
  });

  it('rejects unknown keys and ownership identifiers on the summary and page', () => {
    expect(
      EntryListPageSchema.safeParse({ ...validPage, extra: 1 }).success,
    ).toBe(false);
    for (const leaked of ['ownerId', 'entryId', 'partyId', 'createdByPersonId'])
      expect(
        EntryListPageSchema.safeParse({ ...validPage, [leaked]: uuid }).success,
      ).toBe(false);
    for (const leaked of ['ownerId', 'entryId', 'partyId'])
      expect(
        EntryListPageSchema.safeParse({
          ...validPage,
          items: [{ ...validSummary, [leaked]: uuid }],
        }).success,
      ).toBe(false);
  });
});

