/**
 * PURE world-scope core for the Slice 11 sweep suites (lane claude_s12_s11_sweep_isolation).
 *
 * The Worker sweep claims EVERY due schedule in the database (BE03b CMS-03B-20), and
 * `pnpm db:api-test` commits fixtures without resetting between files: a schedule another suite
 * created (for example the +300 s schedules of the schedule-precision suites) can fall due during
 * a long retry-ladder sleep and is claimed and executed by the tick under test. A sweep suite must
 * therefore judge only the claims and the rows of its OWN world, and must never assume that no
 * other schedule is due. A world is the set of schedule ids the suite created; all Slice 11 suites
 * share one owner, so the owner cannot identify a world.
 *
 * This module imports no database or stack module (controls import it directly); the DB-bearing
 * `scopedSnapshotDigest` lives in `phase-02-slice-11-world-scope.ts`.
 */
import { expectSafeEqual } from './phase-02-slice-11-assert-core';
import {
  DEFAULT_ROW_TEXT,
  EFFECT_TABLES,
  tableDigestSql,
} from './phase-02-slice-11-snapshot-core';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Fixed message: an offending id is never echoed. */
const assertWorld = (worldIds: readonly string[]): readonly string[] => {
  if (worldIds.length === 0 || !worldIds.every((id) => UUID.test(id)))
    throw new Error(
      'world scope needs one or more lowercase uuid schedule ids',
    );
  return [...new Set(worldIds)];
};

/** The claims that belong to this world; another suite's due schedule is ignored. */
export const claimsInWorld = <T extends Readonly<{ scheduleId: string }>>(
  claims: readonly T[],
  worldIds: readonly string[],
): readonly T[] => {
  const world = new Set(assertWorld(worldIds));
  return claims.filter((claim) => world.has(claim.scheduleId));
};

/**
 * Assert this world claimed exactly `expectedIds` (no more, no fewer, no duplicate). Because the
 * comparison covers every claim whose id is in the world, it also proves that none of the world's
 * other schedules (not yet due, blocked, exhausted, cancelled) was claimed. Claims of schedules
 * outside the world are not judged here.
 */
export const expectWorldClaims = (
  claims: readonly Readonly<{ scheduleId: string }>[],
  worldIds: readonly string[],
  expectedIds: readonly string[],
  label: string,
): void => {
  const world = new Set(assertWorld(worldIds));
  if (!expectedIds.every((id) => world.has(id)))
    throw new Error('expected ids must belong to the world');
  expectSafeEqual(
    claimsInWorld(claims, worldIds)
      .map((claim) => claim.scheduleId)
      .sort(),
    [...expectedIds].sort(),
    `${label}: claims of this world`,
  );
};

type EffectTable = (typeof EFFECT_TABLES)[number];

/**
 * Row filter per effect table (alias `t`) over the world CTEs of `scopedSnapshotSql`. A table the
 * sweep never writes and that carries no world key (`null`) stays a whole-table digest, so scoping
 * only removes other worlds' rows and never weakens a group.
 */
const WORLD_FILTER: Readonly<Record<EffectTable, string | null>> = {
  'platform_private.cms_editorial_reviews':
    't.revision_id in (select id from r)',
  'platform_private.cms_editorial_decisions':
    't.review_id in (select id from rv)',
  'platform_private.cms_editorial_review_assignments':
    't.review_id in (select id from rv)',
  'platform_private.cms_editorial_review_dependencies':
    't.review_id in (select id from rv)',
  'platform_private.cms_publication_schedules':
    't.entry_id in (select id from e)',
  'platform_private.cms_publication_versions':
    't.entry_id in (select id from e)',
  'platform_private.cms_preview_tokens': 't.entry_id in (select id from e)',
  'platform_private.cms_publication_settings_snapshots': null,
  'platform_private.cms_command_accessibility_evidence':
    't.revision_id in (select id from r)',
  'platform_private.idempotency_records': null,
  'platform_private.outbox_events': 't.aggregate_id in (select id from a)',
  'audit_private.audit_events': 't.target_id in (select id from a)',
  'platform_private.cms_content_entries': 't.id in (select id from e)',
  'platform_private.cms_entry_revisions': 't.entry_id in (select id from e)',
};

/**
 * The world's reachable ids: schedules `s` -> entries `e` -> revisions `r` -> reviews `rv`,
 * publication versions `v`, and `a` (every id an audit target or outbox aggregate can carry).
 */
const worldCtes = (ids: readonly string[]): string => `with
  s as (select id, entry_id from platform_private.cms_publication_schedules
         where id = any(array[${ids.map((id) => `'${id}'`).join(', ')}]::uuid[])),
  e as (select distinct entry_id as id from s),
  r as (select id from platform_private.cms_entry_revisions
         where entry_id in (select id from e)),
  rv as (select id from platform_private.cms_editorial_reviews
          where revision_id in (select id from r)),
  v as (select id, publication_id from platform_private.cms_publication_versions
         where entry_id in (select id from e)),
  a as (select id from e union select id from r union select id from rv
        union select id from v union select publication_id from v
        union select id from platform_private.cms_publication_schedules
               where entry_id in (select id from e))`;

/** The SQL that returns a closed `EffectSnapshot` payload restricted to this world. */
export const scopedSnapshotSql = (worldIds: readonly string[]): string => {
  const ids = assertWorld(worldIds);
  const groups = EFFECT_TABLES.map((table) => {
    const filter = WORLD_FILTER[table];
    const source =
      filter === null ? table : `(select * from ${table} t where ${filter})`;
    return `('${table}', (${tableDigestSql(source, DEFAULT_ROW_TEXT, false)}))`;
  }).join(', ');
  return `${worldCtes(ids)}
select pg_catalog.jsonb_object_agg(tbl, d) from (values ${groups}) as x(tbl, d)`;
};

/** SQL that counts how many of the world's schedule ids exist (a typo must not scope to nothing). */
export const worldScheduleCountSql = (worldIds: readonly string[]): string => {
  const ids = assertWorld(worldIds);
  return `select count(*) from platform_private.cms_publication_schedules
   where id = any(array[${ids.map((id) => `'${id}'`).join(', ')}]::uuid[])`;
};

/** The distinct ids of a world, in first-seen order. */
export const worldIdsOf = (worldIds: readonly string[]): readonly string[] =>
  assertWorld(worldIds);
