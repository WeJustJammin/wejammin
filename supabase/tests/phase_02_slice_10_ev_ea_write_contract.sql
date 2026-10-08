-- Slice 10 evidence lane EA: CMS-03B-01 write-contract assertions that no earlier suite makes
-- (P2-S10-AC-001, AC-007, AC-028, AC-032).
--
--   * A save from a stale base that touches a field nobody else changed is merged, never
--     recorded as a conflict (a conflict is only ever created for a true same-field divergence).
--   * A stale entry version (If-Match / expectedVersion) is the typed VERSION_MISMATCH and the
--     command writes nothing.
--   * An entry that is not active refuses the write with the policy-safe 404 NOT_FOUND (BE03b
--     validation matrix: "must resolve to active ContentEntry"; lane H round 3, it was a 409
--     INVALID_TRANSITION) and the command writes nothing.
--
-- Every probe goes through the named worker-facing RPC (platform_api.cms_create_entry /
-- cms_create_revision) exactly as the Worker calls it; no row is inserted by hand except the
-- lifecycle switch of the archived-entry probe, which uses the same transaction-local RPC
-- authority flag the shared fixtures use.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc

create temp table s10e_calls(label text primary key, state text, message text, response jsonb) on commit drop;
create or replace function pg_temp.s10e_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb;
begin
  begin
    execute p_sql into result;
    insert into s10e_calls values (p_label, '00000', null, result)
    on conflict (label) do update set state = excluded.state, message = null, response = excluded.response;
  exception when others then
    insert into s10e_calls values (p_label, sqlstate, sqlerrm, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = null;
  end;
end;
$body$;
create or replace function pg_temp.s10e_outcome(p_label text)
returns text
language sql
stable
as $body$
  select coalesce((select case when state = '00000' then 'OK' else state || ':' || message end
                   from s10e_calls where label = p_label), 'MISSING')
$body$;

-- ---- an entry on revision 1 whose title and relation are authored together -------------------
select pg_temp.s10e_call('create', pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'A', 'related', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000301')),
  's10-ea-create-0001'));
select is(pg_temp.s10e_outcome('create'), 'OK', 'fixture: the entry is created with a title and a relation');
create temp table s10e_entry on commit drop as
select response->'entry'->>'id' as entry_id from s10e_calls where label = 'create';

-- ---- AC-001: a stale-base save of a DIFFERENT field is merged, not recorded as a conflict ----
select pg_temp.s10e_call('theirs', pg_temp.s10r_revision_sql((select entry_id from s10e_entry),
  jsonb_build_object('title', 'B'), '1', '1', 's10-ea-theirs-0001'));
select is(pg_temp.s10e_outcome('theirs'), 'OK', 'fixture: another editor changes only the title (revision 2, version 2)');
select pg_temp.s10e_call('disjoint', pg_temp.s10r_revision_sql((select entry_id from s10e_entry),
  jsonb_build_object('related', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000321')),
  '1', '2', 's10-ea-disjoint-0001'));
select is(pg_temp.s10e_outcome('disjoint'), 'OK',
  'a stale-base save that changes only the relation is committed as a revision, not refused');
select is(
  (select response->>'kind' from s10e_calls where label = 'disjoint'), null::text,
  'the stale-base save of a field nobody else changed returns a revision resource, not a conflict disposition');
select is(
  (select count(*)::integer from platform_private.cms_conflict_records
    where entry_id = (select entry_id::uuid from s10e_entry)),
  0, 'a divergence on different fields records no conflict');
select is(
  (select response->>'revisionNumber' from s10e_calls where label = 'disjoint'), '3',
  'the merged save is revision 3 on top of the other editor''s revision 2');
select is(
  (select value from platform_private.cms_entry_field_values value_row
    where value_row.revision_id = (select (response->>'id')::uuid from s10e_calls where label = 'disjoint')
      and value_row.field_id = pg_temp.s10r_fid('title')::uuid),
  to_jsonb('B'::text),
  'the merged revision keeps the other editor''s title: only the changed path was applied');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10e_calls where label = 'disjoint'), 'related'),
  array['a9100000-0000-4000-8000-000000000321'],
  'the merged revision carries the saved relation');

-- ---- AC-007 / AC-032: a stale entry version is the typed VERSION_MISMATCH and writes nothing ---
create temp table s10e_before_stale on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10e_call('stale', pg_temp.s10r_revision_sql((select entry_id from s10e_entry),
  jsonb_build_object('title', 'C'), '3', '2', 's10-ea-stale-0001'));
select is(pg_temp.s10e_outcome('stale'), 'P0001:VERSION_MISMATCH',
  'an expectedVersion older than the entry version is the typed VERSION_MISMATCH');
select is(
  pg_temp.s10r_counts(), (select counts from s10e_before_stale),
  'the stale-version command wrote no entry, revision, value, relation, conflict, reservation, outbox or audit row');
select pg_temp.s10e_call('stale-replay', pg_temp.s10r_revision_sql((select entry_id from s10e_entry),
  jsonb_build_object('title', 'C'), '3', '2', 's10-ea-stale-0001'));
select is(pg_temp.s10e_outcome('stale-replay'), 'P0001:VERSION_MISMATCH',
  'retrying the stale command is still VERSION_MISMATCH: a refusal is never cached as a success');

-- ---- AC-028: an entry that is not active refuses the write and writes nothing ------------------
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set lifecycle = 'archived'
 where id = (select entry_id::uuid from s10e_entry);
create temp table s10e_before_archived on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10e_call('archived', pg_temp.s10r_revision_sql((select entry_id from s10e_entry),
  jsonb_build_object('title', 'D'), '3', '3', 's10-ea-archived-0001'));
select is(pg_temp.s10e_outcome('archived'), 'P0001:NOT_FOUND',
  'an append to a non-active entry is the policy-safe 404 NOT_FOUND (BE03b: must resolve to active ContentEntry)');
select is(
  pg_temp.s10r_counts(), (select counts from s10e_before_archived),
  'the non-active-entry command wrote no entry, revision, value, relation, conflict, reservation, outbox or audit row');

select * from finish();
rollback;
