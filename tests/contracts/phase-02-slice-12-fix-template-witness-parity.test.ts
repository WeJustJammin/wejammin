import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-190] [P2-S12-AC-191] The populated-table witness
 * (supabase/tests/phase_02_slice_12_fix_template_populated.sql) replays the DDL of the forward
 * migration that makes template keys per owner. A replay of a COPY proves nothing if the copy drifts,
 * so the text between the BEGIN/END FIX-TEMPLATE-LINEAGE-DDL markers must be identical in both files.
 */
const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const region = (source: string): string => {
  const begin = source.indexOf('-- BEGIN FIX-TEMPLATE-LINEAGE-DDL');
  const end = source.indexOf('-- END FIX-TEMPLATE-LINEAGE-DDL');
  expect(begin).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(begin);
  return source.slice(begin, end + '-- END FIX-TEMPLATE-LINEAGE-DDL'.length);
};

describe('template lineage migration witness', () => {
  it('replays exactly the DDL of 20261013100000_cms_template_per_owner_keys_lineage.sql', () => {
    const migration = region(
      read(
        '../../supabase/migrations/20261013100000_cms_template_per_owner_keys_lineage.sql',
      ),
    );
    const witness = region(
      read('../../supabase/tests/phase_02_slice_12_fix_template_populated.sql'),
    );
    expect(witness).toBe(migration);
    // The region is the whole transform, not a stub: backfill, the key constraints, both CHECKs
    // and the guard replacement.
    for (const needle of [
      'add column template_id uuid',
      'with recursive lineage',
      'cms_template_versions_owner_key_version_unique',
      'cms_template_versions_template_key_not_reserved',
      'cms_template_versions_audience_grammar',
      'create or replace function platform_private.cms_template_versions_guard()',
    ])
      expect(migration).toContain(needle);
  });
});
