import { describe, expect, it } from 'vitest';

// Runtime-computed specifier: the planned module is authored by the next slice.
const ENTRY_LIST = String('./cms-editorial-entry-list');
type EntryListModule = {
  CmsEditorialEntryListPageSchema: {
    safeParse(value: unknown): { success: boolean };
  };
};
const listModule = async (): Promise<EntryListModule | null> => {
  try {
    return (await import(ENTRY_LIST)) as EntryListModule;
  } catch {
    return null;
  }
};

const revisionSummary = () => ({
  revisionId: '11111111-1111-4111-8111-111111111111',
  revisionNumber: 3,
  lifecycle: 'draft',
  state: 'draft',
  updatedAt: '2026-10-05T00:00:00Z',
});

describe('[P2-S10] CmsEditorialEntryList projection', () => {
  it('[P2-S10-AC-2231] validates a page of RevisionSummary rows with a signed cursor', async () => {
    const mod = await listModule();
    expect(mod).not.toBeNull();
    const page = {
      items: [revisionSummary(), revisionSummary()],
      nextCursor: 'cursor-1',
    };
    expect(mod!.CmsEditorialEntryListPageSchema.safeParse(page).success).toBe(
      true,
    );
  });

  it('[P2-S10-AC-2232] refuses unknown fields on list rows', async () => {
    const mod = await listModule();
    const row = { ...revisionSummary(), ownerId: 'p_123' };
    expect(
      mod!.CmsEditorialEntryListPageSchema.safeParse({
        items: [row],
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
});
