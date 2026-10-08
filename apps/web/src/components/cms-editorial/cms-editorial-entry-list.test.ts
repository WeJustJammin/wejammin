import { describe, expect, it } from 'vitest';

import {
  CmsEditorialEntryListPageSchema,
  CmsEditorialEntryListRowSchema,
} from './cms-editorial-entry-list';

const row = () => ({
  id: '11111111-1111-4111-8111-111111111111',
  entryId: '11111111-1111-4111-8111-111111111112',
  revisionNumber: '3',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-05T00:00:00Z',
  authorClass: 'author',
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-05T01:00:00Z',
});

describe('CmsEditorialEntryList projection (DEC-145)', () => {
  it('is the shared EntryListPage contract, so a row carries the lifecycle and updated time FE03 renders', () => {
    const page = {
      items: [row(), row()],
      nextCursor: 'cursor-1',
      pageVersion: '1',
    };
    const parsed = CmsEditorialEntryListPageSchema.safeParse(page);
    expect(parsed.success).toBe(true);
    expect(CmsEditorialEntryListRowSchema.safeParse(row()).success).toBe(true);
  });

  it('refuses a row that leaks an owner or assignment identifier', () => {
    for (const leak of ['ownerId', 'assigneeId', 'actingPartyId'])
      expect(
        CmsEditorialEntryListRowSchema.safeParse({ ...row(), [leak]: 'p_123' })
          .success,
        leak,
      ).toBe(false);
  });

  it.each(['entryLifecycle', 'entryUpdatedAt'])(
    'refuses a row without %s',
    (member) => {
      const incomplete: Record<string, unknown> = { ...row() };
      delete incomplete[member];
      expect(CmsEditorialEntryListRowSchema.safeParse(incomplete).success).toBe(
        false,
      );
    },
  );

  it('bounds a page at 50 rows', () => {
    const items = Array.from({ length: 51 }, row);
    expect(
      CmsEditorialEntryListPageSchema.safeParse({
        items,
        nextCursor: null,
        pageVersion: '1',
      }).success,
    ).toBe(false);
  });
});
