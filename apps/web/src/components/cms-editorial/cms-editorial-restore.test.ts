import { describe, expect, it } from 'vitest';

// Runtime-computed specifier: the planned module is authored by the next slice.
const RESTORE = String('./cms-editorial-restore');
type RestoreModule = {
  CmsEditorialRestoreCarrierSchema: {
    safeParse(value: unknown): { success: boolean };
  };
  commitAllowedForAvailability(availability: string): boolean;
};
const restoreModule = async (): Promise<RestoreModule | null> => {
  try {
    return (await import(RESTORE)) as RestoreModule;
  } catch {
    return null;
  }
};

describe('[P2-S10] CMS-03B-04 restore projection', () => {
  it('[P2-S10-AC-2234] validates the compare.restore carrier and refuses unavailable commit', async () => {
    const mod = await restoreModule();
    expect(mod).not.toBeNull();
    const restore = {
      migrationChainId: 'chain-1',
      edgeCount: 4,
      availability: 'available',
    };
    expect(
      mod!.CmsEditorialRestoreCarrierSchema.safeParse(restore).success,
    ).toBe(true);
    expect(mod!.commitAllowedForAvailability('available')).toBe(true);
    expect(mod!.commitAllowedForAvailability('chain_unavailable')).toBe(false);
    expect(mod!.commitAllowedForAvailability('transform_missing')).toBe(false);
  });
});
