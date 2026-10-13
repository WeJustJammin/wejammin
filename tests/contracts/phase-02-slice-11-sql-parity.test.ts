import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CMS_PREFLIGHT_CATEGORIES,
  CMS_PREFLIGHT_REGISTRY,
  CMS_PUBLICATION_SETTINGS_KEYS,
  CMS_PUBLICATION_SETTINGS_REGISTRY_VERSION,
  CMS_TZDB_SHA256,
  CMS_TZDB_VERSION,
  DependencyManifestSchema,
  VersionSetSchema,
  versionSetMatchesManifest,
  versionSetOf,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

/*
 * TypeScript <-> SQL parity (no database): the contracts package and the
 * PostgreSQL helpers implement the same pure rules twice, so each pair is held
 * equal by reading the SQL side's own artifacts as text.
 *
 *   - versionSetOf / versionSetMatchesManifest against the shared parity fixture
 *     read by BOTH sides (supabase/tests/phase_02_slice_11_helpers/
 *     version-set-parity.sqlinc; pgTAP asserts cms_version_set_of equals each
 *     expectedVersionSet),
 *   - CMS_TZDB_VERSION against the literal cms_tzdb_version() returns,
 *   - the preflight registry seed and the settings-registry constants.
 */

const MIGRATIONS = 'supabase/migrations';
const migrationFiles = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migration = (name: string): string =>
  readFileSync(join(MIGRATIONS, name), 'utf8');

/** The tag `cms_tzdb_version()` returns in one migration's text. */
const tzdbLiteral = (sql: string): string | undefined =>
  /select\s+'([^']+)'::text/iu.exec(sql)?.[1];

type Fixture = Readonly<{
  name: string;
  manifest: unknown;
  taxonomyVersionIds: readonly string[];
  expectedVersionSet: unknown;
}>;

/** The JSON between the first and the last single quote of the `\set parity_fixture '...'` line. */
const parityFixtures = (): readonly Fixture[] => {
  const text = readFileSync(
    'supabase/tests/phase_02_slice_11_helpers/version-set-parity.sqlinc',
    'utf8',
  );
  const line = text
    .split('\n')
    .find((candidate) => candidate.startsWith('\\set parity_fixture '));
  if (line === undefined) throw new Error('no \\set parity_fixture line');
  const json = line.slice(line.indexOf("'") + 1, line.lastIndexOf("'"));
  return JSON.parse(json) as readonly Fixture[];
};

describe('[P2-S11-AC-089] versionSetOf equals the SQL cms_version_set_of over the shared parity fixture', () => {
  const fixtures = parityFixtures();

  it('reads a non-trivial fixture set with distinct names', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    expect(new Set(fixtures.map(({ name }) => name)).size).toBe(
      fixtures.length,
    );
    // The fixture must exercise the sort: at least one taxonomy input is unsorted.
    expect(
      fixtures.some(
        ({ taxonomyVersionIds }) =>
          taxonomyVersionIds.join() !== [...taxonomyVersionIds].sort().join(),
      ),
    ).toBe(true);
  });

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('has a manifest and an expected version set that satisfy the strict contracts', () => {
        expect(
          DependencyManifestSchema.safeParse(fixture.manifest).success,
        ).toBe(true);
        expect(
          VersionSetSchema.safeParse(fixture.expectedVersionSet).success,
        ).toBe(true);
      });

      it('projects the manifest to exactly the version set the SQL expects', () => {
        const manifest = DependencyManifestSchema.parse(fixture.manifest);
        expect(versionSetOf(manifest, fixture.taxonomyVersionIds)).toEqual(
          fixture.expectedVersionSet,
        );
      });

      it('would notice a SQL expectation that drifted from the projection', () => {
        const manifest = DependencyManifestSchema.parse(fixture.manifest);
        const expected = fixture.expectedVersionSet as Record<string, unknown>;
        const projected = versionSetOf(manifest, fixture.taxonomyVersionIds);
        expect(projected).not.toEqual({ ...expected, settingsVersion: '999' });
        const sorted = [...fixture.taxonomyVersionIds].sort();
        const unsorted = fixture.taxonomyVersionIds.join() !== sorted.join();
        // An unsorted input must come out sorted: the input order is not the answer.
        if (unsorted)
          expect(projected).not.toEqual({
            ...expected,
            taxonomyVersionIds: [...fixture.taxonomyVersionIds],
          });
      });

      it('matches the manifest with the expected set and refuses any drifted member', () => {
        const manifest = DependencyManifestSchema.parse(fixture.manifest);
        const expected = VersionSetSchema.parse(fixture.expectedVersionSet);
        expect(versionSetMatchesManifest(expected, manifest)).toBe(true);
        expect(
          versionSetMatchesManifest(
            { ...expected, schemaHash: 'f'.repeat(64) },
            manifest,
          ),
        ).toBe(false);
        expect(
          versionSetMatchesManifest(
            { ...expected, settingsVersion: '999' },
            manifest,
          ),
        ).toBe(false);
        expect(
          versionSetMatchesManifest(
            { ...expected, compilerVersion: 'drifted' },
            manifest,
          ),
        ).toBe(false);
      });
    });
  }
});

describe('[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION', () => {
  const definers = migrationFiles.filter((name) =>
    /create\s+or\s+replace\s+function\s+platform_private\.cms_tzdb_version\s*\(\s*\)/iu.test(
      migration(name),
    ),
  );

  it('is defined by the 20261005017595 forward migration', () => {
    expect(definers).toContain('20261005017595_cms_tzdb_version.sql');
  });

  it('returns, in the last migration that defines it, the literal tag the contracts constant pins', () => {
    const last = definers.at(-1);
    expect(last).toBeDefined();
    const returned = tzdbLiteral(migration(last as string));
    expect(returned).toBe(CMS_TZDB_VERSION);
    expect(returned).toMatch(/^[A-Za-z0-9._-]{1,32}$/u);
  });

  it('would notice a drifted literal, a drifted digest or a missing definition', () => {
    const sql = migration('20261005017595_cms_tzdb_version.sql');
    expect(tzdbLiteral(sql.replace("'2026e'::text", "'2026d'::text"))).not.toBe(
      CMS_TZDB_VERSION,
    );
    expect(tzdbLiteral('select 1')).toBeUndefined();
    expect(sql.replace(CMS_TZDB_SHA256, 'f'.repeat(64))).not.toContain(
      CMS_TZDB_SHA256,
    );
  });

  it('documents the same snapshot digest as the pin', () => {
    expect(migration('20261005017595_cms_tzdb_version.sql')).toContain(
      CMS_TZDB_SHA256,
    );
  });
});

describe('[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY', () => {
  const seed = migration('20261005017060_cms_preflight_registry.sql');
  const rows = [
    ...seed.matchAll(
      /^\s*\('([a-z_]+)',\s*'([a-z0-9-]+)',\s*'([a-z0-9._-]+)',\s*'([a-z_]+)',\s*(null|'[a-z_]+')\)/gmu,
    ),
  ].map((match) => ({
    category: match[1],
    providerKey: match[3],
    providerKind: match[4],
    referenceKind: match[5] === 'null' ? null : match[5]?.slice(1, -1),
  }));

  it('seeds the seventeen categories in registry order', () => {
    expect(rows.map(({ category }) => category)).toEqual([
      ...CMS_PREFLIGHT_CATEGORIES,
    ]);
  });

  it('seeds each category with the provider key, kind and reference kind the contracts declare', () => {
    expect(rows).toEqual(
      CMS_PREFLIGHT_REGISTRY.map(
        ({ category, providerKey, providerKind, referenceKind }) => ({
          category,
          providerKey,
          providerKind,
          referenceKind,
        }),
      ),
    );
  });

  it('seeds registry version 1 and provider version 1 for every row', () => {
    expect(seed).toMatch(/'seeded',\s*1,\s*member\.category/u);
    expect(seed).toMatch(/member\.provider_key,\s*1,/u);
    for (const row of CMS_PREFLIGHT_REGISTRY) {
      expect(row.registryVersion).toBe('1');
      expect(row.providerVersion).toBe('1');
    }
  });
});

describe('[P2-S11-AC-091][P2-S11-AC-092] the SQL settings registry equals CMS_PUBLICATION_SETTINGS_KEYS', () => {
  const body = migration(
    '20261005017550_cms_publication_settings_snapshot.sql',
  );

  it('returns an empty key array at registry version 1, as the contracts constant does', () => {
    expect(CMS_PUBLICATION_SETTINGS_REGISTRY_VERSION).toBe(1);
    expect([...CMS_PUBLICATION_SETTINGS_KEYS]).toEqual([]);
    expect(body).toMatch(
      /cms_publication_settings_keys\(\)[\s\S]*?select\s+array\[\]::text\[\]/iu,
    );
    expect(body).toMatch(
      /cms_publication_settings_registry_version\(\)[\s\S]*?select\s+1::bigint/iu,
    );
  });
});
