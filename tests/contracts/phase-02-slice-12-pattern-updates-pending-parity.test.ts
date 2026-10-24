import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-258] The populated-table witness
 * (supabase/tests/phase_02_slice_12_pattern_updates/populated-pending.sql) loads a populated store, reverts the
 * `pending_pattern_version` column and replays the DDL of the forward migration that adds and constrains it. A replay
 * of a COPY proves nothing if the copy drifts, so the text between the BEGIN/END COMPOSITION-PENDING-DDL markers
 * must be identical in both files. The migration is read from supabase/migrations (promoted).
 */
const BEGIN = '-- BEGIN COMPOSITION-PENDING-DDL';
const END = '-- END COMPOSITION-PENDING-DDL';
const MIGRATION = '20261014140000_cms_composition_instance_pending_version.sql';

const path = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const migrationPath = (): string =>
  path(`../../supabase/migrations/${MIGRATION}`);

const region = (source: string): string => {
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  expect(begin).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(begin);
  expect(source.indexOf(BEGIN, begin + 1)).toBe(-1);
  return source.slice(begin, end + END.length);
};

const migration = (): string => region(readFileSync(migrationPath(), 'utf8'));
const witness = (): string =>
  region(
    readFileSync(
      path(
        '../../supabase/tests/phase_02_slice_12_pattern_updates/populated-pending.sql',
      ),
      'utf8',
    ),
  );

describe('composition pending_pattern_version migration witness', () => {
  it('replays exactly the DDL of 20261014140000_cms_composition_instance_pending_version.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      "where state = 'pending_diff'",
      "errcode = '55000'",
      'add column pending_pattern_version integer',
      'cms_composition_instances_pending_version_check',
      "(state = 'pending_diff') = (pending_pattern_version is not null)",
      'pending_pattern_version between 1 and 2147483647',
    ])
      expect(ddl).toContain(needle);
    expect(ddl.length).toBeGreaterThan(700);
  });

  it('detects drift: one changed byte in the witness copy is not equal', () => {
    const drifted = witness().replace('between 1 and', 'between 0 and');
    expect(drifted).not.toBe(witness());
    expect(drifted).not.toBe(migration());
  });
});
