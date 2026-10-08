-- Slice 10 conflict lifecycle: an open conflict is superseded when the draft advances
-- past it (write-path audit "conflict wedge", P2-S10-AC-013/AC-033/AC-053; BE03b
-- ConflictRecord states open | resolved | superseded, "At most one open conflict
-- exists per entry; resolution never last-writes-wins", error matrix "409 base moved
-- or invalid transition; open conflict record preserved").
--
-- Before: nothing ever set a conflict to `superseded`, and a resolution requires
-- theirs = the current draft.  Once any other write advanced the draft, the open
-- conflict could never be resolved, and every later same-field clash reused that dead
-- record instead of recording the live one: the entry was wedged.
--
-- Now every command that commits a new current draft (append, resolve, restore)
-- supersedes the entry's open conflicts whose `theirs` revision it replaced, in the
-- same transaction; a resolution attempt on a closed (resolved or superseded)
-- conflict is the typed INVALID_TRANSITION (409 "invalid transition"); a later clash
-- records a fresh conflict against the live draft; and a legacy open conflict that is
-- already stale is superseded by the next clash instead of being reused.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

create temp table s10c_calls(label text primary key, state text, message text, response jsonb) on commit drop;
create or replace function pg_temp.s10c_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb;
begin
  begin
    execute p_sql into result;
    insert into s10c_calls values (p_label, '00000', null, result)
    on conflict (label) do update set state = excluded.state, message = null, response = excluded.response;
  exception when others then
    insert into s10c_calls values (p_label, sqlstate, sqlerrm, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = null;
  end;
end;
$body$;
create or replace function pg_temp.s10c_outcome(p_label text)
returns text
language sql
stable
as $body$
  select coalesce((select case when state = '00000' then 'OK' else state || ':' || message end
                   from s10c_calls where label = p_label), 'MISSING')
$body$;

create or replace function pg_temp.s10c_resolve_sql(
  p_conflict uuid, p_entry text, p_expected text, p_key text, p_base text default '1'
)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'conflictId', p_conflict, 'baseRevision', p_base,
    'choices', jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')),
    'expectedVersion', p_expected, 'ifMatch', p_expected, 'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;
create or replace function pg_temp.s10c_restore_sql(p_entry text, p_revision text, p_expected text, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_restore_revision(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'revisionId', p_revision,
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10r_ids where key = 'typeId'),
        (select value::uuid from s10r_ids where key = 'versionId'),
        (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', p_expected, 'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

create or replace function pg_temp.s10c_state(p_conflict uuid)
returns text
language sql
stable
as $body$
  select state || '/' || version::text || '/'
         || (resolved_revision_id is null and resolved_by_person_id is null and resolved_at is null)::text
  from platform_private.cms_conflict_records where id = p_conflict
$body$;
create or replace function pg_temp.s10c_open(p_entry uuid)
returns uuid
language sql
stable
as $body$
  select id from platform_private.cms_conflict_records where entry_id = p_entry and state = 'open'
$body$;

-- ---- an entry with a recorded conflict C1 (theirs = revision 2) ------------------------
select pg_temp.s10c_call('create', pg_temp.s10r_create_sql(jsonb_build_object('title', 'A'), 's10-lifecycle-create-0001'));
create temp table s10c_entry on commit drop as
select (response->'entry'->>'id') as entry_id, (response->'revision'->>'id') as rev1
from s10c_calls where label = 'create';
select pg_temp.s10c_call('theirs', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('title', 'B'), '1', '1', 's10-lifecycle-theirs-0001'));
select pg_temp.s10c_call('yours-1', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('title', 'C'), '1', '2', 's10-lifecycle-yours-0001'));
select is((select response->>'kind' from s10c_calls where label = 'yours-1'), 'conflict',
  'a stale same-field edit records conflict C1 against revision 2');
create temp table s10c_ids on commit drop as
select pg_temp.s10c_open((select entry_id::uuid from s10c_entry)) as c1;
select is((select pg_temp.s10c_state(c1) from s10c_ids), 'open/1/true', 'C1 is open');

-- ---- the draft advances past C1 (a non-overlapping append) ------------------------------
select pg_temp.s10c_call('advance', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('primary', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000321')), '2', '2', 's10-lifecycle-advance-0001'));
select is(pg_temp.s10c_outcome('advance'), 'OK', 'a non-overlapping append advances the draft to revision 3');
select is((select pg_temp.s10c_state(c1) from s10c_ids), 'superseded/2/true',
  'the append that advanced the draft superseded C1 in the same transaction (version + 1, no resolution evidence) [P2-S10-AC-053]');
select is((select count(*)::integer from platform_private.cms_conflict_records
            where entry_id = (select entry_id::uuid from s10c_entry) and state = 'open'), 0,
  'no open conflict remains on the entry');

-- ---- a resolution of the closed conflict is the typed 409 -------------------------------
select pg_temp.s10c_call('resolve-closed', pg_temp.s10c_resolve_sql(
  (select c1 from s10c_ids), (select entry_id from s10c_entry), '3', 's10-lifecycle-resolve-closed-0001'));
select is(pg_temp.s10c_outcome('resolve-closed'), 'P0001:INVALID_TRANSITION',
  'resolving a superseded conflict is the typed INVALID_TRANSITION (409 "invalid transition") [P2-S10-AC-013, AC-033]');

-- ---- a later clash records the LIVE conflict, never the dead one ---------------------------
select pg_temp.s10c_call('yours-2', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('title', 'D'), '1', '3', 's10-lifecycle-yours-0002'));
select is((select response->>'kind' from s10c_calls where label = 'yours-2'), 'conflict',
  'a later same-field clash records a conflict');
create temp table s10c_ids2 on commit drop as
select pg_temp.s10c_open((select entry_id::uuid from s10c_entry)) as c2;
select isnt((select c2 from s10c_ids2), (select c1 from s10c_ids), 'the new conflict C2 is a new record, not the dead C1');
select is((select theirs_revision_id from platform_private.cms_conflict_records where id = (select c2 from s10c_ids2)),
  (select current_draft_revision_id from platform_private.cms_content_entries where id = (select entry_id::uuid from s10c_entry)),
  'C2 is bound to the current draft revision (theirs)');
select is((select pg_temp.s10c_state(c1) from s10c_ids), 'superseded/2/true', 'C1 stays superseded');
select is((select count(*)::integer from platform_private.cms_conflict_records
            where entry_id = (select entry_id::uuid from s10c_entry) and state = 'open'), 1, 'exactly one open conflict');

-- ---- C2 resolves normally and closes ---------------------------------------------------------
select pg_temp.s10c_call('resolve-2', pg_temp.s10c_resolve_sql(
  (select c2 from s10c_ids2), (select entry_id from s10c_entry), '3', 's10-lifecycle-resolve-0002'));
select is(pg_temp.s10c_outcome('resolve-2'), 'OK', 'the live conflict C2 resolves');
select is((select state from platform_private.cms_conflict_records where id = (select c2 from s10c_ids2)), 'resolved',
  'C2 is resolved by its resolving revision');

-- ---- a LEGACY stale open conflict is superseded by the next clash, not reused ---------------------
-- (rows written before this migration can be open with a stale theirs; reopen C1 to model one)
set local session_replication_role = replica;
update platform_private.cms_conflict_records set state = 'open' where id = (select c1 from s10c_ids);
set local session_replication_role = origin;
select is((select pg_temp.s10c_state(c1) from s10c_ids), 'open/2/true', 'fixture: C1 is a stale open record again');
select pg_temp.s10c_call('yours-3', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('title', 'E'), '1', '4', 's10-lifecycle-yours-0003'));
select is((select response->>'kind' from s10c_calls where label = 'yours-3'), 'conflict', 'the next clash is recorded');
create temp table s10c_ids3 on commit drop as
select pg_temp.s10c_open((select entry_id::uuid from s10c_entry)) as c3;
select isnt((select c3 from s10c_ids3), (select c1 from s10c_ids),
  'the stale open record was not reused: a fresh conflict C3 was recorded');
select is((select pg_temp.s10c_state(c1) from s10c_ids), 'superseded/3/true',
  'the stale legacy conflict was superseded by the clash that found it');

-- ---- a restore that advances the draft supersedes the open conflict -----------------------------
select pg_temp.s10c_call('restore', pg_temp.s10c_restore_sql(
  (select entry_id from s10c_entry), (select rev1 from s10c_entry), '4', 's10-lifecycle-restore-0001'));
select is(pg_temp.s10c_outcome('restore'), 'OK', 'a restore advances the draft');
select is((select pg_temp.s10c_state(c3) from s10c_ids3), 'superseded/2/true',
  'the restore superseded the conflict it replaced');

-- ---- a resolution that advances the draft closes its own conflict and supersedes none other ---------
-- (the restore reinstated revision 1's title, so the clash is over revision 2's base)
select pg_temp.s10c_call('yours-4', pg_temp.s10r_revision_sql((select entry_id from s10c_entry),
  jsonb_build_object('title', 'F'), '2', '5', 's10-lifecycle-yours-0004'));
select is((select response->>'kind' from s10c_calls where label = 'yours-4'), 'conflict', 'a further clash is recorded');
select pg_temp.s10c_call('resolve-4', pg_temp.s10c_resolve_sql(
  pg_temp.s10c_open((select entry_id::uuid from s10c_entry)), (select entry_id from s10c_entry), '5', 's10-lifecycle-resolve-0004', '2'));
select is(pg_temp.s10c_outcome('resolve-4'), 'OK', 'the further conflict resolves');
select is(
  (select string_agg(state, ',' order by state) from platform_private.cms_conflict_records
    where entry_id = (select entry_id::uuid from s10c_entry)),
  'resolved,resolved,superseded,superseded', 'the entry ends with two resolved and two superseded records and no open one');

select * from finish();
rollback;
