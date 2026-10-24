import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-218] The populated-table witness
 * (supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql) reverts the `position` column,
 * loads legacy rows and replays the DDL of the forward migration that adds, backfills and constrains it. A replay
 * of a COPY proves nothing if the copy drifts, so the text between the BEGIN/END COMPOSITION-POSITION-DDL markers
 * must be identical in both files. The migration is read from supabase/migrations (promoted).
 */
const BEGIN = '-- BEGIN COMPOSITION-POSITION-DDL';
const END = '-- END COMPOSITION-POSITION-DDL';
const MIGRATION = '20261014110000_cms_composition_instance_position.sql';

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
        '../../supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql',
      ),
      'utf8',
    ),
  );

describe('composition position migration witness', () => {
  it('replays exactly the DDL of 20261014110000_cms_composition_instance_position.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      'add column position integer',
      'disable trigger cms_composition_instances_write_guard',
      'disable trigger cms_composition_instances_immutable_guard',
      'dense_rank()',
      'order by instance.path collate "C"',
      'partition by instance.revision_id, instance.slot_key',
      'enable trigger cms_composition_instances_write_guard',
      'enable trigger cms_composition_instances_immutable_guard',
      'alter column position set not null',
      'cms_composition_instances_position_check check (position >= 0)',
      'cms_composition_instances_revision_slot_position_idx',
    ])
      expect(ddl).toContain(needle);
    expect(ddl.length).toBeGreaterThan(1200);
  });

  it('detects drift: one changed byte in the witness copy is not equal', () => {
    const drifted = witness().replace('dense_rank', 'dense_rank_');
    expect(drifted).not.toBe(witness());
    expect(drifted).not.toBe(migration());
  });
});
