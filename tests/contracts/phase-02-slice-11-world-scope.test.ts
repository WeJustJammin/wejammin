/**
 * Pure controls for the Slice 11 shared-database world scope (lane claude_s12_s11_sweep_isolation).
 * The Worker sweep claims EVERY due schedule in the database (BE03b CMS-03B-20), and `pnpm db:api-test`
 * commits fixtures without resetting between files, so a sweep suite must judge only its own world's
 * claims and its own world's rows. These controls pin that rule without a database.
 */
import { describe, expect, it } from 'vitest';

import { EFFECT_TABLES } from '../postgrest/support/phase-02-slice-11-snapshot-core';
import {
  claimsInWorld,
  expectWorldClaims,
  scopedSnapshotSql,
} from '../postgrest/support/phase-02-slice-11-world-scope-core';

const id = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const claim = (n: number) => ({ scheduleId: id(n) });

describe('world claims', () => {
  it('keeps only the claims of this world and ignores another suite due schedule', () => {
    const batch = [claim(1), claim(90), claim(2)];
    expect(claimsInWorld(batch, [id(1), id(2), id(3)])).toEqual([
      claim(1),
      claim(2),
    ]);
  });

  it('accepts a batch that also carries foreign claims when this world claims exactly the expected ids', () => {
    expect(() =>
      expectWorldClaims(
        [claim(90), claim(2), claim(91), claim(1)],
        [id(1), id(2), id(3)],
        [id(2), id(1)],
        'own claims',
      ),
    ).not.toThrow();
  });

  it('rejects a missing own claim', () => {
    expect(() =>
      expectWorldClaims(
        [claim(1), claim(90)],
        [id(1), id(2)],
        [id(1), id(2)],
        'own',
      ),
    ).toThrow(/own/u);
  });

  it('rejects an own world schedule that was claimed but not expected', () => {
    expect(() =>
      expectWorldClaims([claim(1), claim(2)], [id(1), id(2)], [id(1)], 'own'),
    ).toThrow(/own/u);
  });

  it('accepts an empty expectation only when no world schedule was claimed', () => {
    expect(() =>
      expectWorldClaims([claim(90)], [id(1)], [], 'none'),
    ).not.toThrow();
    expect(() =>
      expectWorldClaims([claim(1), claim(90)], [id(1)], [], 'none'),
    ).toThrow(/none/u);
  });

  it('refuses an expectation outside the world, so a typo cannot pass vacuously', () => {
    expect(() =>
      expectWorldClaims([claim(90)], [id(1)], [id(90)], 'outside'),
    ).toThrow(/expected ids must belong to the world/u);
  });

  it('rejects a duplicated own claim', () => {
    expect(() =>
      expectWorldClaims([claim(1), claim(1)], [id(1)], [id(1)], 'dup'),
    ).toThrow(/dup/u);
  });
});

describe('scoped snapshot sql', () => {
  const sql = scopedSnapshotSql([id(1), id(2)]);

  it('digests every effect table exactly once', () => {
    for (const table of EFFECT_TABLES)
      expect(sql.split(`('${table}',`).length - 1, table).toBe(1);
  });

  it('derives the world only from the named schedule ids', () => {
    expect(sql).toContain(`array['${id(1)}', '${id(2)}']::uuid[]`);
  });

  it('filters the sweep-written tables to the world and leaves unkeyed tables whole', () => {
    expect(sql).toContain('platform_private.cms_publication_schedules t where');
    expect(sql).toContain('audit_private.audit_events t where');
    expect(sql).toContain('platform_private.outbox_events t where');
    expect(sql).not.toContain('platform_private.idempotency_records t where');
    expect(sql).not.toContain(
      'platform_private.cms_publication_settings_snapshots t where',
    );
  });

  it('rejects an empty world and a non-uuid id before any SQL is built', () => {
    expect(() => scopedSnapshotSql([])).toThrow(/world/u);
    expect(() => scopedSnapshotSql(["x'); drop table t; --"])).toThrow(
      /world/u,
    );
  });
});
