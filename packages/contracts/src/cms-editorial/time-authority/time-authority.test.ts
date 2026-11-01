import { describe, expect, it } from 'vitest';

import {
  TzdbIntegrityError,
  createTimeAuthority,
  loadPinnedTimeAuthority,
} from './time-authority';
import { CMS_TZDB_SHA256, CMS_TZDB_VERSION } from './tzdb-pin';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { sha256Hex } from './tzdb-snapshot';

const NOW = Date.parse('2026-10-08T12:00:00Z');

describe('[P2-S11-AC-103] the pinned time authority', () => {
  it('verifies the snapshot hash at load and exposes the pinned release', async () => {
    const authority = await createTimeAuthority(
      CMS_TZDB_SNAPSHOT_JSON,
      CMS_TZDB_SHA256,
    );
    expect(authority.release).toBe(CMS_TZDB_VERSION);
    expect(authority.sha256).toBe(CMS_TZDB_SHA256);
    expect(authority.hasZone('America/New_York')).toBe(true);
    expect(authority.hasZone('Mars/Olympus')).toBe(false);
    expect(authority.zoneNames().length).toBeGreaterThan(500);
  });

  it('refuses a snapshot whose hash differs from the pin, so every schedule command can answer 503', async () => {
    await expect(
      createTimeAuthority(CMS_TZDB_SNAPSHOT_JSON, '0'.repeat(64)),
    ).rejects.toBeInstanceOf(TzdbIntegrityError);
    await expect(
      createTimeAuthority(`${CMS_TZDB_SNAPSHOT_JSON} `, CMS_TZDB_SHA256),
    ).rejects.toBeInstanceOf(TzdbIntegrityError);
    const edited = CMS_TZDB_SNAPSHOT_JSON.replace(
      '"America/New_York":',
      '"America/New_Yorx":',
    );
    expect(edited).not.toBe(CMS_TZDB_SNAPSHOT_JSON);
    await expect(createTimeAuthority(edited, CMS_TZDB_SHA256)).rejects.toThrow(
      /hash/u,
    );
  });

  it('refuses a correctly hashed but malformed snapshot', async () => {
    const text = '{"format":"cms.tzdb.v1"}';
    await expect(
      createTimeAuthority(text, await sha256Hex(text)),
    ).rejects.toThrow(/snapshot/u);
  });

  it('loads the pinned snapshot once and checks its release against the pin', async () => {
    const first = loadPinnedTimeAuthority();
    expect(loadPinnedTimeAuthority()).toBe(first);
    expect((await first).release).toBe('2026e');
  });

  it('resolves a schedule through the verified snapshot', async () => {
    const authority = await loadPinnedTimeAuthority();
    expect(
      authority.resolveSchedule(
        {
          localDateTime: '2026-11-15T09:00',
          timezone: 'America/New_York',
          resolvedUtc: '2026-11-15T14:00:00Z',
          tzdbVersion: '2026e',
          disambiguation: 'none',
        },
        NOW,
      ),
    ).toMatchObject({ ok: true, resolvedUtc: '2026-11-15T14:00:00Z' });
    expect(
      authority.resolveSchedule(
        {
          localDateTime: '2026-11-15T09:00',
          timezone: 'America/New_York',
          resolvedUtc: '2026-11-15T14:00:00Z',
          tzdbVersion: '2025b',
          disambiguation: 'none',
        },
        NOW,
      ),
    ).toMatchObject({
      ok: false,
      details: { reasonCode: 'tzdb_version_mismatch', pinnedVersion: '2026e' },
    });
  });

  it('answers the UT offset of a zone at an instant', async () => {
    const authority = await loadPinnedTimeAuthority();
    expect(
      authority.offsetAt(
        'America/New_York',
        Date.parse('2026-07-01T00:00:00Z') / 1000,
      ),
    ).toBe(-14_400);
    expect(authority.offsetAt('Mars/Olympus', 0)).toBeNull();
  });
});
