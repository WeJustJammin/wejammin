import { describe, expect, it } from 'vitest';

import { TzdbIntegrityError, createTimeAuthority } from './time-authority';
import { CMS_TZDB_SHA256 } from './tzdb-pin';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';

describe('the time authority release pin', () => {
  it('refuses a correctly hashed snapshot of a release other than the pinned one', async () => {
    const attempt = createTimeAuthority(
      CMS_TZDB_SNAPSHOT_JSON,
      CMS_TZDB_SHA256,
      '2025a',
    );
    await expect(attempt).rejects.toBeInstanceOf(TzdbIntegrityError);
    await expect(attempt).rejects.toMatchObject({
      name: 'TzdbIntegrityError',
      message:
        'The tz snapshot release differs from the pinned CMS_TZDB_VERSION.',
    });
  });

  it('serves the same snapshot when the pinned release matches its own', async () => {
    const authority = await createTimeAuthority(
      CMS_TZDB_SNAPSHOT_JSON,
      CMS_TZDB_SHA256,
      '2026e',
    );
    expect(authority.release).toBe('2026e');
  });
});
