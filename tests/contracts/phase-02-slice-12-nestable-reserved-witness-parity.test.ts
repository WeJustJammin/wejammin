import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-172] [P2-S12-AC-189] DEC-232 / V14-04: the populated-table witness
 * (supabase/tests/phase_02_slice_12_nestable_read_populated.sql) replays the DDL of the forward migration that adds `nestable` to the reserved
 * pattern keys: the stored-row pre-check (SQLSTATE 55000, named count) and the CHECK swap. A replay of a COPY proves nothing if the copy
 * drifts, so the text between the BEGIN/END NESTABLE-RESERVED-DDL markers must be identical in both files. The migration is read from
 * supabase/migrations once root has promoted it, else from the lane's WIP directory.
 */
const BEGIN = '-- BEGIN NESTABLE-RESERVED-DDL';
const END = '-- END NESTABLE-RESERVED-DDL';
const MIGRATION = '20261027100020_cms_pattern_key_reserved_nestable.sql';

const path = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const migrationPath = (): string => {
  const promoted = path(`../../supabase/migrations/${MIGRATION}`);
  return existsSync(promoted)
    ? promoted
    : path(`../../supabase/migrations-wip/nestable-read/${MIGRATION}`);
};

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
        '../../supabase/tests/phase_02_slice_12_nestable_read_populated.sql',
      ),
      'utf8',
    ),
  );

describe('nestable reserved-key migration witness', () => {
  it('replays exactly the DDL of 20261027100020_cms_pattern_key_reserved_nestable.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      "where pattern_key = 'nestable'",
      "errcode = '55000'",
      'DEC-232 refused: % stored pattern version(s) hold the reserved key nestable',
      'drop constraint cms_pattern_versions_pattern_key_not_reserved',
      "check (pattern_key not in ('context', 'versions', 'selector', 'nestable', 'new'))",
    ])
      expect(ddl).toContain(needle);
  });

  it('runs the pre-check before the constraint is dropped', () => {
    const ddl = migration();
    expect(ddl.indexOf('raise exception')).toBeGreaterThan(-1);
    expect(ddl.indexOf('raise exception')).toBeLessThan(
      ddl.indexOf('drop constraint'),
    );
  });
});
