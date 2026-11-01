import { describe, expect, it } from 'vitest';

import { CMS_TZDB_SHA256, CMS_TZDB_VERSION } from './tzdb-pin';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { parseSnapshot, sha256Hex } from './tzdb-snapshot';

describe('[P2-S11-AC-103] snapshot parsing and integrity', () => {
  it('pins the release tag and a lowercase SHA-256 of the exact snapshot text', async () => {
    expect(CMS_TZDB_VERSION).toMatch(/^[A-Za-z0-9._-]{1,32}$/u);
    expect(CMS_TZDB_VERSION).toBe('2026e');
    expect(CMS_TZDB_SHA256).toMatch(/^[a-f0-9]{64}$/u);
    expect(await sha256Hex(CMS_TZDB_SNAPSHOT_JSON)).toBe(CMS_TZDB_SHA256);
  });

  it('computes SHA-256 over UTF-8 bytes', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await sha256Hex('[]')).toBe(
      '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    );
    expect(await sha256Hex('\u00e9')).toBe(
      '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c',
    );
  });

  it('parses the pinned snapshot and refuses a malformed one', () => {
    const snapshot = parseSnapshot(CMS_TZDB_SNAPSHOT_JSON);
    expect(snapshot.format).toBe('cms.tzdb.v1');
    expect(snapshot.release).toBe('2026e');
    const tampered = (
      change: (value: Record<string, unknown>) => void,
    ): string => {
      const value = JSON.parse(CMS_TZDB_SNAPSHOT_JSON) as Record<
        string,
        unknown
      >;
      change(value);
      return JSON.stringify(value);
    };
    expect(() => parseSnapshot('not json')).toThrow(/snapshot/u);
    expect(() =>
      parseSnapshot(
        tampered((v) => {
          v.format = 'other';
        }),
      ),
    ).toThrow(/snapshot/u);
    expect(() =>
      parseSnapshot(
        tampered((v) => {
          v.extra = 1;
        }),
      ),
    ).toThrow(/snapshot/u);
    expect(() =>
      parseSnapshot(
        tampered((v) => {
          (v.names as Record<string, number>)['Bad/Zone'] = 99_999;
        }),
      ),
    ).toThrow(/snapshot/u);
    expect(() =>
      parseSnapshot(
        tampered((v) => {
          (v.zones as unknown[][])[0]![1] = 99;
        }),
      ),
    ).toThrow(/snapshot/u);
    expect(() =>
      parseSnapshot(
        tampered((v) => {
          const zone = (v.zones as unknown[][])[0]!;
          zone[3] = [...(zone[3] as number[]), 0];
        }),
      ),
    ).toThrow(/snapshot/u);
  });
});
