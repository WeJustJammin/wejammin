import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Slice 12 race modules run in every canonical `pnpm db:verify` (like the Slice 10 and
 * 11 modules) through ONE explicit opt-in: `WEJAMMIN_CANONICAL_RACE=1`, which only
 * `infra/run-database-race-runners.mjs` sets for the modules it launches. These tests
 * never open a database: each module under test is imported in a clean child process
 * and only its target assertions (which run before any database access) are executed.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');
const url = (relativePath: string): string =>
  pathToFileURL(resolve(ROOT, relativePath)).href;

const PRIMARY = '/home/rob/Projects/WeJammin';

type CanonicalMode = {
  CANONICAL_RACE_ENV: string;
  isCanonicalRace: (env?: Record<string, string | undefined>) => boolean;
  canonicalContainer: (env?: Record<string, string | undefined>) => string;
  assertRaceCheckout: (options: {
    root: string;
    env?: Record<string, string | undefined>;
  }) => void;
  assertCanonicalTarget: (options: {
    altEnvNames?: readonly string[];
    env?: Record<string, string | undefined>;
  }) => string;
};

const mode = (await import(
  resolve(ROOT, 'infra/database-races/canonical-mode.mjs')
)) as CanonicalMode;

const gate = (await import(
  resolve(ROOT, 'infra/run-database-race-runners.mjs')
)) as {
  raceEnvironment: (
    env: Record<string, string | undefined>,
  ) => Record<string, string | undefined>;
};

type Probe = { threw: string | null; container: string | null };

/** Imports `file` in a clean child process, runs `call` on it, reports what it threw. */
const probe = (
  file: string,
  call: string,
  env: Record<string, string>,
): Probe => {
  const script = `
    const m = await import(${JSON.stringify(url(file))});
    let threw = null;
    try { ${call} } catch (error) { threw = String(error?.message ?? error); }
    console.log(JSON.stringify({ threw, container: m.container ?? m.targetContainer?.() ?? null }));
  `;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      env: { PATH: process.env.PATH ?? '', ...env },
      encoding: 'utf8',
      cwd: ROOT,
    },
  );
  expect(result.stderr, result.stderr).toBe('');
  return JSON.parse(result.stdout.trim().split('\n').at(-1) as string) as Probe;
};

const CANONICAL = { WEJAMMIN_CANONICAL_RACE: '1' };

describe('the canonical-mode opt-in helper', () => {
  it('is selected only by WEJAMMIN_CANONICAL_RACE equal to exactly 1', () => {
    expect(mode.CANONICAL_RACE_ENV).toBe('WEJAMMIN_CANONICAL_RACE');
    expect(mode.isCanonicalRace({ WEJAMMIN_CANONICAL_RACE: '1' })).toBe(true);
    for (const value of [undefined, '', '0', 'true', 'yes', ' 1'])
      expect(mode.isCanonicalRace({ WEJAMMIN_CANONICAL_RACE: value })).toBe(
        false,
      );
    expect(mode.isCanonicalRace({})).toBe(false);
  });

  it('resolves the container exactly as the Slice 10 and 11 modules do', () => {
    expect(mode.canonicalContainer({})).toBe('supabase_db_wejammin');
    expect(
      mode.canonicalContainer({ AC217_DB_CONTAINER: 'supabase_db_a' }),
    ).toBe('supabase_db_a');
    expect(
      mode.canonicalContainer({
        AC217_DB_CONTAINER: 'supabase_db_a',
        S10_RACE_DB_CONTAINER: 'supabase_db_b',
      }),
    ).toBe('supabase_db_b');
    const kit = read('infra/database-races/race-kit.mjs');
    expect(kit).toContain('process.env.S10_RACE_DB_CONTAINER ??');
    expect(kit).toContain('process.env.AC217_DB_CONTAINER ??');
  });

  it('refuses a non-Supabase container and a concurrent ALT release', () => {
    const env = CANONICAL;
    expect(mode.assertCanonicalTarget({ env })).toBe('supabase_db_wejammin');
    expect(() =>
      mode.assertCanonicalTarget({
        env: { ...env, S10_RACE_DB_CONTAINER: 'postgres' },
      }),
    ).toThrow(/named local Supabase container required/u);
    expect(() =>
      mode.assertCanonicalTarget({
        altEnvNames: ['S12_X_ROOT_RELEASE'],
        env: { ...env, S12_X_ROOT_RELEASE: 'anything' },
      }),
    ).toThrow(/mutually exclusive/u);
    expect(() => mode.assertCanonicalTarget({ env: {} })).toThrow(
      /WEJAMMIN_CANONICAL_RACE/u,
    );
  });

  it('DEC-225: canonical mode may run from the primary checkout; ALT mode may not', () => {
    // Canonical (the owner runs pnpm db:verify from the primary checkout): any checkout is allowed.
    expect(() =>
      mode.assertRaceCheckout({ root: PRIMARY, env: CANONICAL }),
    ).not.toThrow();
    expect(() =>
      mode.assertRaceCheckout({ root: '/work/WeJammin', env: CANONICAL }),
    ).not.toThrow();
    // ALT mode (no opt-in, or the opt-in with any value but exactly 1) keeps the lane-safety refusal.
    for (const env of [{}, { WEJAMMIN_CANONICAL_RACE: '0' }])
      expect(() => mode.assertRaceCheckout({ root: PRIMARY, env })).toThrow(
        /protected primary checkout is forbidden/u,
      );
    expect(() =>
      mode.assertRaceCheckout({ root: '/work/WeJammin', env: {} }),
    ).not.toThrow();
  });
});

describe('the race gate opts every module it launches into canonical mode', () => {
  it('raceEnvironment adds the opt-in and keeps every other variable', () => {
    expect(
      gate.raceEnvironment({
        PATH: '/bin',
        S10_RACE_DB_CONTAINER: 'supabase_db_x',
      }),
    ).toEqual({
      PATH: '/bin',
      S10_RACE_DB_CONTAINER: 'supabase_db_x',
      WEJAMMIN_CANONICAL_RACE: '1',
    });
    expect(
      gate.raceEnvironment({ WEJAMMIN_CANONICAL_RACE: '0' })
        .WEJAMMIN_CANONICAL_RACE,
    ).toBe('1');
  });

  it('the spawn passes raceEnvironment and the header documents the opt-in', () => {
    const source = read('infra/run-database-race-runners.mjs');
    expect(source).toMatch(/env:\s*raceEnvironment\(process\.env\)/u);
    expect(source).toContain('WEJAMMIN_CANONICAL_RACE');
    expect(read('infra/database-races/README.md')).toContain(
      'WEJAMMIN_CANONICAL_RACE',
    );
  });
});

const WRITER_KIT =
  'supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs';
const PUBLICATION_KIT =
  'supabase/tests/phase_02_slice_12_dec193_pattern_currentness/091-publication-race-session-kit.mjs';
const ALT_CONTAINER = 'supabase_db_wejammin_ev';

describe.each([
  {
    name: 'DEC193 writer',
    file: WRITER_KIT,
    release: {
      S12_DEC193_WRITER_RACE_ROOT_RELEASE: '2026-10-16-native-writer-red',
      S12_DEC193_WRITER_RACE_ALT_CONTAINER: ALT_CONTAINER,
    },
  },
  {
    name: 'DEC199 publication',
    file: PUBLICATION_KIT,
    release: {
      S12_DEC199_PUBLICATION_RACE_ROOT_RELEASE:
        '2026-10-16-native-publication-red',
      S12_DEC199_PUBLICATION_RACE_ALT_CONTAINER: ALT_CONTAINER,
    },
  },
])('$name kit target selection', ({ file, release }) => {
  it('canonical mode accepts the canonical container with no ALT release', () => {
    expect(probe(file, 'm.assertTarget();', CANONICAL)).toEqual({
      threw: null,
      container: 'supabase_db_wejammin',
    });
  });

  it('canonical mode honours S10_RACE_DB_CONTAINER like the Slice 10 and 11 modules', () => {
    expect(
      probe(file, 'm.assertTarget();', {
        ...CANONICAL,
        S10_RACE_DB_CONTAINER: 'supabase_db_other',
      }),
    ).toEqual({ threw: null, container: 'supabase_db_other' });
  });

  it('without the opt-in the ALT release is still required and the ALT container is fixed', () => {
    const refused = probe(file, 'm.assertTarget();', {});
    expect(refused.threw).toMatch(/release required/u);
    expect(refused.container).toBe(ALT_CONTAINER);
    expect(probe(file, 'm.assertTarget();', release)).toEqual({
      threw: null,
      container: ALT_CONTAINER,
    });
  });

  it('canonical mode and an ALT release together are refused', () => {
    expect(
      probe(file, 'm.assertTarget();', { ...CANONICAL, ...release }).threw,
    ).toMatch(/mutually exclusive/u);
  });
});

describe.each([
  {
    name: 'entry default template lock',
    file: 'supabase/tests/phase_02_slice_12_entry_default_template_lock/040-race-session.mjs',
    release: {
      RUN_S12_ENTRY_DEFAULT_TEMPLATE_LOCK_RACE: '1',
      S12_ENTRY_DEFAULT_TEMPLATE_LOCK_DB_CONTAINER: ALT_CONTAINER,
      S12_ENTRY_DEFAULT_TEMPLATE_LOCK_CONFIRM_CONTAINER: ALT_CONTAINER,
    },
    container: true,
  },
  {
    name: 'restore relation visibility',
    file: 'supabase/tests/phase_02_slice_12_restore_relation_visibility/040-race-session.mjs',
    release: {
      RUN_S12_RESTORE_RELATION_RACE: '1',
      S10_RACE_DB_CONTAINER: ALT_CONTAINER,
      S12_RESTORE_RELATION_CONFIRM_CONTAINER: ALT_CONTAINER,
    },
    container: false,
  },
])('$name session target selection', ({ file, release, container }) => {
  it('canonical mode passes with no ALT release', () => {
    const result = probe(file, 'm.requireAltRelease();', CANONICAL);
    expect(result.threw).toBeNull();
    if (container) expect(result.container).toBe('supabase_db_wejammin');
  });

  it('without the opt-in the explicit ALT release is still required', () => {
    expect(probe(file, 'm.requireAltRelease();', {}).threw).not.toBeNull();
    expect(probe(file, 'm.requireAltRelease();', release).threw).toBeNull();
  });

  it('canonical mode and an ALT release together are refused', () => {
    expect(
      probe(file, 'm.requireAltRelease();', { ...CANONICAL, ...release }).threw,
    ).toMatch(/mutually exclusive/u);
  });
});

describe('the standalone Slice 12 modules select canonical mode before any database access', () => {
  for (const file of [
    'supabase/tests/phase_02_slice_12_dec194_outer.race.mjs',
    'supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs',
  ])
    it(`${file} gates its ALT asserts on the opt-in and refuses the primary checkout only through assertRaceCheckout`, () => {
      const source = read(file);
      expect(source).toContain('infra/database-races/canonical-mode.mjs');
      expect(source).toContain('isCanonicalRace()');
      expect(source).toContain('assertCanonicalTarget(');
      expect(source).toContain('assertRaceCheckout({ root })');
      // No second, unconditional copy of the primary-checkout assert.
      expect(source).not.toContain('/home/rob/Projects/WeJammin');
      // The ALT-only asserts still exist, inside the non-canonical branch.
      expect(source).toContain("'supabase_db_wejammin'");
      expect(source).toContain('ROOT_RELEASE');
    });
});

describe('the two kits refuse the primary checkout only through assertRaceCheckout', () => {
  for (const file of [WRITER_KIT, PUBLICATION_KIT])
    it(`${file} calls assertRaceCheckout and keeps no raw primary path`, () => {
      const source = read(file);
      expect(source).toContain('assertRaceCheckout({ root })');
      expect(source).not.toContain('/home/rob/Projects/WeJammin');
    });
});

describe('node:test modules print the ok lines the race gate counts', () => {
  for (const file of [
    'supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs',
    'supabase/tests/phase_02_slice_12_restore_relation_visibility/020-race.mjs',
  ])
    it(`${file} logs an "ok - " receipt only after a scenario passed`, () => {
      // node:test's TAP reporter prints "ok 1 - name", which the gate's "ok - " verdict never counts.
      expect(read(file)).toMatch(/console\.log\(`ok - /u);
    });
});

describe('the governed-authority fixture reaches its state through real producers', () => {
  it('the capability grant carries the recent-MFA step-up proof cms_review_binding requires', () => {
    const source = read(
      'supabase/tests/phase_02_slice_12_governed_authority/governed-authority-kit.mjs',
    );
    const grant = source.slice(
      source.indexOf("'cms_grant_capability'"),
      source.indexOf("for (const label of ['subject1'"),
    );
    expect(grant).toContain('context: stepUpContext(ids)');
    const proof = source.slice(
      source.indexOf('const stepUpContext'),
      source.indexOf('export const nextKey'),
    );
    expect(proof).toContain('stepUpVerified: true');
    expect(proof).toMatch(
      /stepUpAt: new Date\(Date\.now\(\) - 60_000\)\.toISOString\(\)/u,
    );
    // No trigger is disabled and no active row is inserted to get around the proof.
    expect(source).not.toMatch(/disable trigger|session_replication_role/iu);
    expect(source).not.toMatch(
      /insert into (identity_private|platform_private)\./iu,
    );
  });
});
