import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import {
  CMS_TZDB_SHA256,
  CMS_TZDB_SOURCE,
  CMS_TZDB_VERSION,
} from '@wejammin/contracts';
import { CMS_TZDB_SNAPSHOT_JSON } from '@wejammin/contracts/time-authority';
import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_FORMAT,
  parseTzif,
  renderModule,
} from '../../infra/generate-tzdb-snapshot.mjs';

/*
 * DEC-153 / BE03b E8: the pinned tz release, its generated snapshot and the
 * script that regenerates it must agree. The network-dependent regeneration is
 * `node infra/generate-tzdb-snapshot.mjs --download --check`; these tests are the
 * offline half of that guard.
 */
/**
 * The DEC-153 pin as recorded in `.memory/wiki/decisions.md` ("DEC-153 (pin
 * recorded)"): the release tag, the SHA-256 of the exact generated snapshot text
 * and the SHA-256 of each IANA tarball it is generated from. These literals ARE
 * the pin: a shape or inequality check would pass `'0'.repeat(64)`.
 */
const DEC_153 = {
  release: '2026e',
  snapshotSha256:
    '862c1656e10ab81c18359393473448dcd2540d4254fa5b2c432a2989cac81c3b',
  tzdataSha256:
    'b26882805f26aac59d5b222978e6580484b834ccdc98be89df2f05a6dc53a652',
  tzcodeSha256:
    'cc3d27ca2a0d8399504551b920970d80af83bfb9c216e8082a15491921935d54',
} as const;

/** True when a pin carries exactly the DEC-153 release and digests. */
const matchesDec153 = (pin: {
  release: string;
  snapshotSha256: string;
  tzdataSha256: string;
  tzcodeSha256: string;
}): boolean =>
  pin.release === DEC_153.release &&
  pin.snapshotSha256 === DEC_153.snapshotSha256 &&
  pin.tzdataSha256 === DEC_153.tzdataSha256 &&
  pin.tzcodeSha256 === DEC_153.tzcodeSha256;

const SNAPSHOT_FILE = new URL(
  '../../packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot-data.ts',
  import.meta.url,
);

describe('[P2-S11-AC-103] the Slice 11 tz pin (DEC-153)', () => {
  it('pins the newest stable IANA release to two content-addressed tarballs', () => {
    expect(CMS_TZDB_VERSION).toBe('2026e');
    expect(CMS_TZDB_SOURCE.release).toBe(CMS_TZDB_VERSION);
    expect(CMS_TZDB_SOURCE.tzdataUrl).toBe(
      `https://data.iana.org/time-zones/releases/tzdata${CMS_TZDB_VERSION}.tar.gz`,
    );
    expect(CMS_TZDB_SOURCE.tzcodeUrl).toBe(
      `https://data.iana.org/time-zones/releases/tzcode${CMS_TZDB_VERSION}.tar.gz`,
    );
    expect(CMS_TZDB_SOURCE.tzdataSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(CMS_TZDB_SOURCE.tzcodeSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(CMS_TZDB_SOURCE.tzdataSha256).not.toBe(CMS_TZDB_SOURCE.tzcodeSha256);
    expect(CMS_TZDB_SOURCE.tzdataSha256).toBe(DEC_153.tzdataSha256);
    expect(CMS_TZDB_SOURCE.tzcodeSha256).toBe(DEC_153.tzcodeSha256);
    expect(CMS_TZDB_SOURCE.generationCommand).toBe(
      'node infra/generate-tzdb-snapshot.mjs --download',
    );
    expect(existsSync('infra/generate-tzdb-snapshot.mjs')).toBe(true);
  });

  it('commits exactly the module the generator renders from the pinned snapshot text', () => {
    expect(readFileSync(SNAPSHOT_FILE, 'utf8')).toBe(
      renderModule(CMS_TZDB_SNAPSHOT_JSON),
    );
    expect(JSON.parse(CMS_TZDB_SNAPSHOT_JSON)).toMatchObject({
      format: SNAPSHOT_FORMAT,
      release: CMS_TZDB_VERSION,
    });
    expect(CMS_TZDB_SHA256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('binds the exported constants to the exact DEC-153 release and digests', () => {
    expect(
      matchesDec153({
        release: CMS_TZDB_VERSION,
        snapshotSha256: CMS_TZDB_SHA256,
        tzdataSha256: CMS_TZDB_SOURCE.tzdataSha256,
        tzcodeSha256: CMS_TZDB_SOURCE.tzcodeSha256,
      }),
    ).toBe(true);
    expect(CMS_TZDB_SOURCE.releasedAt).toBe('2026-09-29');
  });

  it('recomputes the snapshot digest from the committed snapshot text', () => {
    expect(
      createHash('sha256').update(CMS_TZDB_SNAPSHOT_JSON, 'utf8').digest('hex'),
    ).toBe(CMS_TZDB_SHA256);
  });

  it('is the pin the decision record states, digest for digest', () => {
    const record = readFileSync('.memory/wiki/decisions.md', 'utf8');
    expect(record).toContain('DEC-153 (pin recorded)');
    for (const digest of [
      DEC_153.snapshotSha256,
      DEC_153.tzdataSha256,
      DEC_153.tzcodeSha256,
    ])
      expect(record, digest).toContain(digest);
  });

  it('refuses a pin whose release or any digest is a placeholder or has drifted', () => {
    const pin = {
      release: CMS_TZDB_VERSION,
      snapshotSha256: CMS_TZDB_SHA256,
      tzdataSha256: CMS_TZDB_SOURCE.tzdataSha256,
      tzcodeSha256: CMS_TZDB_SOURCE.tzcodeSha256,
    };
    const placeholder = (character: string) => character.repeat(64);
    // The former shape-and-inequality check accepted every one of these.
    for (const mutated of [
      {
        ...pin,
        tzdataSha256: placeholder('0'),
        tzcodeSha256: placeholder('1'),
      },
      { ...pin, tzdataSha256: placeholder('0') },
      { ...pin, tzcodeSha256: placeholder('1') },
      { ...pin, snapshotSha256: placeholder('a') },
      {
        ...pin,
        tzdataSha256: pin.tzcodeSha256,
        tzcodeSha256: pin.tzdataSha256,
      },
      { ...pin, release: '2026d' },
      { ...pin, tzdataSha256: `${pin.tzdataSha256.slice(0, 63)}0` },
    ]) {
      expect(mutated.tzdataSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(mutated.tzcodeSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(matchesDec153(mutated), JSON.stringify(mutated)).toBe(false);
    }
  });

  const host = '/usr/share/zoneinfo/America/New_York';
  it.skipIf(!existsSync(host))(
    'reads a real TZif file down to offsets, transitions and the POSIX footer',
    () => {
      const parsed = parseTzif(readFileSync(host), 'America/New_York');
      expect(parsed.footer).toBe('EST5EDT,M3.2.0,M11.1.0');
      expect(parsed.initialOffset).toBe(-17_762);
      expect(parsed.times.length).toBeGreaterThan(100);
      expect(parsed.times).toEqual(
        [...parsed.times].sort((left, right) => left - right),
      );
      expect(parsed.offsets).toHaveLength(parsed.times.length);
      expect(new Set(parsed.offsets)).toEqual(new Set([-18_000, -14_400]));
    },
  );

  it('refuses bytes that are not a TZif file or have no 64-bit block or footer', () => {
    expect(() =>
      parseTzif(Buffer.from('not tzif at all, definitely'), 'x'),
    ).toThrow(/not a TZif/u);
    const v1 = Buffer.alloc(44);
    v1.write('TZif', 0, 'latin1');
    v1[4] = 0;
    expect(() => parseTzif(v1, 'old')).toThrow(/64-bit/u);
  });
});
