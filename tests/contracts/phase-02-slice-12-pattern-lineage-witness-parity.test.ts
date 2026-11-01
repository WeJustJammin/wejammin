import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-100] [P2-S12-AC-103] The populated-table witness
 * (supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql) replays the DDL of the forward
 * migration that makes pattern keys per owner, adds the version lineage and applies the PatternNode forest CHECKs
 * to every row. A replay of a COPY proves nothing if the copy drifts, so the text between the BEGIN/END
 * PATTERN-LINEAGE-DDL markers must be identical in both files. The migration is read from supabase/migrations (promoted).
 */
const BEGIN = '-- BEGIN PATTERN-LINEAGE-DDL';
const END = '-- END PATTERN-LINEAGE-DDL';
const MIGRATION = '20261014020100_cms_pattern_storage_lineage.sql';

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
        '../../supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql',
      ),
      'utf8',
    ),
  );

describe('pattern lineage migration witness', () => {
  it('replays exactly the DDL of 20261014020100_cms_pattern_storage_lineage.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      'add column pattern_id uuid',
      'add column compatible_type_ids jsonb',
      'add column node_count smallint',
      'add column supersedes_id uuid',
      'cms_pattern_versions_block_tree_valid',
      'cms_pattern_versions_pattern_key_not_reserved',
      'cms_composition_instances_pattern_owner_fkey',
      "errcode = '55000'",
      'pattern lineage migration refused',
    ])
      expect(ddl).toContain(needle);
    expect(ddl.length).toBeGreaterThan(3000);
  });

  it('detects drift: one changed byte in the witness copy is not equal', () => {
    const drifted = witness().replace('unique', 'uniqu3');
    expect(drifted).not.toBe(witness());
    expect(drifted).not.toBe(migration());
  });
});
