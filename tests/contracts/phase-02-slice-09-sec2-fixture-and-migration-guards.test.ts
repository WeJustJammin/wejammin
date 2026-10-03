import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * SEC-2 structural guards that no pgTAP run can express:
 *  - every direct write to an authority table in a Slice 09 pgTAP file is a LABELLED forgery
 *    (a fixture without a producer, a time-warp of a real row, a legacy fixture or a negative
 *    control), so a test can no longer claim a producer path with a hand-written row;
 *  - the SEC-2 migrations use only statements a hosted Supabase `postgres` (CREATEROLE, not
 *    SUPERUSER) can run.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const TESTS = resolve(ROOT, 'supabase/tests');
const MIGRATIONS = resolve(ROOT, 'supabase/migrations');

const filesUnder = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

const AUTHORITY_TABLES = [
  'identity_private.membership_tenure',
  'identity_private.organization_actor_grant',
  'identity_private.organization_party',
  'platform_private.acting_context_binding',
  'platform_private.admin_capability_grants',
  'platform_private.cms_capability_grants',
  'platform_private.cms_owner_initialization',
  'platform_private.cms_schema_review_assignments',
  'platform_private.cms_schema_review_decisions',
  'platform_private.cms_schema_reviews',
  'platform_private.cms_schema_dry_run_reports',
  'platform_private.cms_schema_migration_plans',
];
const DIRECT_WRITE = new RegExp(
  `^\\s*(insert into|update|delete from)\\s+(${AUTHORITY_TABLES.map((t) =>
    t.replace('.', '\\.'),
  ).join('|')})\\b`,
  'i',
);
const LABEL =
  /FIXTURE FORGERY|TIME-WARP|NEGATIVE[ -]CONTROL|LEGACY FIXTURE|negative[ -]control/i;

const slice09Files = filesUnder(TESTS).filter(
  (path) =>
    /phase_02_slice_09/.test(relative(TESTS, path)) &&
    /\.(sql|sqlinc|mjs)$/.test(path),
);

describe('Slice 09 pgTAP fixtures: authority writes are labelled forgeries', () => {
  it('finds the Slice 09 pgTAP files', () => {
    expect(slice09Files.length).toBeGreaterThan(50);
  });

  it('labels every direct write to an authority table within the six preceding lines', () => {
    const unlabelled: string[] = [];
    for (const path of slice09Files) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!DIRECT_WRITE.test(line)) return;
        const context = lines.slice(Math.max(0, index - 6), index).join('\n');
        if (!LABEL.test(context))
          unlabelled.push(`${relative(ROOT, path)}:${index + 1}`);
      });
    }
    expect(unlabelled).toEqual([]);
  });

  it('keeps at least one labelled forgery of each kind visible (the guard is not vacuous)', () => {
    const all = slice09Files
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    for (const kind of [
      'FIXTURE FORGERY',
      'TIME-WARP',
      'NEGATIVE CONTROL',
      'LEGACY FIXTURE FORGERY',
    ])
      expect(all).toContain(kind);
  });
});

describe('SEC-2 migrations run on hosted Supabase', () => {
  const sec2 = readdirSync(MIGRATIONS)
    .filter((name) => /^202610031[2-9]\d{4}_/.test(name))
    .sort();

  it('lists the definer-role migrations in order', () => {
    expect(sec2[0]).toBe('20261003120000_cms_definer_roles.sql');
    expect(sec2[sec2.length - 1]).toMatch(
      /_cms_definer_function_ownership\.sql$/,
    );
  });

  it('uses no superuser-only statement and never grants a bypass attribute', () => {
    const offenders: string[] = [];
    for (const name of sec2) {
      const text = readFileSync(join(MIGRATIONS, name), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      for (const [pattern, why] of [
        [/(?<!no)superuser/i, 'superuser attribute'],
        [/(?<!no)bypassrls/i, 'BYPASSRLS attribute'],
        [/\balter\s+system\b/i, 'ALTER SYSTEM'],
        [/\bon\s+parameter\b/i, 'GRANT ON PARAMETER'],
        [/session_replication_role/i, 'session_replication_role'],
        [/\bcreate\s+extension\b/i, 'CREATE EXTENSION'],
        [/\bsecurity\s+label\b/i, 'SECURITY LABEL'],
      ] as const)
        if (pattern.test(text)) offenders.push(`${name}: ${why}`);
    }
    expect(offenders).toEqual([]);
  });

  it('creates both definer roles NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE', () => {
    const roles = readFileSync(join(MIGRATIONS, sec2[0] ?? ''), 'utf8');
    for (const role of [
      'wejammin_cms_definer',
      'wejammin_cms_authority_reader',
    ])
      expect(roles).toMatch(
        new RegExp(
          `create role ${role} nologin nosuperuser nobypassrls nocreaterole nocreatedb noreplication`,
        ),
      );
  });
});
