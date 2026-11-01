import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-124] [P2-S12-AC-125] The populated-table witness
 * (supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql) replays the DDL of the forward
 * migration that makes taxonomy keys per owner and adds the vocabulary lineage. A replay of a COPY proves
 * nothing if the copy drifts, so the text between the BEGIN/END TAXONOMY-LINEAGE-DDL markers must be identical
 * in both files. The migration is read from supabase/migrations (promoted).
 */
const BEGIN = '-- BEGIN TAXONOMY-LINEAGE-DDL';
const END = '-- END TAXONOMY-LINEAGE-DDL';
const MIGRATION = '20261014030000_cms_taxonomy_lineage_columns.sql';

const path = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const migrationPath = (): string =>
  path(`../../supabase/migrations/${MIGRATION}`);

const region = (source: string): string => {
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  expect(begin).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(begin);
  return source.slice(begin, end + END.length);
};

const migration = (): string => region(readFileSync(migrationPath(), 'utf8'));
const witness = (): string =>
  region(
    readFileSync(
      path(
        '../../supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql',
      ),
      'utf8',
    ),
  );

describe('taxonomy lineage migration witness', () => {
  it('replays exactly the DDL of 20261014030000_cms_taxonomy_lineage_columns.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      'cms_canonical_domains_valid',
      'add column taxonomy_id uuid',
      'add column supersedes_id uuid',
      'add column canonical_overlap_domains jsonb',
      'cms_taxonomy_versions_canonical_domains_valid',
    ])
      expect(ddl).toContain(needle);
    expect(ddl.length).toBeGreaterThan(4000);
  });

  it('detects drift: one changed byte in the witness copy is not equal', () => {
    const drifted = witness().replace('unique', 'uniqu3');
    expect(drifted).not.toBe(witness());
    expect(drifted).not.toBe(migration());
  });
});
