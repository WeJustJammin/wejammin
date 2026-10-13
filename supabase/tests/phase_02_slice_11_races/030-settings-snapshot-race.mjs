#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for the settings snapshot ordinal allocation (BE03b "Settings snapshot authority
 * (E7)", DEC-163, global lock order leaf position; tracker P2-S11-AC-092): a new snapshot takes the owner's previous
 * maximum ordinal plus one "under the owner's advisory lock", inserted `ON CONFLICT (owner_id, snapshot_hash) DO
 * NOTHING` and read back.  The lock is the leaf of every ordinary write (20261010130000: after the idempotency
 * reservation is completed, before the snapshot insert); here it is observed from other sessions.
 *
 * The publication settings registry (version 1) has no members, so every real snapshot is the same empty array and
 * an owner only ever has ordinal 1.  To give two first writes DIFFERENT snapshots the runner replaces
 * `cms_publication_settings_effective_values` in this disposable database with a function that, when the session
 * sets `s11race.variant`, answers one extra member carrying that variant; with no variant it answers the registry
 * result (`[]`).  Everything under test is production code: the real `cms_create_entry` and its E7 tail (effective
 * values, digest, advisory lock, ordinal allocation, ON CONFLICT, read-back) and the snapshot table guards.  A gate
 * trigger on the snapshot table parks a `s11race-gated-<key>-<label>` session right before its row is inserted (it
 * holds the owner lock there) and writes nothing.
 *
 *   L1  two FIRST writes of one owner with the SAME values: the writer parked before its insert holds the owner's
 *       advisory lock, the second writer waits on exactly that lock key; when released both commit and the owner has
 *       ONE snapshot, ordinal 1, no error surfaces.
 *   L2  two FIRST writes of one owner with DIFFERENT values: the second writer waits on the owner lock behind the
 *       parked first one; both commit, the first takes ordinal 1 and the second ordinal 2 (previous maximum + 1),
 *       and no error surfaces (without the lock the second would compute ordinal 1 as well and the snapshot guard
 *       would refuse the loser).
 *   L3  four simultaneous writers with four new values commit gapless ordinals 3..6, none refused.
 *   L4  a session holding the owner's lock key blocks a write of a new value until it lets go; nothing is inserted
 *       while it waits, and the write then takes the next ordinal.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';

const { check, sql } = kit;
const ids = kit.buildFixture();
const owner = ids.organization;
const GATE = 8801;

const noSnapshots = () =>
  kit.runValue(
    `select count(*) from platform_private.cms_publication_settings_snapshots where owner_id = ${sql(owner)}::uuid;`,
  );
const snapshots = () =>
  kit
    .runValue(
      `select coalesce(jsonb_agg(jsonb_build_object('ordinal', ordinal, 'variant', coalesce(effective_values->0->>'valueHash', '-')) order by ordinal), '[]'::jsonb)::text from platform_private.cms_publication_settings_snapshots where owner_id = ${sql(owner)}::uuid;`,
    )
    .trim();
const rows = () => JSON.parse(snapshots());
const summary = () =>
  rows()
    .map((row) => `${row.ordinal}:${row.variant}`)
    .join(',');
const entriesOfOwner = () =>
  Number(
    kit.runValue(
      `select count(*) from platform_private.cms_content_entries where owner_id = ${sql(owner)}::uuid;`,
    ),
  );

// ------------------------------------------------------------ fixture ----
kit.runScript(`
create or replace function platform_private.cms_publication_settings_effective_values(
  p_owner_id uuid, p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  variant text := pg_catalog.current_setting('s11race.variant', true);
begin
  if variant is null or variant = '' then
    return '[]'::jsonb;
  end if;
  return pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'key', 's11race.variant', 'definitionVersionId', null,
    'sourceValueVersionId', null, 'valueHash', variant));
end;
$body$;
create or replace function public.s11race_settings_gate() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare
  app text := pg_catalog.current_setting('application_name', true);
begin
  if app like 's11race-gated-%' then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.split_part(app, '-', 3)::bigint);
  end if;
  return new;
end;
$f$;
revoke all on function public.s11race_settings_gate() from public;
grant execute on function public.s11race_settings_gate() to public;
drop trigger if exists cms_publication_settings_snapshots_0_s11race_gate
  on platform_private.cms_publication_settings_snapshots;
create trigger cms_publication_settings_snapshots_0_s11race_gate
  before insert on platform_private.cms_publication_settings_snapshots
  for each row execute function public.s11race_settings_gate();
select '{}';
`);

const lockKey = kit.runValue(
  `select hashtextextended('cms.settings_snapshot:' || ${sql(owner)}, 0)::text;`,
);
/** True while the application's backend waits for (not holds) the owner's advisory lock key. */
const waitsOnOwnerLock = (app) =>
  kit.runValue(
    `select count(*) from pg_stat_activity a join pg_locks l on l.pid = a.pid where a.application_name = ${sql(app)} and l.locktype = 'advisory' and not l.granted and ((l.classid::bigint << 32) | l.objid::bigint) = ${lockKey}::bigint;`,
  ) === '1';
/** True while the application's backend HOLDS the owner's advisory lock key. */
const holdsOwnerLock = (app) =>
  kit.runValue(
    `select count(*) from pg_stat_activity a join pg_locks l on l.pid = a.pid where a.application_name = ${sql(app)} and l.locktype = 'advisory' and l.granted and ((l.classid::bigint << 32) | l.objid::bigint) = ${lockKey}::bigint;`,
  ) === '1';
const clearSnapshots = () =>
  kit.runValue(
    `begin; select set_config('app.cms_rpc', 'true', true); alter table platform_private.cms_publication_settings_snapshots disable trigger user; delete from platform_private.cms_publication_settings_snapshots where owner_id = ${sql(owner)}::uuid; alter table platform_private.cms_publication_settings_snapshots enable trigger user; commit; select 'cleared';`,
  );

/** One ordinary write (a real cms_create_entry) whose effective values are `variant`; resolves { code, stdout, stderr }. */
const write = (app, variant, label) => {
  const request = kit.createRequest(
    ids,
    { [kit.titleField(ids)]: `Settings race ${label}` },
    kit.nextKey(`s11-settings-${label}`),
  );
  return kit.runAsync(
    app,
    `begin; ${kit.actorSettings(ids)} select set_config('s11race.variant', ${sql(variant)}, true); select platform_api.cms_create_entry(${kit.jsonb(request)}); commit;`,
  );
};
const clean = (outcome) =>
  outcome.code === 0 &&
  !/ERROR|duplicate key|VALIDATION_FAILED/u.test(outcome.stderr);
const failure = (outcome) =>
  (outcome.stderr || '').split('\n').find((line) => /ERROR/u.test(line)) ??
  'ok';

clearSnapshots();
check(
  noSnapshots() === '0',
  'fixture: the owner has no settings snapshot, so the first write below is a first write',
);
const baseEntries = entriesOfOwner();

try {
  // ------------------------------------------------------------ L1 ----
  await kit.closeGate(GATE);
  const first = write(`s11race-gated-${GATE}-l1a`, 'same', 'l1a');
  await kit.waitParked(`s11race-gated-${GATE}-l1a`);
  check(
    holdsOwnerLock(`s11race-gated-${GATE}-l1a`),
    'L1: the parked first writer holds the owner settings advisory lock (it takes it before its insert)',
  );
  const second = write('s11race-l1b', 'same', 'l1b');
  check(
    (await kit.blockedOrCompleted('s11race-l1b', second)) === 'blocked' &&
      waitsOnOwnerLock('s11race-l1b'),
    'L1: the second first-write of the owner waits on the owner advisory lock key held by the first',
  );
  check(noSnapshots() === '0', 'L1: nothing is inserted while the first is parked');
  await kit.openGate(GATE);
  const [l1a, l1b] = await Promise.all([first.done, second.done]);
  check(
    clean(l1a) && clean(l1b),
    `L1: both first writes commit and no error surfaces (${failure(l1a)} / ${failure(l1b)})`,
  );
  check(
    summary() === '1:same' && entriesOfOwner() - baseEntries === 2,
    `L1: the owner has one snapshot, ordinal 1, and both entries exist (${summary()}, ${entriesOfOwner() - baseEntries} new entries)`,
  );

  // ------------------------------------------------------------ L2 ----
  clearSnapshots();
  check(noSnapshots() === '0', 'L2: the owner is pristine again, so both writes are first writes');
  await kit.closeGate(GATE);
  const firstDistinct = write(`s11race-gated-${GATE}-l2a`, 'v1', 'l2a');
  await kit.waitParked(`s11race-gated-${GATE}-l2a`);
  const secondDistinct = write('s11race-l2b', 'v2', 'l2b');
  check(
    (await kit.blockedOrCompleted('s11race-l2b', secondDistinct)) ===
      'blocked' && waitsOnOwnerLock('s11race-l2b'),
    'L2: the second first-write, which computed a different snapshot, waits on the owner advisory lock key',
  );
  check(noSnapshots() === '0', 'L2: nothing is inserted while the first is parked');
  await kit.openGate(GATE);
  const [l2a, l2b] = await Promise.all([
    firstDistinct.done,
    secondDistinct.done,
  ]);
  check(
    clean(l2a) && clean(l2b),
    `L2: both first writes commit and no error surfaces (${failure(l2a)} / ${failure(l2b)})`,
  );
  check(
    summary() === '1:v1,2:v2',
    `L2: the writer that held the lock takes ordinal 1 and the one that waited takes the previous maximum + 1 = 2 (${summary()})`,
  );

  // ------------------------------------------------------------ L3 ----
  const burst = ['v3', 'v4', 'v5', 'v6'].map((variant) =>
    write(`s11race-l3-${variant}`, variant, `l3${variant}`),
  );
  const burstDone = await Promise.all(burst.map((entry) => entry.done));
  check(
    burstDone.every(clean),
    `L3: four simultaneous writers of four new values all commit without an error (${burstDone.map(failure).join(' / ')})`,
  );
  const ordinals = rows().map((row) => row.ordinal);
  check(
    ordinals.join(',') === '1,2,3,4,5,6' &&
      new Set(rows().map((row) => row.variant)).size === 6,
    `L3: the ordinals are gapless and distinct, one per value (${summary()})`,
  );

  // ------------------------------------------------------------ L4 ----
  // The "gate" holder session takes the owner's lock key itself, as a session-level advisory lock.
  await kit.closeGate(lockKey);
  const blockedWrite = write('s11race-l4', 'v7', 'l4');
  check(
    (await kit.blockedOrCompleted('s11race-l4', blockedWrite)) === 'blocked' &&
      waitsOnOwnerLock('s11race-l4'),
    'L4: a write of a new value waits while another session holds the owner advisory lock key',
  );
  check(
    rows().length === 6,
    'L4: no snapshot is inserted while the lock is held by another session',
  );
  await kit.openGate(lockKey);
  const l4 = await blockedWrite.done;
  check(
    clean(l4) && summary().endsWith(',7:v7') && rows().length === 7,
    `L4: when the lock is released the write commits and takes ordinal 7 (${failure(l4)}; ${summary()})`,
  );
  console.log(
    '# all settings snapshot race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
